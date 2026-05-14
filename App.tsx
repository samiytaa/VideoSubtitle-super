import React, { useCallback, useEffect, useReducer, useRef } from 'react';
import AppHeader, { AppTab } from './components/app/AppHeader';
import {
  BaimiaoTab,
  ExtractTab,
  GalleryTab,
  ProofreadEditorTab,
  ProofreadTab,
} from './components/app/AppTabs';
import AiChatTab from './components/AiChatTab';
import LoadingOverlay from './components/app/LoadingOverlay';
import { NotificationProvider, useNotifier } from './components/Notifications';
import ProcessingView from './components/ProcessingView';
import { ExtractedFrame, ExtractionMode, ExtractionParams, ROI, RoiPreset, VideoFile } from './types';
import { useFrameManagement, useVideoProcessing, useDeduplication } from './hooks';
import { handleError } from './utils/errorHandler';
import { DEFAULT_MERGE_BATCH_SIZE } from './config/constants';
import { confirmDelete } from './utils/confirmActions';

type Tab = AppTab;
type PendingDeduplication = {
  dialogue: boolean;
  location: boolean;
} | null;

interface AppState {
  activeTab: Tab;
  pendingDeduplication: PendingDeduplication;
}

type AppAction =
  | { type: 'SET_ACTIVE_TAB'; payload: Tab }
  | { type: 'SET_PENDING_DEDUPLICATION'; payload: PendingDeduplication };

const TAB_TO_PATH: Record<Tab, string> = {
  extract: '/',
  gallery: '/img',
  proofread: '/convert',
  proofread2: '/proofread',
  baimiao: '/baimiao-ocr',
  aichat: '/ai-chat',
};

const PATH_TO_TAB: Record<string, Tab> = Object.entries(TAB_TO_PATH).reduce(
  (acc, [tab, path]) => {
    acc[path] = tab as Tab;
    return acc;
  },
  {} as Record<string, Tab>
);
PATH_TO_TAB['/ocr'] = 'aichat';

const getTabFromLocation = (): Tab => {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  return PATH_TO_TAB[pathname] ?? 'extract';
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_ACTIVE_TAB':
      if (state.activeTab === action.payload) return state;
      return { ...state, activeTab: action.payload };
    case 'SET_PENDING_DEDUPLICATION':
      return { ...state, pendingDeduplication: action.payload };
    default:
      return state;
  }
};

const App: React.FC = () => {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
};

const AppContent: React.FC = () => {
  const notifier = useNotifier();
  const [state, dispatch] = useReducer(appReducer, {
    activeTab: 'extract',
    pendingDeduplication: null,
  });
  const { activeTab, pendingDeduplication } = state;

  // Refs for scrolling
  const sectionUploadRef = useRef<HTMLDivElement>(null);
  const sectionRoiRef = useRef<HTMLDivElement>(null);
  const sectionProcessRef = useRef<HTMLDivElement>(null);
  const sectionResultRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  // 使用自定义 Hooks
  const frameManagement = useFrameManagement(notifier);
  const videoProcessing = useVideoProcessing();
  const deduplication = useDeduplication({
    extractedFramesRef: frameManagement.extractedFramesRef,
    setExtractedFrames: frameManagement.setExtractedFrames,
    setProcessingProgress: videoProcessing.updateProcessingProgress,
    notifier,
  });

  // Tab 路由管理
  useEffect(() => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: getTabFromLocation() });

    const handlePopState = () => {
      const nextTab = getTabFromLocation();
      dispatch({ type: 'SET_ACTIVE_TAB', payload: nextTab });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const targetPath = TAB_TO_PATH[activeTab];
    const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
    if (currentPath !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  }, [activeTab]);

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // 视频上传处理
  const handleVideoUploaded = async (video: VideoFile) => {
    if (frameManagement.extractedFrames.length > 0) {
      const shouldClear = await confirmDelete(
        frameManagement.extractedFrames.length,
        '截取',
        notifier
      );

      if (shouldClear) {
        frameManagement.setExtractedFrames([]);
      }
    }

    videoProcessing.setActiveVideo(video);
    videoProcessing.setIsProcessing(false);
    videoProcessing.setIsCompleted(false);

    videoProcessing.setParams((prev) => ({
      ...prev,
      startTime: 0,
      endTime: video.duration,
    }));
    scrollTo(sectionRoiRef);
  };

  // 一键处理
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
    if (!videoProcessing.activeVideo) {
      notifier.addToast('请先上传视频，再使用一键处理功能', 'warning');
      return;
    }

    const {
      srtFile,
      dialoguePreset,
      locationPreset,
      timeRange,
      captureType,
      autoDeduplicationDialogue,
      autoDeduplicationLocation,
      frameInterval,
      skipSubtitleDialogue,
      skipSubtitleLocation,
    } = options;
    const useSrt = !!srtFile;

    if (frameManagement.extractedFrames.length > 0) {
      const shouldClear = await confirmDelete(
        frameManagement.extractedFrames.length,
        '截取',
        notifier
      );

      if (shouldClear) {
        frameManagement.setExtractedFrames([]);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const buildParams = (
      group: 'group1' | 'group2',
      skipSubtitle: boolean,
      autoDedup: boolean
    ): ExtractionParams => {
      if (useSrt) {
        return {
          ...videoProcessing.params,
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
          ...videoProcessing.params,
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
      notifier.addToast(
        `一键处理：先对话，再地点${useSrt ? '' : '（固定帧间隔）'}`,
        'info'
      );

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
        videoProcessing.updateNextStepInfo(nextInfo);
      }

      if (dialoguePreset) {
        const newRoi: ROI = {
          x: dialoguePreset.x_ratio * 100,
          y: dialoguePreset.y_ratio * 100,
          width: dialoguePreset.w_ratio * 100,
          height: dialoguePreset.h_ratio * 100,
        };
        videoProcessing.setRoi(newRoi);
        await new Promise((resolve) => setTimeout(resolve, 100));
        videoProcessing.handleParamsSet(
          buildParams('group1', useSrt && (skipSubtitleDialogue ?? false), false),
          false
        );
        frameManagement.setExtractedFrames([]);
        notifier.addToast('正在处理对话截图...', 'info');
      }
    } else {
      videoProcessing.updateNextStepInfo(null);

      const preset = captureType === 'dialogue' ? dialoguePreset : locationPreset;
      if (!preset) return;

      const newRoi: ROI = {
        x: preset.x_ratio * 100,
        y: preset.y_ratio * 100,
        width: preset.w_ratio * 100,
        height: preset.h_ratio * 100,
      };
      videoProcessing.setRoi(newRoi);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const autoDedup =
        captureType === 'dialogue' ? autoDeduplicationDialogue : autoDeduplicationLocation;
      const skipSub =
        captureType === 'dialogue'
          ? useSrt && (skipSubtitleDialogue ?? false)
          : useSrt && (skipSubtitleLocation ?? true);
      videoProcessing.handleParamsSet(
        buildParams(captureType === 'dialogue' ? 'group1' : 'group2', skipSub, autoDedup),
        false
      );
      frameManagement.setExtractedFrames([]);
      notifier.addToast(
        `已一键处理${captureType === 'dialogue' ? '对话' : '地点'}截图${useSrt ? '' : '（固定帧间隔）'}`,
        'success'
      );
    }
  };

  // 处理完成回调
  const handleProcessingComplete = async (results: ExtractedFrame[]) => {
    frameManagement.setExtractedFrames((prev) => [...prev, ...results]);

    videoProcessing.updateProcessingProgress({
      current: 100,
      total: 100,
      message: '截取完成！',
      stage: 'extracting',
    });

    const currentNextStepInfo = videoProcessing.nextStepInfoRef.current;
    if (currentNextStepInfo && currentNextStepInfo.preset) {
      notifier.addToast('对话截取完成，开始截取地点...', 'info');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const locationPreset = currentNextStepInfo.preset;
      const newRoi: ROI = {
        x: locationPreset.x_ratio * 100,
        y: locationPreset.y_ratio * 100,
        width: locationPreset.w_ratio * 100,
        height: locationPreset.h_ratio * 100,
      };
      videoProcessing.setRoi(newRoi);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const locationParams: ExtractionParams = currentNextStepInfo.srtFile
        ? {
            ...videoProcessing.params,
            mode: ExtractionMode.SRT,
            srtFile: currentNextStepInfo.srtFile,
            startTime: currentNextStepInfo.timeRange.startTime,
            endTime: currentNextStepInfo.timeRange.endTime,
            selectedGroup: 'group2',
            skipSubtitleRegions: currentNextStepInfo.skipSubtitleLocation ?? true,
            autoDeduplication: false,
          }
        : {
            ...videoProcessing.params,
            mode: ExtractionMode.FRAME,
            srtFile: undefined,
            interval: currentNextStepInfo.frameInterval ?? 30,
            startTime: currentNextStepInfo.timeRange.startTime,
            endTime: currentNextStepInfo.timeRange.endTime,
            selectedGroup: 'group2',
            skipSubtitleRegions: false,
            autoDeduplication: false,
          };

      const savedDeduplicationConfig = {
        dialogue: currentNextStepInfo.autoDeduplicationDialogue || false,
        location: currentNextStepInfo.autoDeduplicationLocation || false,
      };

      videoProcessing.updateNextStepInfo(null);
      dispatch({
        type: 'SET_PENDING_DEDUPLICATION',
        payload: savedDeduplicationConfig,
      });

      videoProcessing.handleParamsSet(locationParams, true);
      return;
    }

    const pendingDedup = pendingDeduplication;
    if (pendingDedup) {
      dispatch({ type: 'SET_PENDING_DEDUPLICATION', payload: null });

      await new Promise((resolve) => setTimeout(resolve, 800));

      if (pendingDedup.dialogue) {
        await deduplication.performDeduplication('group1', '【对话】');
      }

      if (pendingDedup.location) {
        await deduplication.performDeduplication('group2', '【地点】');
      }
    } else if (
      videoProcessing.params.mode === ExtractionMode.SRT &&
      videoProcessing.params.selectedGroup &&
      videoProcessing.params.autoDeduplication !== false
    ) {
      const targetGroup = videoProcessing.params.selectedGroup;
      const groupLabel = targetGroup === 'group1' ? '【对话】' : '【地点】';

      await new Promise((resolve) => setTimeout(resolve, 800));
      await deduplication.performDeduplication(targetGroup, groupLabel);
    }

    videoProcessing.completeProcessing();
    scrollTo(sectionResultRef);
  };

  // 跳转到视频时间点
  const handleJumpToTime = useCallback(
    (timestamp: string) => {
      const parts = timestamp.split(':');
      if (parts.length !== 3) return;

      const hours = parseInt(parts[0]);
      const minutes = parseInt(parts[1]);
      const secondsParts = parts[2].split('.');
      const seconds = parseInt(secondsParts[0]);
      const milliseconds = secondsParts[1] ? parseInt(secondsParts[1]) : 0;

      const totalSeconds = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;

      dispatch({ type: 'SET_ACTIVE_TAB', payload: 'extract' });

      setTimeout(() => {
        scrollTo(sectionRoiRef);

        if (videoElementRef.current) {
          videoElementRef.current.currentTime = totalSeconds;
          notifier.addToast(`已跳转到 ${timestamp}`, 'success');
        }
      }, 300);
    },
    [notifier]
  );

  // 一键拼接状态
  const [oneClickProgress, setOneClickProgress] = React.useState<{
    isLoading: boolean;
    progress: number;
    message: string;
  }>({ isLoading: false, progress: 0, message: '' });

  // 一键识别
  const handleOneClickRecognize = useCallback(async () => {
    if (frameManagement.extractedFrames.length === 0) return;

    if (frameManagement.mergedImages.length > 0) {
      const choice = await notifier.showChoice({
        title: '已存在拼接图片',
        message: `当前已有 ${frameManagement.mergedImages.length} 张拼接图片，请选择操作方式。`,
        buttons: [
          { label: '移除后拼接', value: 'remove', variant: 'danger' },
          { label: '取消拼接', value: 'cancel', variant: 'default' },
        ],
      });
      if (choice === 'cancel') return;
      if (choice === 'remove') frameManagement.setMergedImages([]);
    }

    setOneClickProgress({ isLoading: true, progress: 0, message: '正在合并分组...' });

    const mergedFrames = frameManagement.extractedFrames.map((frame) =>
      frame.group === 'group2' ? { ...frame, group: 'group1' as const } : frame
    );

    frameManagement.setExtractedFrames(mergedFrames);
    setOneClickProgress({ isLoading: true, progress: 0, message: '正在拼接图片 0/0...' });

    const newMergedImages = await frameManagement.mergeFramesToImages(
      mergedFrames,
      DEFAULT_MERGE_BATCH_SIZE,
      ({ completed, total }) => {
        const progress = total > 0 ? Math.floor((completed / total) * 100) : 0;
        setOneClickProgress({
          isLoading: true,
          progress,
          message: `正在拼接图片 ${completed}/${total}...`,
        });
      },
    );
    
    if (newMergedImages.length === 0) {
      setOneClickProgress({ isLoading: false, progress: 0, message: '' });
      return;
    }

    frameManagement.setMergedImages((prev) => [...prev, ...newMergedImages]);
    setOneClickProgress({ isLoading: true, progress: 100, message: '完成！' });
    
    setTimeout(() => {
      setOneClickProgress({ isLoading: false, progress: 0, message: '' });
    }, 500);
    
    notifier.addToast('已完成一键拼接：先合并分组，再按默认参数完成图片拼接', 'success');
  }, [frameManagement, notifier]);

  // 清空所有数据
  const handleClearAllData = useCallback(async () => {
    const totalCount =
      frameManagement.extractedFrames.length + frameManagement.mergedImages.length;
    if (totalCount === 0) return;

    const confirmed = await notifier.showConfirm({
      title: '⚠️ 清空所有数据',
      message: `确定要清空所有数据吗？\n\n这将删除：\n• ${frameManagement.extractedFrames.length} 张截取的图片\n• ${frameManagement.mergedImages.length} 张拼接的图片\n\n此操作不可恢复！`,
    });

    if (confirmed) {
      frameManagement.setExtractedFrames([]);
      frameManagement.setMergedImages([]);
      notifier.addToast('已清空所有数据', 'success');
    }
  }, [frameManagement, notifier]);

  // 替换视频
  const handleReplaceVideo = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const getVideoMetadata = (sourceFile: File): Promise<VideoFile> => {
        return new Promise((resolve, reject) => {
          const url = URL.createObjectURL(sourceFile);
          const video = document.createElement('video');
          video.preload = 'auto';
          video.muted = true;
          const onLoadedData = () => {
            if (!isFinite(video.duration) || video.duration === 0) return;
            cleanup();
            resolve({
              id: Math.random().toString(36).substr(2, 9),
              file: sourceFile,
              name: sourceFile.name,
              size: sourceFile.size,
              duration: video.duration,
              width: video.videoWidth,
              height: video.videoHeight,
              previewUrl: url,
            });
          };
          const onDurationChange = () => {
            if (isFinite(video.duration) && video.duration > 0) {
              cleanup();
              resolve({
                id: Math.random().toString(36).substr(2, 9),
                file: sourceFile,
                name: sourceFile.name,
                size: sourceFile.size,
                duration: video.duration,
                width: video.videoWidth,
                height: video.videoHeight,
                previewUrl: url,
              });
            }
          };
          const onError = () => {
            cleanup();
            reject(new Error(`Failed to load video metadata for ${sourceFile.name}`));
            URL.revokeObjectURL(url);
          };
          const cleanup = () => {
            video.removeEventListener('loadeddata', onLoadedData);
            video.removeEventListener('durationchange', onDurationChange);
            video.removeEventListener('error', onError);
          };
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
        handleError(error, notifier, {
          context: 'Error processing video',
          userMessage: '无法读取视频文件，请确保文件格式正确。',
        });
      }
    };
    input.click();
  }, [handleVideoUploaded, notifier]);

  return (
    <>
      <LoadingOverlay visible={!frameManagement.isDataLoaded} />

      <div className="min-h-screen flex flex-col bg-slate-50">
        <AppHeader
          activeTab={activeTab}
          isProcessing={videoProcessing.isProcessing}
          onChangeTab={(tab) => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab })}
          isAiChatProcessing={oneClickProgress.isLoading}
        />

        <main
          className={`grow w-full ${activeTab === 'proofread2' ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'}`}
        >
          {activeTab === 'extract' && (
            <ExtractTab
              sectionUploadRef={sectionUploadRef}
              sectionRoiRef={sectionRoiRef}
              activeVideo={videoProcessing.activeVideo}
              videoSrc={videoProcessing.videoSrc}
              isProcessing={videoProcessing.isProcessing}
              processingProgress={videoProcessing.processingProgress}
              paramsStartTime={videoProcessing.params.startTime}
              paramsEndTime={videoProcessing.params.endTime}
              videoElementRef={videoElementRef}
              onRoiSet={videoProcessing.handleRoiSet}
              onFrameCaptured={frameManagement.handleFrameCaptured}
              onQuickProcess={handleQuickProcess}
              onUpload={handleVideoUploaded}
              onClearVideo={() => videoProcessing.setActiveVideo(null)}
              onReplaceVideo={handleReplaceVideo}
              processingView={
                videoProcessing.activeVideo ? (
                  <div className="hidden">
                    <ProcessingView
                      video={videoProcessing.activeVideo}
                      videoSrc={videoProcessing.videoSrc}
                      roi={videoProcessing.roi}
                      params={videoProcessing.params}
                      taskId={videoProcessing.processingKey}
                      onComplete={handleProcessingComplete}
                      onProgress={videoProcessing.handleProcessingProgress}
                    />
                  </div>
                ) : null
              }
            />
          )}

          {activeTab === 'gallery' && (
            <GalleryTab
              extractedFrames={frameManagement.extractedFrames}
              mergedImages={frameManagement.mergedImages}
              onMergeImages={frameManagement.handleMergeImages}
              onOneClickRecognize={handleOneClickRecognize}
              onDeleteFrames={frameManagement.handleDeleteFrames}
              onDeleteMerged={(ids) => {
                const idSet = new Set(ids);
                frameManagement.setMergedImages((prev) =>
                  prev.filter((img) => !idSet.has(img.id))
                );
              }}
              onClearMerged={() => frameManagement.setMergedImages([])}
              onClearAllData={handleClearAllData}
              onImportFrames={frameManagement.handleImportFrames}
              onImportMerged={frameManagement.handleImportMerged}
              onMergeGroups={frameManagement.handleMergeGroups}
              onJumpToTime={handleJumpToTime}
            />
          )}

          {activeTab === 'proofread' && <ProofreadTab />}

          {activeTab === 'proofread2' && (
            <ProofreadEditorTab
              extractedFrames={frameManagement.extractedFrames}
              activeVideo={videoProcessing.activeVideo}
              videoSrc={videoProcessing.videoSrc}
              videoElementRef={videoElementRef}
              roi={videoProcessing.roi}
              onDeleteFrames={frameManagement.handleDeleteFrames}
              onJumpToTime={handleJumpToTime}
              onCaptureFrame={frameManagement.handleFrameCaptured}
            />
          )}

          {activeTab === 'baimiao' && (
            <BaimiaoTab
              mergedImages={frameManagement.mergedImages}
              onOneClickRecognize={handleOneClickRecognize}
            />
          )}

          <div className={activeTab === 'aichat' ? '' : 'hidden'}>
            <AiChatTab
              mergedImages={frameManagement.mergedImages}
              onOneClickRecognize={handleOneClickRecognize}
              oneClickProgress={oneClickProgress}
            />
          </div>
        </main>
      </div>
    </>
  );
};

export default App;
