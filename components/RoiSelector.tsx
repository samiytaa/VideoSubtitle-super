import {
  Camera,
  CheckCircle2,
  Maximize,
  Minimize,
  Pause,
  Play,
  Timer,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExtractedFrame, ROI, RoiPreset, VideoFile } from '../types';
import { formatTimestampDisplay, generateFilename } from '../utils/filenameUtils';
import { useNotifier } from './Notifications';
import { handleError } from '../utils/errorHandler';
import PresetCard from './roiSelector/PresetCard';
import CategoryProcessOptions from './roiSelector/CategoryProcessOptions';
import SavePresetDialog from './roiSelector/SavePresetDialog';
import SaveDialoguePresetDialog from './roiSelector/SaveDialoguePresetDialog';
import SaveLocationPresetDialog from './roiSelector/SaveLocationPresetDialog';
import VideoUploadPlaceholder from './roiSelector/VideoUploadPlaceholder';
import QuickProcessPanel from './QuickProcessPanel';
import { formatTimeHms, getSkipSubtitleRegionsFromPreset } from './roiSelector/roiSelectorUtils';
import { usePresets } from './roiSelector/usePresets';
import {
  getPresetCategory,
  getDefaultQuickProcessPrefs,
  loadQuickProcessPrefs,
  QuickProcessPrefs,
  subscribeQuickProcessPrefs,
  updateQuickProcessPrefs,
} from '../utils/quickProcessPrefs';

/**
 * Z-Index 层级规范：
 * z-[10]  - 基础元素（播放器、面板等）
 * z-[30-40] - 视频覆盖层（选区、控制栏等）
 * z-50    - 顶部导航栏
 * z-[100] - 通知系统背景
 * z-[101] - Toast 通知
 * z-[200] - 全屏播放器
 * z-[9999] - 模态对话框（最高层级）
 */

interface RoiSelectorProps {
  video?: VideoFile | null;
  videoSrc?: string | null;
  onConfirm: (roi: ROI, timeRange?: { startTime: number; endTime: number }, skipSubtitleRegions?: boolean) => void;
  onFrameCaptured?: (frame: ExtractedFrame) => void;
  videoRef?: React.MutableRefObject<HTMLVideoElement | null>;
  onQuickProcess?: (options: {
    srtFile: File | null;
    dialoguePreset: RoiPreset | null;
    locationPreset: RoiPreset | null;
    timeRange: { startTime: number; endTime: number };
    captureType: 'dialogue' | 'location' | 'both';
    autoDeduplicationDialogue: boolean;
    autoDeduplicationLocation: boolean;
    frameInterval?: number;
    skipSubtitleDialogue?: boolean;
    skipSubtitleLocation?: boolean;
  }) => void;
  isProcessing?: boolean;
  progress?: { current: number; total: number; message: string; stage?: 'extracting' | 'extracting-dialogue' | 'extracting-location' | 'deduplicating' };
  onReplaceVideo?: () => void;
  onClearVideo?: () => void;
  onUpload?: (video: VideoFile) => void;
  quickProcessSrtFile?: File | null;
  onSrtFileChange?: (file: File | null) => void;
}

const RoiSelector: React.FC<RoiSelectorProps> = ({
  video,
  videoSrc,
  onConfirm,
  onFrameCaptured,
  videoRef: externalVideoRef,
  onQuickProcess,
  isProcessing,
  progress,
  onReplaceVideo,
  onClearVideo,
  onUpload,
  quickProcessSrtFile,
  onSrtFileChange,
}) => {
  const videoStateKey = `video_state_${video?.id ?? 'none'}`;

  const getInitialState = () => {
    try {
      const saved = sessionStorage.getItem(videoStateKey);
      if (saved) {
        const state = JSON.parse(saved);
        return {
          currentTime: state.currentTime || 0,
          startTime: state.startTime || 0,
          endTime: state.endTime || video?.duration || 0,
          cropBox: state.cropBox || { x: 10, y: 70, width: 80, height: 12 },
          currentPresetName: state.currentPresetName || null,
          hasSavedState: true,
        };
      }
    } catch (e) {
      handleError(e, undefined, { context: 'Failed to restore video state' });
    }
    return {
      currentTime: 0,
      startTime: 0,
      endTime: video?.duration || 0,
      cropBox: { x: 10, y: 70, width: 80, height: 12 },
      currentPresetName: null,
      hasSavedState: false,
    };
  };

  const initialState = getInitialState();

  const [cropBox, setCropBox] = useState<ROI>(initialState.cropBox);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialState.currentTime);
  const [duration, setDuration] = useState(video?.duration || 0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [startTime, setStartTime] = useState(initialState.startTime);
  const [endTime, setEndTime] = useState(initialState.endTime);
  const [isCaptured, setIsCaptured] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [currentPresetName, setCurrentPresetName] = useState<string | null>(initialState.currentPresetName);
  const [showSaveDialogueDialog, setShowSaveDialogueDialog] = useState(false);
  const [showSaveLocationDialog, setShowSaveLocationDialog] = useState(false);
  const [quickProcessPrefsState, setQuickProcessPrefsState] = useState<QuickProcessPrefs>(() => ({
    ...getDefaultQuickProcessPrefs(),
    ...loadQuickProcessPrefs(),
  }));

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; box: ROI } | null>(null);

  const playerAreaRef = useRef<HTMLDivElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const notifier = useNotifier();
  const isPortraitVideo = !!video && (video.height > video.width);
  const playerViewportClass = 'w-full aspect-[2/3] max-h-[480px]';

  const { presets, deletePreset, renamePreset, setAsDefaultPreset, addPreset } = usePresets();

  // 同步外部 videoRef
  useEffect(() => {
    if (externalVideoRef && videoRef.current) {
      externalVideoRef.current = videoRef.current;
    }
  }, [externalVideoRef]);

  // 监听视频时长变化
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    const updateDuration = () => {
      if (isFinite(videoElement.duration) && videoElement.duration > 0) {
        setDuration(videoElement.duration);
        if (endTime === 0 || endTime === video?.duration) {
          setEndTime(videoElement.duration);
        }
      }
    };
    videoElement.addEventListener('loadedmetadata', updateDuration);
    videoElement.addEventListener('durationchange', updateDuration);
    videoElement.addEventListener('loadeddata', updateDuration);
    updateDuration();
    return () => {
      videoElement.removeEventListener('loadedmetadata', updateDuration);
      videoElement.removeEventListener('durationchange', updateDuration);
      videoElement.removeEventListener('loadeddata', updateDuration);
    };
  }, [video?.duration, endTime]);

  // 保存视频状态到 sessionStorage
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        sessionStorage.setItem(videoStateKey, JSON.stringify({ currentTime, startTime, endTime, cropBox, currentPresetName }));
      } catch (e) {
        handleError(e, notifier, { context: 'Failed to save video state' });
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [currentTime, startTime, endTime, cropBox, currentPresetName, videoStateKey]);

  // 恢复视频播放位置
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    const restoreVideoTime = () => {
      if (initialState.currentTime > 0 && videoElement.readyState >= 2) {
        videoElement.currentTime = initialState.currentTime;
      }
    };
    if (videoElement.readyState >= 2) {
      restoreVideoTime();
    } else {
      videoElement.addEventListener('loadeddata', restoreVideoTime);
      return () => videoElement.removeEventListener('loadeddata', restoreVideoTime);
    }
  }, [initialState.currentTime]);

  // 初始化默认预设（仅首次，无已保存状态时）
  useEffect(() => {
    if (initialState.hasSavedState) return;
    const defaultPreset = Object.values(presets).find((p: RoiPreset) => p.isDefault) as RoiPreset | undefined;
    if (defaultPreset) {
      setCropBox({
        x: defaultPreset.x_ratio * 100,
        y: defaultPreset.y_ratio * 100,
        width: defaultPreset.w_ratio * 100,
        height: defaultPreset.h_ratio * 100,
      });
      setCurrentPresetName(defaultPreset.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 全屏监听
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // 通知父组件 cropBox / 时间范围变化
  useEffect(() => {
    onConfirm(cropBox, { startTime, endTime }, undefined);
  }, [cropBox, startTime, endTime, onConfirm]);

  // 应用播放速度
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    return subscribeQuickProcessPrefs((prefs) => {
      setQuickProcessPrefsState(prev => ({ ...prev, ...prefs }));
    });
  }, []);

  // --- 预设操作 ---
  const applyPreset = (preset: RoiPreset) => {
    const newCropBox = {
      x: preset.x_ratio * 100,
      y: preset.y_ratio * 100,
      width: preset.w_ratio * 100,
      height: preset.h_ratio * 100,
    };
    setCropBox(newCropBox);
    setCurrentPresetName(preset.name);
    const presetCategory = getPresetCategory(preset, preset.category ?? 'dialogue');
    updateQuickProcessPrefs(
      presetCategory === 'dialogue'
        ? { selectedDialoguePreset: preset.name }
        : { selectedLocationPreset: preset.name },
    );
    const skip = getSkipSubtitleRegionsFromPreset(preset);
    if (skip !== undefined) {
      onConfirm(newCropBox, { startTime, endTime }, skip);
    }
  };

  const selectedDialoguePresetName = quickProcessPrefsState.selectedDialoguePreset;
  const selectedLocationPresetName = quickProcessPrefsState.selectedLocationPreset;

  const savePreset = (category: 'dialogue' | 'location') => {
    if (cropBox.width <= 0 || cropBox.height <= 0) {
      notifier.addToast('当前选区无效，无法保存。', 'error');
      return;
    }
    if (category === 'dialogue') {
      setShowSaveDialogueDialog(true);
    } else {
      setShowSaveLocationDialog(true);
    }
  };

  const handleSaveDialoguePreset = (name: string) => {
    const x_px = Math.round((cropBox.x / 100) * (video?.width ?? 1920));
    const y_px = Math.round((cropBox.y / 100) * (video?.height ?? 1080));
    const w_px = Math.round((cropBox.width / 100) * (video?.width ?? 1920));
    const h_px = Math.round((cropBox.height / 100) * (video?.height ?? 1080));
    addPreset({
      name,
      x_ratio: cropBox.x / 100,
      y_ratio: cropBox.y / 100,
      w_ratio: cropBox.width / 100,
      h_ratio: cropBox.height / 100,
      description: `X=${x_px}, Y=${y_px}, ${w_px}×${h_px}`,
      isDefault: false,
      category: 'dialogue',
    });
    setShowSaveDialogueDialog(false);
    notifier.addToast(`对话预设 "${name}" 已保存`, 'success');
  };

  const handleSaveLocationPreset = (name: string) => {
    const x_px = Math.round((cropBox.x / 100) * (video?.width ?? 1920));
    const y_px = Math.round((cropBox.y / 100) * (video?.height ?? 1080));
    const w_px = Math.round((cropBox.width / 100) * (video?.width ?? 1920));
    const h_px = Math.round((cropBox.height / 100) * (video?.height ?? 1080));
    addPreset({
      name,
      x_ratio: cropBox.x / 100,
      y_ratio: cropBox.y / 100,
      w_ratio: cropBox.width / 100,
      h_ratio: cropBox.height / 100,
      description: `X=${x_px}, Y=${y_px}, ${w_px}×${h_px}`,
      isDefault: false,
      category: 'location',
    });
    setShowSaveLocationDialog(false);
    notifier.addToast(`地点预设 "${name}" 已保存`, 'success');
  };

  // --- 像素坐标 ---
  const pixelCoords = {
    x: Math.round((cropBox.x / 100) * (video?.width ?? 1920)),
    y: Math.round((cropBox.y / 100) * (video?.height ?? 1080)),
    w: Math.max(1, Math.round((cropBox.width / 100) * (video?.width ?? 1920))),
    h: Math.max(1, Math.round((cropBox.height / 100) * (video?.height ?? 1080))),
  };

  // --- 播放控制 ---
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const cyclePlaybackRate = useCallback(() => {
    const rates = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (videoRef.current) videoRef.current.playbackRate = nextRate;
  }, [playbackRate]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // --- 截帧 ---
  const captureCurrentFrame = () => {
    if (isPlaying) { notifier.addToast('请先暂停视频再进行截取', 'info'); return; }
    if (!videoRef.current || !captureCanvasRef.current) return;
    const canvas = captureCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const vid = videoRef.current;
    const cropX = (cropBox.x / 100) * vid.videoWidth;
    const cropY = (cropBox.y / 100) * vid.videoHeight;
    const cropW = (cropBox.width / 100) * vid.videoWidth;
    const cropH = (cropBox.height / 100) * vid.videoHeight;
    canvas.width = cropW;
    canvas.height = cropH;
    ctx.drawImage(vid, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const capturedFrame: ExtractedFrame = {
      id: `${video?.id ?? 'manual'}_manual_${Date.now()}`,
      url: dataUrl,
      timestamp: formatTimestampDisplay(currentTime),
      filename: generateFilename(currentTime, 'manual', 'jpg'),
      videoName: video?.name ?? '',
      group: 'group1',
    };
    onFrameCaptured?.(capturedFrame);
    setIsCaptured(true);
    notifier.addToast('已添加到截取结果', 'success');
    setTimeout(() => setIsCaptured(false), 2000);
  };

  // --- 选区拖拽 / 缩放 ---
  const handleMouseDown = (e: React.MouseEvent, handle: string | null = null) => {
    if (isPlaying) return;
    e.preventDefault();
    e.stopPropagation();
    if (handle) { setIsResizing(true); setResizeHandle(handle); }
    else { setIsDragging(true); }
    if (!videoWrapperRef.current) return;
    const rect = videoWrapperRef.current.getBoundingClientRect();
    dragStartRef.current = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
      box: { ...cropBox },
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if ((!isDragging && !isResizing) || !dragStartRef.current || !videoWrapperRef.current) return;
      const rect = videoWrapperRef.current.getBoundingClientRect();
      const cx = ((e.clientX - rect.left) / rect.width) * 100;
      const cy = ((e.clientY - rect.top) / rect.height) * 100;
      const dx = cx - dragStartRef.current.x;
      const dy = cy - dragStartRef.current.y;
      const start = dragStartRef.current;
      let next = { ...start.box };
      const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

      if (isDragging) {
        next.x = clamp(start.box.x + dx, 0, 100 - start.box.width);
        next.y = clamp(start.box.y + dy, 0, 100 - start.box.height);
      } else if (isResizing && resizeHandle) {
        if (resizeHandle.includes('e')) next.width = clamp(start.box.width + dx, 1, 100 - start.box.x);
        if (resizeHandle.includes('s')) next.height = clamp(start.box.height + dy, 1, 100 - start.box.y);
        if (resizeHandle.includes('w')) {
          const maxW = start.box.x + start.box.width;
          const newX = clamp(start.box.x + dx, 0, maxW - 1);
          next.width = maxW - newX; next.x = newX;
        }
        if (resizeHandle.includes('n')) {
          const maxH = start.box.y + start.box.height;
          const newY = clamp(start.box.y + dy, 0, maxH - 1);
          next.height = maxH - newY; next.y = newY;
        }
      }
      setCropBox(next);
    };

    const handleMouseUp = () => {
      if (isDragging || isResizing) setCurrentPresetName(null);
      setIsDragging(false); setIsResizing(false); setResizeHandle(null);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, resizeHandle]);

  const RenderHandle = ({ pos, cursor }: { pos: string; cursor: string }) => (
    <div
      className="absolute w-3 h-3 bg-white border-2 border-red-600 rounded-full z-35 shadow-sm transform -translate-x-1/2 -translate-y-1/2 hover:scale-150 transition-transform"
      style={{
        top: pos.includes('n') ? '0%' : pos.includes('s') ? '100%' : '50%',
        left: pos.includes('w') ? '0%' : pos.includes('e') ? '100%' : '50%',
        cursor,
      }}
      onMouseDown={e => handleMouseDown(e, pos)}
    />
  );

  const captureButtonClass = (() => {
    const base = 'flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap';
    if (isCaptured) return `${base} bg-emerald-500 text-white`;
    if (!video || isPlaying) return `${base} bg-gray-200 text-gray-400 cursor-not-allowed`;
    return `${base} bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105`;
  })();

  return (
    <div className="flex flex-col gap-6 p-4">
      <canvas ref={captureCanvasRef} className="hidden" />

      {/* 三列横行：播放器 + 预设库 + 公共处理区 */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        {/* 第一列：播放器 */}
        <div
          className={`flex flex-col gap-4 relative min-w-0 w-full ${isFullscreen ? '' : 'max-w-[28rem]'} ${isPortraitVideo ? 'lg:grow-0' : 'grow'}`}
        >
          {!video ? (
            <VideoUploadPlaceholder onUpload={onUpload} className={playerViewportClass} />
          ) : (
            <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div
              ref={playerAreaRef}
              className={`relative bg-black overflow-hidden group flex items-center justify-center transition-all isolate ${
                isFullscreen
                  ? 'w-full h-full z-200'
                  : isPortraitVideo
                  ? `z-10 px-3 py-4 ${playerViewportClass}`
                  : `z-10 ${playerViewportClass}`
              }`}
              onMouseEnter={() => setShowControls(true)}
              onMouseLeave={() => setShowControls(false)}
            >
              {/* 清除视频按钮 - 右上角 */}
              {onClearVideo && (
                <button
                  onClick={onClearVideo}
                  className="absolute top-3 right-3 z-50 p-2 bg-black/50 hover:bg-red-500 text-white rounded-lg transition-all hover:scale-110 backdrop-blur-sm"
                  title="清空视频"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              <div
                ref={videoWrapperRef}
                className={isPortraitVideo && !isFullscreen ? 'relative h-full w-auto max-w-full' : 'relative h-full'}
                style={{ aspectRatio: `${video?.width ?? 16}/${video?.height ?? 9}` }}
              >
                <video
                  ref={videoRef}
                  src={videoSrc ?? video?.previewUrl}
                  className="w-full h-full object-contain pointer-events-auto"
                  onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                  onEnded={() => setIsPlaying(false)}
                  onClick={togglePlay}
                />

                {!isPlaying && (
                  <div className="absolute inset-0 z-30 pointer-events-none">
                    <div
                      className="absolute border-2 border-dashed border-red-500 cursor-move pointer-events-auto bg-red-500/5"
                      style={{
                        left: `${cropBox.x}%`,
                        top: `${cropBox.y}%`,
                        width: `${cropBox.width}%`,
                        height: `${cropBox.height}%`,
                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                      }}
                      onMouseDown={e => handleMouseDown(e)}
                    >
                      <RenderHandle pos="nw" cursor="nw-resize" />
                      <RenderHandle pos="n"  cursor="n-resize"  />
                      <RenderHandle pos="ne" cursor="ne-resize" />
                      <RenderHandle pos="w"  cursor="w-resize"  />
                      <RenderHandle pos="e"  cursor="e-resize"  />
                      <RenderHandle pos="sw" cursor="sw-resize" />
                      <RenderHandle pos="s"  cursor="s-resize"  />
                      <RenderHandle pos="se" cursor="se-resize" />
                    </div>
                  </div>
                )}
              </div>

              {/* 播放控制栏 */}
              <div className={`absolute bottom-0 inset-x-0 bg-linear-to-t from-black/80 to-transparent p-6 z-40 transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="flex items-center gap-4 text-white">
                  <button onClick={togglePlay} className="hover:text-indigo-400 transition-colors">
                    {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
                  </button>

                  <button
                    onClick={cyclePlaybackRate}
                    className="px-2.5 py-1 text-xs font-bold bg-white/10 hover:bg-white/20 rounded-md transition-colors border border-white/20 min-w-[48px]"
                    title="切换播放速度"
                  >
                    {playbackRate}x
                  </button>

                  <div className="grow group/progress relative flex items-center h-6 cursor-pointer">
                    <div className="absolute w-full h-1.5 bg-white/20 rounded-full group-hover:h-2 transition-all overflow-hidden">
                      <div className="absolute h-full bg-indigo-500" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }} />
                    </div>
                    <input
                      type="range" min="0" max={duration || 100} step="0.01" value={currentTime}
                      onChange={handleSeek}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div
                      className="absolute w-4 h-4 bg-white rounded-full shadow-lg border border-indigo-500 pointer-events-none opacity-0 group-hover/progress:opacity-100 transition-opacity transform -translate-x-1/2 z-0"
                      style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
                    />
                  </div>

                  <span className="text-xs font-mono tabular-nums min-w-[120px] text-right">
                    {formatTimeHms(currentTime)} / {formatTimeHms(duration)}
                  </span>

                  <button
                    onClick={() => isFullscreen ? document.exitFullscreen() : playerAreaRef.current?.requestFullscreen()}
                    className="hover:text-indigo-400 transition-transform hover:scale-110"
                  >
                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
            </div>
          )}
          
          {/* 时间控制面板 - 始终显示 */}
          <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden bg-white">
            <div className="p-3">
              {/* 时间控制区域 - 紧凑两行布局 */}
              <div className="flex flex-col gap-1.5">
                {/* 第一行：时间显示 */}
                <div className="flex gap-2 items-center">
                  <div className={`px-3 py-1.5 rounded-lg border flex-1 ${!video ? 'bg-gray-50 border-gray-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    <div className={`font-mono text-sm font-bold text-center ${!video ? 'text-gray-400' : 'text-emerald-700'}`}>{formatTimestampDisplay(startTime)}</div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-lg border flex-1 ${!video ? 'bg-gray-50 border-gray-200' : 'bg-rose-50 border-rose-200'}`}>
                    <div className={`font-mono text-sm font-bold text-center ${!video ? 'text-gray-400' : 'text-rose-700'}`}>{formatTimestampDisplay(endTime)}</div>
                  </div>
                  <div className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border flex-1 ${!video ? 'bg-gray-50 border-gray-200' : 'bg-indigo-50 border-indigo-200'}`}>
                    <Timer className={`w-3.5 h-3.5 shrink-0 ${!video ? 'text-gray-400' : 'text-indigo-600'}`} />
                    <div className={`font-mono text-sm font-bold ${!video ? 'text-gray-400' : 'text-indigo-700'}`}>{formatTimestampDisplay(currentTime)}</div>
                  </div>
                </div>
                
                {/* 第二行：操作按钮 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setStartTime(currentTime)}
                    disabled={!video}
                    className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                      !video
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'text-white bg-emerald-500 hover:bg-emerald-600 hover:scale-105'
                    }`}
                  >
                    开始时间
                  </button>
                  <button
                    onClick={() => setEndTime(currentTime)}
                    disabled={!video}
                    className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                      !video
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'text-white bg-rose-500 hover:bg-rose-600 hover:scale-105'
                    }`}
                  >
                    结束时间
                  </button>
                  <button
                    onClick={captureCurrentFrame}
                    disabled={!video || isPlaying}
                    className={captureButtonClass}
                  >
                    {isCaptured ? '截取成功' : '截取当前帧'}
                  </button>
                </div>
              </div>
            </div>
            </div>
        </div>

        {/* 右侧区域：第一行并排预设卡片 + 第二行字幕处理 */}
        {!isFullscreen && (
          <div className="flex-1 min-w-0 flex flex-col gap-4 h-full">

            {/* 第一行：对话预设 + 地点预设 并排 */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 min-w-0">
                <PresetCard
                  category="dialogue"
                  presets={(Object.values(presets) as RoiPreset[]).filter(p =>
                    p.category === 'dialogue' || p.name.includes('对话') || p.name.includes('【对话】')
                  )}
                  currentPresetName={currentPresetName}
                  selectedPresetName={selectedDialoguePresetName}
                  onApply={applyPreset}
                  onAdd={() => savePreset('dialogue')}
                  onDelete={deletePreset}
                  onRename={renamePreset}
                  onSetDefault={setAsDefaultPreset}
                  optionsContent={
                    <CategoryProcessOptions
                      category="dialogue"
                      enabled={quickProcessPrefsState.captureDialogue}
                      skipSubtitle={quickProcessPrefsState.skipSubtitleDialogue}
                      autoDeduplication={quickProcessPrefsState.autoDeduplicationDialogue}
                      hasSrtFile={!!quickProcessSrtFile}
                      isProcessing={isProcessing ?? false}
                      onEnabledChange={(checked) => updateQuickProcessPrefs({ captureDialogue: checked })}
                      onSkipSubtitleChange={(checked) => updateQuickProcessPrefs({ skipSubtitleDialogue: checked })}
                      onAutoDeduplicationChange={(checked) => updateQuickProcessPrefs({ autoDeduplicationDialogue: checked })}
                    />
                  }
                />
              </div>
              <div className="flex-1 min-w-0">
                <PresetCard
                  category="location"
                  presets={(Object.values(presets) as RoiPreset[]).filter(p =>
                    p.category === 'location' || p.name.includes('地点') || p.name.includes('【地点】')
                  )}
                  currentPresetName={currentPresetName}
                  selectedPresetName={selectedLocationPresetName}
                  onApply={applyPreset}
                  onAdd={() => savePreset('location')}
                  onDelete={deletePreset}
                  onRename={renamePreset}
                  onSetDefault={setAsDefaultPreset}
                  optionsContent={
                    <CategoryProcessOptions
                      category="location"
                      enabled={quickProcessPrefsState.captureLocation}
                      skipSubtitle={quickProcessPrefsState.skipSubtitleLocation}
                      autoDeduplication={quickProcessPrefsState.autoDeduplicationLocation}
                      hasSrtFile={!!quickProcessSrtFile}
                      isProcessing={isProcessing ?? false}
                      onEnabledChange={(checked) => updateQuickProcessPrefs({ captureLocation: checked })}
                      onSkipSubtitleChange={(checked) => updateQuickProcessPrefs({ skipSubtitleLocation: checked })}
                      onAutoDeduplicationChange={(checked) => updateQuickProcessPrefs({ autoDeduplicationLocation: checked })}
                    />
                  }
                />
              </div>
            </div>

            {/* 第二行：字幕上传 + 一键处理 */}
            {onQuickProcess && onSrtFileChange && (
              <div className="mt-auto">
                <QuickProcessPanel
                  video={video ?? null}
                  srtFile={quickProcessSrtFile ?? null}
                  onSrtFileChange={onSrtFileChange}
                  timeRange={{ startTime, endTime }}
                  isProcessing={isProcessing ?? false}
                  progress={progress}
                  onConfirm={(file, dialoguePreset, locationPreset, timeRange, captureType, autoDeduplicationDialogue, autoDeduplicationLocation, frameInterval, skipSubtitleDialogue, skipSubtitleLocation) => {
                    onQuickProcess({ srtFile: file, dialoguePreset, locationPreset, timeRange, captureType, autoDeduplicationDialogue, autoDeduplicationLocation, frameInterval, skipSubtitleDialogue, skipSubtitleLocation });
                  }}
                />
              </div>
            )}

          </div>
        )}
      </div>

      {/* 保存对话预设对话框 */}
      {showSaveDialogueDialog && (
        <SaveDialoguePresetDialog
          video={video}
          cropBox={cropBox}
          presets={presets}
          onSave={handleSaveDialoguePreset}
          onCancel={() => setShowSaveDialogueDialog(false)}
        />
      )}

      {/* 保存地点预设对话框 */}
      {showSaveLocationDialog && (
        <SaveLocationPresetDialog
          video={video}
          cropBox={cropBox}
          presets={presets}
          onSave={handleSaveLocationPreset}
          onCancel={() => setShowSaveLocationDialog(false)}
        />
      )}
    </div>
  );
};

export default RoiSelector;
