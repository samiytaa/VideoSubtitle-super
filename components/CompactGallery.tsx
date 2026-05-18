import React, { useState, useRef, useEffect } from 'react';
import { CheckSquare, Square, ExternalLink, Trash2, X, Upload, Image as ImageIcon, Video, Scissors, Info } from 'lucide-react';
import { ExtractedFrame, VideoFile, ROI } from '../types';
import { useNotifier } from './Notifications';
import { confirmDelete } from '../utils/confirmActions';
import ImageInfoPanel from './resultGallery/ImageInfoPanel';
import { useFrameFilter, useGalleryPagination } from '../hooks';

interface CompactGalleryProps {
  frames: ExtractedFrame[];
  onDelete?: (ids: string[]) => void;
  onJumpToTime?: (timestamp: string) => void;
  activeVideo?: VideoFile | null;
  videoSrc?: string | null;
  sharedVideoRef?: React.MutableRefObject<HTMLVideoElement | null>;
  roi?: ROI | null;
  onCaptureFrame?: (frame: ExtractedFrame) => void;
  selectedReferenceFrameId?: string | null;
  onSelectReferenceFrame?: (frame: ExtractedFrame) => void;
}

const CompactGallery: React.FC<CompactGalleryProps> = ({
  frames,
  onDelete,
  onJumpToTime,
  activeVideo,
  videoSrc,
  sharedVideoRef,
  roi,
  onCaptureFrame,
  selectedReferenceFrameId,
  onSelectReferenceFrame
}) => {
  const [panelTab, setPanelTab] = useState<'images' | 'video'>('images');
  const videoRef = useRef<HTMLVideoElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0); // 记忆最后的播放时间点
  const frameItemRefs = useRef(new Map<string, HTMLDivElement>());
  const hasAlignedInitialReferenceRef = useRef(false);

  // 截取当前帧（按 roi 裁切）
  const handleCaptureFrame = () => {
    const video = videoRef.current;
    if (!video || !activeVideo || !onCaptureFrame) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    // 读取最新 cropBox
    let cr = { x_ratio: 0, y_ratio: 0, w_ratio: 1, h_ratio: 1 };
    try {
      const saved = sessionStorage.getItem(`video_state_${activeVideo.id}`);
      if (saved) {
        const state = JSON.parse(saved);
        if (state.cropBox) {
          const cb = state.cropBox;
          cr = { x_ratio: cb.x / 100, y_ratio: cb.y / 100, w_ratio: cb.width / 100, h_ratio: cb.height / 100 };
        }
      }
    } catch { /* ignore */ }
    if (roi) {
      cr = { x_ratio: roi.x / 100, y_ratio: roi.y / 100, w_ratio: roi.width / 100, h_ratio: roi.height / 100 };
    }
    const sx = Math.round(cr.x_ratio * vw);
    const sy = Math.round(cr.y_ratio * vh);
    const sw = Math.round(cr.w_ratio * vw);
    const sh = Math.round(cr.h_ratio * vh);
    if (sw <= 0 || sh <= 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    const url = canvas.toDataURL('image/jpeg', 0.92);
    // 格式化时间戳
    const t = video.currentTime;
    const h = Math.floor(t / 3600).toString().padStart(2, '0');
    const m = Math.floor((t % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(t % 60).toString().padStart(2, '0');
    const ms = Math.round((t % 1) * 1000).toString().padStart(3, '0');
    const timestamp = `${h}:${m}:${s}.${ms}`;
    const filename = `manual_[${h}:${m}:${s}.${ms}].jpg`;
    onCaptureFrame({
      id: `manual_${Date.now()}`,
      url,
      timestamp,
      filename,
      videoName: activeVideo.name,
      group: 'group1',
    });
    notifier.addToast(`已截取 ${timestamp}`, 'success');
  };

  // 双向时间同步：切换到视频tab时从 sharedVideoRef 拉取时间，离开时推回去
  useEffect(() => {
    if (panelTab !== 'video') {
      // 离开视频tab：记忆本地时间，并推回 sharedVideoRef
      const local = videoRef.current;
      if (local) {
        lastTimeRef.current = local.currentTime;
        if (sharedVideoRef?.current && Math.abs(sharedVideoRef.current.currentTime - local.currentTime) > 0.1) {
          sharedVideoRef.current.currentTime = local.currentTime;
        }
      }
      return;
    }
    // 进入视频tab：优先用 sharedVideoRef 的时间，其次用记忆的时间
    const local = videoRef.current;
    if (!local) return;
    const sharedTime = sharedVideoRef?.current?.currentTime;
    const targetTime = sharedTime !== undefined ? sharedTime : lastTimeRef.current;
    if (Math.abs(local.currentTime - targetTime) > 0.1) {
      local.currentTime = targetTime;
    }
  }, [panelTab]); // eslint-disable-line

  // 用当前 roi 作为裁切坐标（roi 是百分比，转为 0~1 比例）
  // 优先用 prop 传入的 roi，同时尝试从 sessionStorage 读取 RoiSelector 的实时 cropBox
  const cropRoi = React.useMemo(() => {
    // 尝试从 sessionStorage 读取 RoiSelector 保存的实时 cropBox
    if (activeVideo?.id) {
      try {
        const saved = sessionStorage.getItem(`video_state_${activeVideo.id}`);
        if (saved) {
          const state = JSON.parse(saved);
          if (state.cropBox) {
            const cb = state.cropBox;
            return {
              x_ratio: cb.x / 100,
              y_ratio: cb.y / 100,
              w_ratio: cb.width / 100,
              h_ratio: cb.height / 100,
              name: '当前坐标',
            };
          }
        }
      } catch { /* ignore */ }
    }
    // 降级：用 prop 传入的 roi
    if (roi) {
      return {
        x_ratio: roi.x / 100,
        y_ratio: roi.y / 100,
        w_ratio: roi.width / 100,
        h_ratio: roi.height / 100,
        name: '当前坐标',
      };
    }
    return null;
  }, [roi, activeVideo?.id, panelTab]);

  // 实时裁切预览：draw 函数每帧从 sessionStorage 读取最新 cropBox
  useEffect(() => {
    if (panelTab !== 'video' || !activeVideo) return;

    const getCropRoi = () => {
      try {
        const saved = sessionStorage.getItem(`video_state_${activeVideo.id}`);
        if (saved) {
          const state = JSON.parse(saved);
          if (state.cropBox) {
            const cb = state.cropBox;
            return { x_ratio: cb.x / 100, y_ratio: cb.y / 100, w_ratio: cb.width / 100, h_ratio: cb.height / 100 };
          }
        }
      } catch { /* ignore */ }
      if (roi) return { x_ratio: roi.x / 100, y_ratio: roi.y / 100, w_ratio: roi.width / 100, h_ratio: roi.height / 100 };
      return null;
    };

    const draw = () => {
      const video = videoRef.current;
      const canvas = cropCanvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) { animFrameRef.current = requestAnimationFrame(draw); return; }
      const cr = getCropRoi();
      if (!cr) { animFrameRef.current = requestAnimationFrame(draw); return; }
      const sx = Math.round(cr.x_ratio * vw);
      const sy = Math.round(cr.y_ratio * vh);
      const sw = Math.round(cr.w_ratio * vw);
      const sh = Math.round(cr.h_ratio * vh);
      if (sw <= 0 || sh <= 0) { animFrameRef.current = requestAnimationFrame(draw); return; }
      const displayW = canvas.parentElement?.clientWidth || sw;
      const displayH = Math.round(sh * (displayW / sw));
      if (canvas.width !== displayW || canvas.height !== displayH) {
        canvas.width = displayW;
        canvas.height = displayH;
      }
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(video, sx, sy, sw, sh, 0, 0, displayW, displayH);
      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [panelTab, activeVideo, videoSrc, roi]);


  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedGroup, setSelectedGroup] = useState<'all' | 'group1' | 'group2'>('all');
  const [selectedInfoItem, setSelectedInfoItem] = useState<ExtractedFrame | null>(null);

  // 滚动容器引用
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const notifier = useNotifier();

  // ── 过滤 + 排序（共用 hook）──────────────────────────────────────────────────
  const filteredFrames = useFrameFilter({ frames, selectedGroup });

  // ── 分页（共用 hook）────────────────────────────────────────────────────────
  const {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    paginate,
  } = useGalleryPagination({
    totalItems: filteredFrames.length,
    storageKey: `compactGallery_${selectedGroup}`,
  });

  const currentItems = paginate(filteredFrames);

  const referenceFrame = React.useMemo(
    () => (selectedReferenceFrameId ? frames.find((frame) => frame.id === selectedReferenceFrameId) ?? null : null),
    [frames, selectedReferenceFrameId]
  );

  const selectedCountInView = React.useMemo(
    () => filteredFrames.reduce((count, frame) => count + (selectedIds.has(frame.id) ? 1 : 0), 0),
    [filteredFrames, selectedIds]
  );

  const groupCounts = React.useMemo(() => {
    let group1 = 0;
    let group2 = 0;
    for (const frame of frames) {
      if (frame.group === 'group1') group1 += 1;
      else if (frame.group === 'group2') group2 += 1;
    }
    return { all: frames.length, group1, group2 };
  }, [frames]);

  // 保存 / 恢复滚动位置
  useEffect(() => {
    const saveScrollPosition = () => {
      if (scrollContainerRef.current && typeof window !== 'undefined') {
        window.localStorage.setItem(`compactGallery_scrollTop_${selectedGroup}`, String(scrollContainerRef.current.scrollTop));
      }
    };
    const container = scrollContainerRef.current;
    if (container) container.addEventListener('scroll', saveScrollPosition);
    return () => { if (container) container.removeEventListener('scroll', saveScrollPosition); };
  }, [selectedGroup]);

  const hasMountedRef = React.useRef(false);
  const previousGroupRef = React.useRef<string>(selectedGroup);

  useEffect(() => {
    if (hasMountedRef.current && previousGroupRef.current !== selectedGroup && scrollContainerRef.current) {
      window.localStorage.setItem(`compactGallery_scrollTop_${previousGroupRef.current}`, String(scrollContainerRef.current.scrollTop));
    }
    const restoreScrollPosition = () => {
      if (scrollContainerRef.current && typeof window !== 'undefined') {
        const saved = window.localStorage.getItem(`compactGallery_scrollTop_${selectedGroup}`);
        if (saved) scrollContainerRef.current.scrollTop = Number(saved);
      }
    };
    if (hasMountedRef.current) {
      setTimeout(restoreScrollPosition, 50);
    } else {
      hasMountedRef.current = true;
      setTimeout(restoreScrollPosition, 100);
    }
    previousGroupRef.current = selectedGroup;
  }, [selectedGroup]);

  // 翻页时滚动到顶部
  const previousPageRef = React.useRef<number>(currentPage);
  useEffect(() => {
    if (hasMountedRef.current && previousPageRef.current !== currentPage) {
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
    }
    previousPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    if (hasAlignedInitialReferenceRef.current) return;
    if (!referenceFrame) {
      hasAlignedInitialReferenceRef.current = true;
      return;
    }

    if (panelTab !== 'images') {
      setPanelTab('images');
    }

    const targetGroup = referenceFrame.group === 'group1' || referenceFrame.group === 'group2'
      ? referenceFrame.group
      : 'all';

    if (selectedGroup !== 'all' && selectedGroup !== targetGroup) {
      setSelectedGroup(targetGroup);
      return;
    }

    const targetFilteredFrames = filteredFrames;
    const targetIndex = targetFilteredFrames.findIndex((frame) => frame.id === referenceFrame.id);
    if (targetIndex === -1) {
      hasAlignedInitialReferenceRef.current = true;
      return;
    }

    const targetPage = Math.floor(targetIndex / itemsPerPage) + 1;
    if (currentPage !== targetPage) {
      setCurrentPage(targetPage);
      return;
    }

    hasAlignedInitialReferenceRef.current = true;
  }, [currentPage, filteredFrames, itemsPerPage, panelTab, referenceFrame, selectedGroup, setCurrentPage]);

  useEffect(() => {
    if (!selectedReferenceFrameId || panelTab !== 'images') return;
    const targetItem = currentItems.find((frame) => frame.id === selectedReferenceFrameId);
    if (!targetItem) return;

    const node = frameItemRefs.current.get(selectedReferenceFrameId);
    if (!node) return;

    const timer = window.setTimeout(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);

    return () => window.clearTimeout(timer);
  }, [currentItems, panelTab, selectedReferenceFrameId]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const selectAll = () => {
    const allCurrentItemsSelected = filteredFrames.length > 0 && filteredFrames.every(item => selectedIds.has(item.id));
    
    if (allCurrentItemsSelected) {
      const newSelectedIds = new Set(selectedIds);
      filteredFrames.forEach(item => newSelectedIds.delete(item.id));
      setSelectedIds(newSelectedIds);
    } else {
      const newSelectedIds = new Set(selectedIds);
      filteredFrames.forEach(item => newSelectedIds.add(item.id));
      setSelectedIds(newSelectedIds);
    }
  };

  const handleDeleteSelected = async () => {
    const selectedInCurrentView = filteredFrames.filter(item => selectedIds.has(item.id));
    
    if (selectedInCurrentView.length === 0) {
      notifier.addToast('请先选择要删除的图片', 'warning');
      return;
    }

    const confirmed = await confirmDelete(selectedInCurrentView.length, '选中', notifier);

    if (confirmed && onDelete) {
      const idsToDelete = selectedInCurrentView.map(item => item.id);
      onDelete(idsToDelete);
      
      const newSelectedIds = new Set(selectedIds);
      idsToDelete.forEach(id => newSelectedIds.delete(id));
      setSelectedIds(newSelectedIds);
      notifier.addToast(`已删除 ${selectedInCurrentView.length} 张图片`, 'success');
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* 顶部：Tab 切换 + 分组筛选 */}
      <div className="flex items-center justify-between border-b border-gray-200 shrink-0 px-2 py-1.5">
        {/* 左侧：Tab 切换 */}
        <div className="flex gap-1">
          <button
            onClick={() => setPanelTab('images')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              panelTab === 'images'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            图片
          </button>
          <button
            onClick={() => setPanelTab('video')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              panelTab === 'video'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            视频
          </button>
        </div>

        {/* 右侧：分组筛选（仅在图片tab显示） */}
        {panelTab === 'images' && (
          <div className="flex items-center gap-1">
            {[
              { key: 'all', label: '全部', count: groupCounts.all },
              { key: 'group1', label: '【对话】', count: groupCounts.group1 },
              { key: 'group2', label: '【地点】', count: groupCounts.group2 }
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setSelectedGroup(key as any)}
                className={`px-1.5 py-0.5 text-[11px] rounded transition-all ${
                  selectedGroup === key
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 视频 Tab */}
      <div className={`flex-1 min-h-0 overflow-y-auto flex flex-col bg-gray-50 scrollbar-thin ${panelTab === 'video' ? '' : 'hidden'}`}>
          {activeVideo && videoSrc ? (
            <>
              <video
                ref={videoRef}
                src={videoSrc}
                controls
                className="w-full object-contain shrink-0 max-h-[55vh] bg-gray-900"
              />
              {/* 截取按钮 */}
              {onCaptureFrame && (
                <div className="shrink-0 bg-white px-2 py-1.5 flex justify-end">
                  <button
                    onClick={handleCaptureFrame}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
                  >
                    <Scissors className="w-3 h-3" />
                    截取当前帧
                  </button>
                </div>
              )}
              {cropRoi && (
                <div className="shrink-0 bg-white p-2">
                  <canvas
                    ref={cropCanvasRef}
                    className="w-full rounded block border border-gray-200"
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              <div className="text-center">
                <Video className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>请先上传视频</p>
              </div>
            </div>
          )}
        </div>

      {/* 图片 Tab */}
      <div className={panelTab === 'images' ? 'flex-1 min-h-0 flex flex-col' : 'hidden'}>
      {/* 工具栏：操作按钮 + 每页数量 */}
      <div className="border-b border-gray-200 px-2 py-1.5 bg-gray-50 shrink-0">
        <div className="flex items-center justify-between gap-2">
          {/* 左侧：选择操作 */}
          <div className="flex items-center gap-1.5">
            <button 
              onClick={selectAll}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200 rounded transition-colors"
              title="全选"
            >
              {(() => {
                const allCurrentItemsSelected = filteredFrames.length > 0 && filteredFrames.every(item => selectedIds.has(item.id));
                return allCurrentItemsSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />;
              })()}
            </button>
            
            {selectedIds.size > 0 && (
              <>
                <span className="text-xs text-indigo-600 font-medium">
                  已选 {selectedCountInView}
                </span>
                <button 
                  onClick={() => setSelectedIds(new Set())}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-white bg-gray-600 rounded hover:bg-gray-700 transition-colors"
                  title="取消选择"
                >
                  <X className="w-3 h-3" />
                </button>
                <button 
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                  title="删除选中"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>

          {/* 右侧：统计 + 每页数量 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              共 {filteredFrames.length} 张
            </span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            >
              <option value={20}>20/页</option>
              <option value={50}>50/页</option>
              <option value={100}>100/页</option>
            </select>
          </div>
        </div>
      </div>

      {/* 图片列表 - 每行一张 */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-auto space-y-1.5 px-2 pb-2 scrollbar-thin">
        {currentItems.map((frame) => {
          const isSelected = selectedIds.has(frame.id);
          const isReferenceFrame = selectedReferenceFrameId === frame.id;
          
          return (
            <div 
              key={frame.id}
              ref={(node) => {
                if (node) {
                  frameItemRefs.current.set(frame.id, node);
                } else {
                  frameItemRefs.current.delete(frame.id);
                }
              }}
              onClick={() => toggleSelect(frame.id)}
              className={`group relative border transition-all cursor-pointer overflow-hidden rounded-lg ${
                isSelected 
                  ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' 
                  : 'border-gray-200 bg-white hover:border-indigo-300'
              }`}
            >
              <div className="relative bg-gray-100 overflow-hidden flex items-center justify-center min-h-[80px]">
                <img 
                  src={frame.url} 
                  alt={frame.filename} 
                  className="w-full object-contain group-hover:scale-105 transition-transform duration-300 max-h-[200px]"
                />
                <div className="absolute inset-0 bg-gray-900 opacity-0 group-hover:opacity-5 transition-opacity" />
                
                {/* 悬浮按钮 */}
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onSelectReferenceFrame && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectReferenceFrame(frame);
                      }}
                      className={`px-2 py-1 backdrop-blur rounded-full text-[10px] font-medium shadow-sm transition-colors ${
                        isReferenceFrame
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-white/80 text-emerald-700 hover:bg-white'
                      }`}
                      title="设为头像参考图"
                    >
                      {isReferenceFrame ? '参考中' : '设为参考'}
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedInfoItem(frame);
                    }}
                    className="p-1 bg-white/80 backdrop-blur rounded-full text-slate-600 hover:bg-white shadow-sm"
                    title="查看图片详情"
                  >
                    <Info className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const ts = frame.timestamp;
                      const parts = ts.split(':');
                      if (parts.length === 3 && activeVideo) {
                        const hours = parseInt(parts[0]);
                        const minutes = parseInt(parts[1]);
                        const secParts = parts[2].split('.');
                        const seconds = parseInt(secParts[0]);
                        const ms = secParts[1] ? parseInt(secParts[1]) : 0;
                        const totalSeconds = hours * 3600 + minutes * 60 + seconds + ms / 1000;
                        setPanelTab('video');
                        // 同时同步本地视频和 sharedVideoRef（字幕截取区域）
                        setTimeout(() => {
                          lastTimeRef.current = totalSeconds;
                          if (videoRef.current) {
                            videoRef.current.currentTime = totalSeconds;
                          }
                          if (sharedVideoRef?.current) {
                            sharedVideoRef.current.currentTime = totalSeconds;
                          }
                        }, 50);
                      } else if (onJumpToTime) {
                        onJumpToTime(ts);
                      }
                    }}
                    className="p-1 bg-white/80 backdrop-blur rounded-full text-indigo-600 hover:bg-white shadow-sm"
                    title="跳转到视频时间点"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                
                {/* 选中标记 */}
                {isSelected && (
                  <div className="absolute top-1 left-1 bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
                    ✓
                  </div>
                )}
                {isReferenceFrame && (
                  <div className="absolute bottom-1 left-1 rounded-full bg-emerald-600/95 px-2 py-0.5 text-[10px] font-medium text-white shadow-lg">
                    头像参考
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部分页 */}
      {totalPages > 1 && (
        <div className="border-t border-gray-200 pt-1.5 px-2 pb-1.5 shrink-0">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
            >
              上一页
            </button>
            
            <span className="text-xs text-gray-700 font-medium">
              {currentPage} / {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* 空状态 */}
      {filteredFrames.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-center py-8 px-2">
          <div>
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Upload className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">
              {selectedGroup === 'all' ? '暂无截取结果' : `${selectedGroup === 'group1' ? '【对话】' : '【地点】'}暂无截取结果`}
            </p>
          </div>
        </div>
      )}
      </div>

      {/* 图片详情侧边栏 */}
      {selectedInfoItem && (
        <ImageInfoPanel
          item={selectedInfoItem}
          viewType="frames"
          onClose={() => setSelectedInfoItem(null)}
        />
      )}
    </div>
  );
};

export default CompactGallery;
