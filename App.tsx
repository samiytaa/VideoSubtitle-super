import {
  CheckCircle2,
  Crop,
  History,
  Image as ImageIcon,
  LayoutGrid,
  Loader,
  Video,
  FileCheck
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NotificationProvider, useNotifier } from './components/Notifications';
import QuickProcessPanel from './components/QuickProcessPanel';
import ProcessingView from './components/ProcessingView';
import ResultGallery from './components/ResultGallery';
import CompactGallery from './components/CompactGallery';
import ResizablePanel from './components/ResizablePanel';
import RoiSelector from './components/RoiSelector';

import TextProofreader from './components/FormatConverter';
import TextProofreader2 from './components/TextProofreader2';
import { ExtractedFrame, ExtractionMode, ExtractionParams, MergedImage, ROI, RoiPreset, VideoFile } from './types';
import { batchMergeImages } from './utils/imageUtils';
import {
  loadExtractedFrames,
  loadMergedImages,
  saveExtractedFrames,
  saveMergedImages
} from './utils/storageUtils';

type Tab = 'extract' | 'gallery' | 'proofread' | 'proofread2';

// 左侧面板组件（可收起的截取结果）
const LeftPanel: React.FC<{
  frames: ExtractedFrame[];
  mergedImages: MergedImage[];
  onMerge: (selectedFrames: ExtractedFrame[], batchSize: number) => void;
  onOneClickRecognize?: () => void;
  onDelete?: (ids: string[]) => void;
  onDeleteMerged?: (ids: string[]) => void;
  onClearMerged?: () => void;
  onClearAll?: () => void;
  onImportFrames?: (frames: ExtractedFrame[]) => void;
  onImportMerged?: (images: MergedImage[]) => void;
  onMergeGroups?: (sourceGroup: 'group1' | 'group2', targetGroup: 'group1' | 'group2') => void;
  onJumpToTime?: (timestamp: string) => void;
}> = (props) => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  return (
    <div 
      className={`bg-white rounded-2xl shadow-sm border border-gray-100 transition-all duration-300 min-h-[600px] ${
        isCollapsed ? 'w-12' : 'w-[480px]'
      }`}
    >
      {isCollapsed ? (
        // 收起状态：只显示展开按钮
        <div className="h-full flex flex-col items-center justify-start pt-6">
          <button
            onClick={() => setIsCollapsed(false)}
            className="p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg"
            title="展开截取结果"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
          <div className="mt-4 [writing-mode:vertical-rl] text-sm font-medium text-gray-500">
            截取结果
          </div>
        </div>
      ) : (
        // 展开状态：显示完整内容
        <div className="h-full flex flex-col">
          {/* 标题栏 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-gray-800">截取结果</h3>
            </div>
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
              title="收起面板"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>
          
          {/* 内容区域 */}
          <div className="flex-1 overflow-auto p-4">
            <ResultGallery {...props} />
          </div>
        </div>
      )}
    </div>
  );
};

// Placeholder Component for Inactive Sections
const SectionPlaceholder: React.FC<{ icon: any, title: string, message: string }> = ({ icon: Icon, title, message }) => (
  <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center flex flex-col items-center justify-center h-full min-h-[300px] text-gray-400 transition-all">
    <div className="bg-white p-4 rounded-full mb-4 shadow-sm">
      <Icon className="w-8 h-8 text-gray-300" />
    </div>
    <h3 className="text-lg font-bold text-gray-500 mb-1">{title}</h3>
    <p className="text-sm">{message}</p>
  </div>
);

const App: React.FC = () => {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
};

const AppContent: React.FC = () => {
  const notifier = useNotifier();
  const [activeTab, setActiveTab] = useState<Tab>('extract');

  // State
  const [activeVideo, setActiveVideo] = useState<VideoFile | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  // 维护稳定的 video object URL
  React.useEffect(() => {
    if (!activeVideo?.file) { setVideoSrc(null); return; }
    const url = URL.createObjectURL(activeVideo.file);
    setVideoSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [activeVideo?.file]);
  const [roi, setRoi] = useState<ROI>({ x: 10, y: 80, width: 80, height: 15 });
  const [params, setParams] = useState<ExtractionParams>({
    mode: ExtractionMode.SRT,
    interval: 1.0,
    startTime: 0,
    endTime: 0,
    maxFrames: 500,
    clearFolder: true,
    prefix: 'v',
    minSrtGapDuration: 1.5,
    framesBeforeEnd: 5,
    srtNonSubtitleInterval: 0.5,
    srtNonSubtitleFrameInterval: 15,
    skipSubtitleRegions: false,
    autoDeduplication: true,
  });
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([]);
  const extractedFramesRef = useRef<ExtractedFrame[]>([]); // 添加 ref 来保存最新的 frames
  
  // 同步 state 到 ref
  useEffect(() => {
    extractedFramesRef.current = extractedFrames;
  }, [extractedFrames]);
  const [mergedImages, setMergedImages] = useState<MergedImage[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Workflow state
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number; message: string; stage?: 'extracting' | 'deduplicating' }>({ current: 0, total: 100, message: '', stage: 'extracting' });
  const [processingKey, setProcessingKey] = useState(0); // 用于强制重新挂载 ProcessingView
  
  // 全部处理模式的下一步信息
  const [nextStepInfo, setNextStepInfo] = useState<{ preset: RoiPreset; srtFile: File | null; frameInterval?: number; timeRange: { startTime: number; endTime: number }; isBothMode: boolean; autoDeduplicationLocation: boolean; autoDeduplicationDialogue: boolean; skipSubtitleLocation?: boolean } | null>(null);
  // 用 ref 保存最新值，避免 ProcessingView 的 onComplete 闭包读到旧值
  const nextStepInfoRef = useRef<typeof nextStepInfo>(null);

  // Refs for scrolling
  const sectionUploadRef = useRef<HTMLDivElement>(null);
  const sectionRoiRef = useRef<HTMLDivElement>(null);
  const sectionProcessRef = useRef<HTMLDivElement>(null);
  const sectionResultRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null); // 新增：视频元素引用

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // 从 IndexedDB 加载数据
  React.useEffect(() => {
    const loadData = async () => {
      try {
        const [frames, images] = await Promise.all([
          loadExtractedFrames(),
          loadMergedImages()
        ]);

        if (frames.length > 0 || images.length > 0) {
          console.log(`从 IndexedDB 恢复数据: ${frames.length} 张截取图片, ${images.length} 张拼接图片`);
        }

        setExtractedFrames(frames);
        setMergedImages(images);
        setIsDataLoaded(true);
      } catch (error) {
        console.error('Failed to load data from IndexedDB:', error);
        setIsDataLoaded(true);
      }
    };
    loadData();
  }, []);

  // 用 token 防止旧的异步保存覆盖新数据
  const saveFramesTokenRef = useRef(0);
  const saveMergedTokenRef = useRef(0);

  // 保存 extractedFrames 到 IndexedDB
  React.useEffect(() => {
    if (!isDataLoaded) return;
    const token = ++saveFramesTokenRef.current;
    const snapshot = extractedFrames;
    const saveData = async () => {
      try {
        await saveExtractedFrames(snapshot);
        // 如果在等待期间又有新的保存发起，则丢弃本次结果
        if (token !== saveFramesTokenRef.current) return;
      } catch (error) {
        console.error('Failed to save extracted frames to IndexedDB:', error);
      }
    };
    saveData();
  }, [extractedFrames, isDataLoaded]);

  // 保存 mergedImages 到 IndexedDB
  React.useEffect(() => {
    if (!isDataLoaded) return;
    const token = ++saveMergedTokenRef.current;
    const snapshot = mergedImages;
    const saveData = async () => {
      try {
        await saveMergedImages(snapshot);
        if (token !== saveMergedTokenRef.current) return;
      } catch (error) {
        console.error('Failed to save merged images to IndexedDB:', error);
      }
    };
    saveData();
  }, [mergedImages, isDataLoaded]);

  const handleVideoUploaded = async (video: VideoFile) => {
    // 如果已有截取的图片，询问用户是否清空
    if (extractedFrames.length > 0) {
      const shouldClear = await notifier.showConfirm({
        title: '上传新视频',
        message: `当前已有 ${extractedFrames.length} 张截取的图片。\n\n上传新视频后是否清空这些图片？`
      });

      if (shouldClear) {
        setExtractedFrames([]);
      }
    }

    setActiveVideo(video);
    setIsProcessing(false);
    setIsCompleted(false);

    setParams(prev => ({ ...prev, startTime: 0, endTime: video.duration }));
    scrollTo(sectionRoiRef);
  };

  const handleRoiSet = useCallback((newRoi: ROI, timeRange?: { startTime: number; endTime: number }, skipSubtitleRegions?: boolean) => {
    setRoi(newRoi);
    if (timeRange) {
      setParams(prev => ({
        ...prev,
        startTime: timeRange.startTime,
        endTime: timeRange.endTime,
        ...(skipSubtitleRegions !== undefined && { skipSubtitleRegions })
      }));
    }
  }, []);

  const handleFrameCaptured = useCallback((frame: ExtractedFrame) => {
    setExtractedFrames(prev => [...prev, frame]);
    // 不设置 isCompleted，避免触发批量处理流程
  }, []);

  const handleParamsSet = (newParams: ExtractionParams, appendMode: boolean = false) => {
    setParams(newParams);
    setIsProcessing(true);
    setIsCompleted(false);
    setProcessingProgress({ current: 0, total: 100, message: '准备开始...', stage: 'extracting' });
    setProcessingKey(prev => prev + 1); // 强制重新挂载 ProcessingView
    if (!appendMode) {
      setExtractedFrames([]); // clear previous only if not in append mode
    }
  };

  // 一键处理：根据 SRT + 坐标预设 + 当前时间范围，使用默认参数直接开始截取
  const handleQuickProcess = async (options: { 
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
  }) => {
    if (!activeVideo) {
      notifier.addToast('请先上传视频，再使用一键处理功能', 'warning');
      return;
    }

    const { srtFile, dialoguePreset, locationPreset, timeRange, captureType, autoDeduplicationDialogue, autoDeduplicationLocation, frameInterval, skipSubtitleDialogue, skipSubtitleLocation } = options;
    const useSrt = !!srtFile;

    // 检查是否有已存在的图片
    if (extractedFrames.length > 0) {
      const shouldClear = await notifier.showConfirm({
        title: '开始一键处理',
        message: `当前已有 ${extractedFrames.length} 张截取的图片。\n\n是否先清空这些图片再开始处理？`
      });

      if (shouldClear) {
        setExtractedFrames([]);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // 构建基础参数（SRT 或 FRAME 模式）
    const buildParams = (group: 'group1' | 'group2', skipSubtitle: boolean, autoDedup: boolean): ExtractionParams => {
      if (useSrt) {
        return {
          ...params,
          mode: ExtractionMode.SRT,
          srtFile: srtFile!,
          startTime: timeRange.startTime,
          endTime: timeRange.endTime,
          selectedGroup: group,
          skipSubtitleRegions: skipSubtitle,
          autoDeduplication: autoDedup,
        };
      } else {
        return {
          ...params,
          mode: ExtractionMode.FRAME,
          srtFile: undefined,
          interval: frameInterval ?? 30,
          startTime: timeRange.startTime,
          endTime: timeRange.endTime,
          selectedGroup: group,
          skipSubtitleRegions: false,
          autoDeduplication: autoDedup,
        };
      }
    };

    if (captureType === 'both') {
      notifier.addToast(`开始一键处理：先对话，再地点${useSrt ? '' : '（固定帧间隔）'}`, 'info');
      console.log('一键处理参数:', { autoDeduplicationDialogue, autoDeduplicationLocation, useSrt, frameInterval });

      if (locationPreset) {
        const nextInfo = {
          preset: locationPreset,
          srtFile,
          frameInterval,
          timeRange,
          isBothMode: true,
          autoDeduplicationLocation,
          autoDeduplicationDialogue,
          skipSubtitleLocation: skipSubtitleLocation ?? true,
        };
        setNextStepInfo(nextInfo);
        nextStepInfoRef.current = nextInfo; // 同步 ref，确保 onComplete 闭包能读到最新值
      }

      if (dialoguePreset) {
        const newRoi: ROI = {
          x: dialoguePreset.x_ratio * 100,
          y: dialoguePreset.y_ratio * 100,
          width: dialoguePreset.w_ratio * 100,
          height: dialoguePreset.h_ratio * 100,
        };
        setRoi(newRoi);
        await new Promise(resolve => setTimeout(resolve, 100));
        handleParamsSet(buildParams('group1', useSrt && (skipSubtitleDialogue ?? false), false), false);
        notifier.addToast('正在处理对话截图...', 'info');
      }
    } else {
      setNextStepInfo(null);
      nextStepInfoRef.current = null;

      const preset = captureType === 'dialogue' ? dialoguePreset : locationPreset;
      if (!preset) return;

      const newRoi: ROI = {
        x: preset.x_ratio * 100,
        y: preset.y_ratio * 100,
        width: preset.w_ratio * 100,
        height: preset.h_ratio * 100,
      };
      setRoi(newRoi);
      await new Promise(resolve => setTimeout(resolve, 100));

      const autoDedup = captureType === 'dialogue' ? autoDeduplicationDialogue : autoDeduplicationLocation;
      const skipSub = captureType === 'dialogue'
        ? (useSrt && (skipSubtitleDialogue ?? false))
        : (useSrt && (skipSubtitleLocation ?? true));
      handleParamsSet(buildParams(captureType === 'dialogue' ? 'group1' : 'group2', skipSub, autoDedup), false);
      notifier.addToast(`已开始一键处理${captureType === 'dialogue' ? '对话' : '地点'}截图${useSrt ? '' : '（固定帧间隔）'}`, 'success');
    }
  };

  const handleProcessingProgress = useCallback((progress: { current: number; total: number; message: string }) => {
    // 根据当前处理的分组添加标识
    let enhancedMessage = progress.message;
    if (params.selectedGroup === 'group1') {
      enhancedMessage = progress.message.includes('对话') ? progress.message : `截取对话 - ${progress.message}`;
    } else if (params.selectedGroup === 'group2') {
      enhancedMessage = progress.message.includes('地点') ? progress.message : `截取地点 - ${progress.message}`;
    }
    setProcessingProgress({ ...progress, message: enhancedMessage, stage: 'extracting' });
  }, [params.selectedGroup]);

  const handleProcessingComplete = async (results: ExtractedFrame[]) => {
    setExtractedFrames(prev => [...prev, ...results]); // 追加新结果
    
    // 截取完成，显示100%
    setProcessingProgress({ current: 100, total: 100, message: '截取完成！', stage: 'extracting' });
    
    // 检查是否需要继续处理下一步（全部处理模式）
    // 使用 ref 读取最新值，避免闭包捕获旧的 state
    const currentNextStepInfo = nextStepInfoRef.current;
    if (currentNextStepInfo && currentNextStepInfo.preset) {
      notifier.addToast('对话截取完成，开始截取地点...', 'info');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 更新 ROI 为地点预设的坐标
      const locationPreset = currentNextStepInfo.preset;
      const newRoi: ROI = {
        x: locationPreset.x_ratio * 100,
        y: locationPreset.y_ratio * 100,
        width: locationPreset.w_ratio * 100,
        height: locationPreset.h_ratio * 100
      };
      setRoi(newRoi);
      
      // 等待 ROI 更新完成
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 处理地点
      const locationParams: ExtractionParams = currentNextStepInfo.srtFile
        ? {
            ...params,
            mode: ExtractionMode.SRT,
            srtFile: currentNextStepInfo.srtFile,
            startTime: currentNextStepInfo.timeRange.startTime,
            endTime: currentNextStepInfo.timeRange.endTime,
            selectedGroup: 'group2',
            skipSubtitleRegions: currentNextStepInfo.skipSubtitleLocation ?? true,
            autoDeduplication: false,
          }
        : {
            ...params,
            mode: ExtractionMode.FRAME,
            srtFile: undefined,
            interval: currentNextStepInfo.frameInterval ?? 30,
            startTime: currentNextStepInfo.timeRange.startTime,
            endTime: currentNextStepInfo.timeRange.endTime,
            selectedGroup: 'group2',
            skipSubtitleRegions: false,
            autoDeduplication: false,
          };
      
      // 保存去重配置，用于后续去重
      const savedDeduplicationConfig = {
        dialogue: currentNextStepInfo.autoDeduplicationDialogue || false,
        location: currentNextStepInfo.autoDeduplicationLocation || false
      };
      
      console.log('保存去重配置:', savedDeduplicationConfig);
      
      // 清除下一步信息
      setNextStepInfo(null);
      nextStepInfoRef.current = null;
      
      // 标记需要在完成后进行去重
      (window as any).__pendingDeduplication = savedDeduplicationConfig;
      
      handleParamsSet(locationParams, true); // 使用追加模式，保留对话截图
      return; // 不设置 isProcessing = false，继续处理
    }
    
    // 检查是否有待处理的去重任务
    const pendingDedup = (window as any).__pendingDeduplication;
    if (pendingDedup) {
      delete (window as any).__pendingDeduplication;
      
      console.log('去重配置:', pendingDedup);
      
      // 延迟一下，让用户看到截取完成
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 依次去重：先对话，再地点
      if (pendingDedup.dialogue) {
        console.log('开始对话去重');
        await performDeduplication('group1', '【对话】');
      }
      
      if (pendingDedup.location) {
        console.log('开始地点去重');
        await performDeduplication('group2', '【地点】');
      }
    } else if (params.mode === ExtractionMode.SRT && params.selectedGroup && params.autoDeduplication !== false) {
      // 单独处理模式的去重
      const targetGroup = params.selectedGroup;
      const groupLabel = targetGroup === 'group1' ? '【对话】' : '【地点】';
      
      console.log('单独模式去重:', targetGroup, groupLabel);
      
      // 延迟一下，让用户看到截取完成
      await new Promise(resolve => setTimeout(resolve, 800));
      
      await performDeduplication(targetGroup, groupLabel);
    }
    
    // 全部处理完成
    setIsProcessing(false);
    setIsCompleted(true);
    setProcessingProgress({ current: 0, total: 0, message: '', stage: 'extracting' });
    scrollTo(sectionResultRef);
  };
  
  // 提取去重逻辑为独立函数
  const performDeduplication = async (targetGroup: 'group1' | 'group2', groupLabel: string) => {
    // 等待下一个事件循环，避免在渲染期间更新状态
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 使用 ref 获取最新的 extractedFrames
    const currentFrames = extractedFramesRef.current;
    const targetFrames = currentFrames.filter(f => f.group === targetGroup);
    
    console.log(`去重${groupLabel}:`, targetFrames.length, '张图片');
    
    if (targetFrames.length <= 1) {
      console.log(`${groupLabel}图片数量不足，跳过去重`);
      return;
    }
    
    notifier.addToast(`开始自动去重${groupLabel}分组...`, 'info');
    setProcessingProgress({ current: 0, total: 100, message: `正在去重${groupLabel}分组...`, stage: 'deduplicating' });
    
    try {
      const { removeDuplicatesLoop } = await import('./utils/imageComparisonUtils');
      
      const imageUrls = targetFrames.map(f => f.url);
      let totalRemoved = 0;
      
      // 循环去重，直到移除的重复图片小于1张（去重到无法再去重）
      const keepIndices = await removeDuplicatesLoop(
        imageUrls,
        0.95,
        1,
        (current, total, iteration, removed) => {
          totalRemoved = removed;
          const percent = Math.round((current / total) * 100);
          setProcessingProgress({
            current: percent,
            total: 100,
            message: `去重${groupLabel} - 第${iteration}轮 (${current}/${total}) - 已移除${removed}张`,
            stage: 'deduplicating'
          });
        }
      );
      
      // 计算要删除的图片
      const allIndices = new Set(targetFrames.map((_, i) => i));
      const keepIndicesSet = new Set(keepIndices);
      const deleteIndices = Array.from(allIndices).filter((i: number) => !keepIndicesSet.has(i));
      
      if (deleteIndices.length > 0) {
        const idsToDelete = deleteIndices.map(i => targetFrames[i].id);
        setExtractedFrames(prev => prev.filter(frame => !idsToDelete.includes(frame.id)));
        setProcessingProgress({ current: 100, total: 100, message: `去重${groupLabel}完成！已删除 ${deleteIndices.length} 张`, stage: 'deduplicating' });
        await new Promise(resolve => setTimeout(resolve, 1000));
        notifier.addToast(
          `${groupLabel}自动去重完成！已删除 ${deleteIndices.length} 张重复图片，保留 ${keepIndices.length} 张`,
          'success'
        );
      } else {
        setProcessingProgress({ current: 100, total: 100, message: `去重${groupLabel}完成 - 未发现重复`, stage: 'deduplicating' });
        await new Promise(resolve => setTimeout(resolve, 1000));
        notifier.addToast(`${groupLabel}未发现重复图片`, 'info');
      }
    } catch (error) {
      console.error('自动去重失败:', error);
      notifier.addToast(`${groupLabel}自动去重失败，请手动去重`, 'error');
    }
  };

  const handleDeleteFrames = useCallback((ids: string[]) => {
    setExtractedFrames(prev => prev.filter(frame => !ids.includes(frame.id)));
  }, []);

  const handleImportFrames = useCallback((frames: ExtractedFrame[]) => {
    setExtractedFrames(prev => [...prev, ...frames]);
  }, []);

  const handleImportMerged = useCallback((images: MergedImage[]) => {
    setMergedImages(prev => [...prev, ...images]);
  }, []);

  const handleMergeGroups = useCallback((sourceGroup: 'group1' | 'group2', targetGroup: 'group1' | 'group2') => {
    if (sourceGroup === targetGroup) return;

    setExtractedFrames(prev => prev.map(frame => {
      if (frame.group === sourceGroup) {
        // 只更新分组，不修改文件名
        return {
          ...frame,
          group: targetGroup
        };
      }
      return frame;
    }));
  }, []);

  // 新增：跳转到视频时间点
  const handleJumpToTime = useCallback((timestamp: string) => {
    // 解析时间戳 HH:MM:SS.mmm
    const parts = timestamp.split(':');
    if (parts.length !== 3) return;

    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const secondsParts = parts[2].split('.');
    const seconds = parseInt(secondsParts[0]);
    const milliseconds = secondsParts[1] ? parseInt(secondsParts[1]) : 0;

    const totalSeconds = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;

    // 切换到字幕截取标签页
    setActiveTab('extract');

    // 滚动到 ROI 选择区域
    setTimeout(() => {
      scrollTo(sectionRoiRef);

      // 如果视频元素存在，跳转到指定时间
      if (videoElementRef.current) {
        videoElementRef.current.currentTime = totalSeconds;
        notifier.addToast(`已跳转到 ${timestamp}`, 'success');
      }
    }, 300);
  }, [notifier]);

  const mergeFramesToImages = useCallback(async (selectedFrames: ExtractedFrame[], batchSize: number = 10) => {
    if (selectedFrames.length === 0) return [] as MergedImage[];

    try {
      const { parseTimestampFilename } = await import('./utils/filenameUtils');

      const sortedFrames = [...selectedFrames].sort((a, b) => {
        const timeA = parseTimestampFilename(a.filename) || 0;
        const timeB = parseTimestampFilename(b.filename) || 0;

        if (timeA !== timeB) {
          return timeA - timeB;
        }

        const hasG2PrefixA = a.filename.startsWith('g2_');
        const hasG2PrefixB = b.filename.startsWith('g2_');

        if (hasG2PrefixA && !hasG2PrefixB) return -1;
        if (!hasG2PrefixA && hasG2PrefixB) return 1;

        return 0;
      });

      const imageUrls = sortedFrames.map(frame => frame.url);
      const mergedUrls = await batchMergeImages(imageUrls, batchSize, {
        alignment: 'center',
        backgroundColor: '#000000',
        gap: 0
      });

      const timestamp = new Date().getTime();
      const newMergedImages: MergedImage[] = mergedUrls.map((url, index) => ({
        id: `merged_${timestamp}_${index}`,
        url,
        width: 0,
        height: 0,
        filename: `merged_batch${index + 1}_${timestamp}.png`
      }));

      await Promise.all(
        newMergedImages.map((merged) => {
          return new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              merged.width = img.width;
              merged.height = img.height;
              resolve();
            };
            img.src = merged.url;
          });
        })
      );

      return newMergedImages;
    } catch (error) {
      console.error('Merge failed:', error);
      return [];
    }
  }, []);

  const handleMergeImages = useCallback(async (selectedFrames: ExtractedFrame[], batchSize: number = 10) => {
    const newMergedImages = await mergeFramesToImages(selectedFrames, batchSize);
    if (newMergedImages.length === 0) return;

    setMergedImages(prev => [...prev, ...newMergedImages]);
  }, [mergeFramesToImages]);

  const handleOneClickRecognize = useCallback(async () => {
    if (extractedFrames.length === 0) return;

    const mergedFrames = extractedFrames.map((frame) =>
      frame.group === 'group2'
        ? { ...frame, group: 'group1' as const }
        : frame
    );

    setExtractedFrames(mergedFrames);

    const newMergedImages = await mergeFramesToImages(mergedFrames, 10);
    if (newMergedImages.length === 0) return;

    setMergedImages(prev => [...prev, ...newMergedImages]);
    notifier.addToast('已完成一键识别：先合并分组，再按默认参数完成图片拼接', 'success');
  }, [extractedFrames, mergeFramesToImages, notifier]);

  const handleClearAllData = useCallback(async () => {
    const totalCount = extractedFrames.length + mergedImages.length;
    if (totalCount === 0) return;

    const confirmed = await notifier.showConfirm({
      title: '⚠️ 清空所有数据',
      message: `确定要清空所有数据吗？\n\n这将删除：\n• ${extractedFrames.length} 张截取的图片\n• ${mergedImages.length} 张拼接的图片\n\n此操作不可恢复！`
    });

    if (confirmed) {
      setExtractedFrames([]);
      setMergedImages([]);
      notifier.addToast('已清空所有数据', 'success');
      // IndexedDB 会通过 useEffect 自动清空
    }
  }, [extractedFrames.length, mergedImages.length, notifier]);

  return (
    <>
      {!isDataLoaded && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-gray-100 bg-white p-8 shadow-xl">
            <Loader className="w-9 h-9 text-indigo-600 animate-spin" />
            <div className="text-center">
              <h3 className="text-sm font-semibold text-gray-900 mb-0.5">正在加载数据</h3>
              <p className="text-xs text-gray-400">从本地存储恢复图片...</p>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen flex flex-col bg-slate-50">
        <header className="bg-white border-b border-gray-200/60 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-10 items-center">
              <div className="flex items-center gap-2">
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-1.5 rounded-md shadow-sm">
                  <Video className="text-white w-4 h-4" />
                </div>
                <h1 className="text-lg font-semibold text-gray-900 hidden sm:block">视频字幕截取工具</h1>
              </div>

              <nav className="flex space-x-1">
                <button
                  onClick={() => !isProcessing && setActiveTab('extract')}
                  disabled={isProcessing && activeTab !== 'extract'}
                  title={isProcessing && activeTab !== 'extract' ? '处理中，请等待完成后再切换' : undefined}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'extract' ? 'bg-indigo-50 text-indigo-700' : isProcessing ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
                >
                  <span className="flex items-center gap-1.5"><ImageIcon className="w-4 h-4" /> 字幕截取</span>
                </button>
                <button
                  onClick={() => !isProcessing && setActiveTab('gallery')}
                  disabled={isProcessing}
                  title={isProcessing ? '处理中，请等待完成后再切换' : undefined}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'gallery' ? 'bg-indigo-50 text-indigo-700' : isProcessing ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
                >
                  <span className="flex items-center gap-1.5"><LayoutGrid className="w-4 h-4" /> 查看图片</span>
                </button>

                <button
                  onClick={() => !isProcessing && setActiveTab('proofread')}
                  disabled={isProcessing}
                  title={isProcessing ? '处理中，请等待完成后再切换' : undefined}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'proofread' ? 'bg-indigo-50 text-indigo-700' : isProcessing ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
                >
                  <span className="flex items-center gap-1.5"><FileCheck className="w-4 h-4" /> 文本转换</span>
                </button>
                <button
                  onClick={() => !isProcessing && setActiveTab('proofread2')}
                  disabled={isProcessing}
                  title={isProcessing ? '处理中，请等待完成后再切换' : undefined}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'proofread2' ? 'bg-indigo-50 text-indigo-700' : isProcessing ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
                >
                  <span className="flex items-center gap-1.5"><FileCheck className="w-4 h-4" /> 文本校对</span>
                </button>
              </nav>
            </div>
          </div>
        </header>

        <main className={`flex-grow w-full ${activeTab === 'proofread2' ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'}`}>
          {activeTab === 'extract' && (
            <div className="pb-20">
              {/* Upload & ROI Selection + 一键处理（合并为一个卡片） */}
              <section ref={sectionUploadRef} className="scroll-mt-20">
                <div ref={sectionRoiRef} className="bg-white rounded-xl shadow-sm border border-gray-200/60 overflow-hidden">
                  <div>
                  <RoiSelector
                    video={activeVideo}
                    videoSrc={videoSrc}
                    onConfirm={handleRoiSet}
                    onFrameCaptured={handleFrameCaptured}
                    videoRef={videoElementRef}
                    onQuickProcess={handleQuickProcess}
                    isProcessing={isProcessing}
                    progress={processingProgress}
                    onUpload={handleVideoUploaded}
                    onClearVideo={() => setActiveVideo(null)}
                    onReplaceVideo={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'video/*';
                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          const getVideoMetadata = (file: File): Promise<VideoFile> => {
                            return new Promise((resolve, reject) => {
                              const url = URL.createObjectURL(file);
                              const video = document.createElement('video');
                              video.preload = 'auto';
                              video.muted = true;
                              const onLoadedData = () => {
                                if (!isFinite(video.duration) || video.duration === 0) return;
                                cleanup();
                                resolve({ id: Math.random().toString(36).substr(2, 9), file, name: file.name, size: file.size, duration: video.duration, width: video.videoWidth, height: video.videoHeight, previewUrl: url });
                              };
                              const onDurationChange = () => {
                                if (isFinite(video.duration) && video.duration > 0) {
                                  cleanup();
                                  resolve({ id: Math.random().toString(36).substr(2, 9), file, name: file.name, size: file.size, duration: video.duration, width: video.videoWidth, height: video.videoHeight, previewUrl: url });
                                }
                              };
                              const onError = () => { cleanup(); reject(new Error(`Failed to load video metadata for ${file.name}`)); URL.revokeObjectURL(url); };
                              const cleanup = () => { video.removeEventListener('loadeddata', onLoadedData); video.removeEventListener('durationchange', onDurationChange); video.removeEventListener('error', onError); };
                              video.addEventListener('loadeddata', onLoadedData);
                              video.addEventListener('durationchange', onDurationChange);
                              video.addEventListener('error', onError);
                              video.src = url;
                              video.load();
                            });
                          };
                          try {
                            const videoData = await getVideoMetadata(file);
                            handleVideoUploaded(videoData);
                          } catch (error) {
                            console.error('Error processing video:', error);
                            notifier.addToast('无法读取视频文件，请确保文件格式正确。', 'error');
                          }
                        }
                      };
                      input.click();
                    }}
                  />
                  </div>
                  {/* 一键处理 */}
                  <div>
                    <QuickProcessPanel
                      video={activeVideo}
                      timeRange={{ startTime: params.startTime, endTime: params.endTime }}
                      isProcessing={isProcessing}
                      progress={processingProgress}
                      onConfirm={(file, dialoguePreset, locationPreset, timeRange, captureType, autoDeduplicationDialogue, autoDeduplicationLocation, frameInterval, skipSubtitleDialogue, skipSubtitleLocation) => {
                        handleQuickProcess({ srtFile: file, dialoguePreset, locationPreset, timeRange, captureType, autoDeduplicationDialogue, autoDeduplicationLocation, frameInterval, skipSubtitleDialogue, skipSubtitleLocation });
                      }}
                    />
                  </div>
                </div>
              </section>

              {/* Hidden Processing View - 常驻组件，通过 taskId 触发新任务，避免重复加载视频/SRT */}
              {activeVideo && (
                <div className="hidden">
                  <ProcessingView
                    video={activeVideo}
                    videoSrc={videoSrc}
                    roi={roi}
                    params={params}
                    taskId={processingKey}
                    onComplete={handleProcessingComplete}
                    onProgress={handleProcessingProgress}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'gallery' && (
            <div className="pb-20">
              {/* 查看图片区域 */}
              <section className="scroll-mt-20">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 p-6">
                  <ResultGallery
                    frames={extractedFrames}
                    mergedImages={mergedImages}
                    onMerge={handleMergeImages}
                    onOneClickRecognize={handleOneClickRecognize}
                    onDelete={handleDeleteFrames}
                    onDeleteMerged={(ids) => setMergedImages(prev => prev.filter(img => !ids.includes(img.id)))}
                    onClearMerged={() => setMergedImages([])}
                    onClearAll={handleClearAllData}
                    onImportFrames={handleImportFrames}
                    onImportMerged={handleImportMerged}
                    onMergeGroups={handleMergeGroups}
                    onJumpToTime={handleJumpToTime}
                  />
                </div>
              </section>
            </div>
          )}

          {activeTab === 'proofread' && (
            <div className="h-[calc(100vh-5rem)] flex flex-col">
              <section className="flex-1 flex flex-col min-h-0">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 p-4 flex-1 flex flex-col min-h-0">
                  <TextProofreader />
                </div>
              </section>
            </div>
          )}

          {activeTab === 'proofread2' && (
            <div className="h-[calc(100vh-3.5rem)]">
              <section className="h-full">
                {/* 左右分栏布局 - 固定高度，各自滚动，无间距 */}
                <div className="flex gap-0 h-full">
                  {/* 左侧：截取图片展示（可调整大小、可折叠） */}
                  <ResizablePanel
                    defaultWidth="50%"
                    minWidth={200}
                    maxWidth={1200}
                    collapsedWidth={48}
                    defaultCollapsed={true}
                  >
                    <CompactGallery
                      frames={extractedFrames}
                      onDelete={handleDeleteFrames}
                      onJumpToTime={handleJumpToTime}
                      activeVideo={activeVideo}
                      videoSrc={videoSrc}
                      sharedVideoRef={videoElementRef}
                      roi={roi}
                      onCaptureFrame={handleFrameCaptured}
                    />
                  </ResizablePanel>
                  
                  {/* 右侧：文本校对 */}
                  <div className="flex-1 bg-white overflow-hidden flex flex-col border-l border-gray-200">
                    <div className="flex-1 overflow-hidden p-4">
                      <TextProofreader2 
                        extractedFrames={extractedFrames}
                        onDeleteFrames={handleDeleteFrames}
                        onJumpToTime={handleJumpToTime}
                        activeVideo={activeVideo}
                        videoSrc={videoSrc}
                        sharedVideoRef={videoElementRef}
                        roi={roi}
                        onCaptureFrame={handleFrameCaptured}
                      />
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

        </main>
      </div>
    </>
  );
};

export default App;
