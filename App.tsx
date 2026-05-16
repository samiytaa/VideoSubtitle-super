import React, { Suspense, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import AppHeader, { AppTab } from './components/app/AppHeader';
import ExtractTab from './components/app/ExtractTab';
import LoadingOverlay from './components/app/LoadingOverlay';
import { NotificationProvider, useNotifier } from './components/Notifications';
import ProcessingView from './components/ProcessingView';
import { ExtractedFrame, ExtractionMode, ExtractionParams, ROI, RoiPreset, VideoFile } from './types';
import { useFrameManagement, useVideoProcessing, useDeduplication } from './hooks';
import { handleError } from './utils/errorHandler';
import { DEFAULT_MERGE_BATCH_SIZE } from './config/constants';
import { confirmDelete } from './utils/confirmActions';
import { resolveVideoLocalPath } from './utils/electronFileAccess';
import { getCurrentRoutePath, syncHashRoute } from './utils/runtimeConfig';

type Tab = AppTab;
type PendingDeduplication = {
  dialogue: boolean;
  location: boolean;
} | null;
type QuickProcessType = 'dialogue' | 'location' | 'both';
type CaptureGroup = 'group1' | 'group2';

interface QuickProcessOptions {
  srtFile: File | null;
  dialoguePreset: RoiPreset | null;
  locationPreset: RoiPreset | null;
  timeRange: { startTime: number; endTime: number };
  captureType: QuickProcessType;
  autoDeduplicationDialogue: boolean;
  autoDeduplicationLocation: boolean;
  frameInterval?: number;
  skipSubtitleDialogue?: boolean;
  skipSubtitleLocation?: boolean;
}

interface BuildExtractionParamsOptions {
  baseParams: ExtractionParams;
  srtFile: File | null;
  timeRange: { startTime: number; endTime: number };
  frameInterval?: number;
  group: CaptureGroup;
  skipSubtitle: boolean;
  autoDeduplication: boolean;
}

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

const PATH_TO_TAB: Record<string, Tab> = {
  '/':           'extract',
  '/img':        'gallery',
  '/convert':    'proofread',
  '/proofread':  'proofread2',
  '/baimiao-ocr':'baimiao',
  '/ai-chat':    'aichat',
  '/ocr':        'aichat',
};

const KNOWN_ROUTE_PATHS = Object.values(TAB_TO_PATH);
const GalleryTab = React.lazy(() => import('./components/app/GalleryTab'));
const ProofreadTab = React.lazy(() => import('./components/app/ProofreadTab'));
const ProofreadEditorTab = React.lazy(() => import('./components/app/ProofreadEditorTab'));
const BaimiaoTab = React.lazy(() => import('./components/app/BaimiaoTab'));
const AiChatTab = React.lazy(() => import('./components/AiChatTab'));

const tabLoadingFallback = (
  <div className="flex min-h-[12rem] items-center justify-center text-sm text-gray-500">
    正在加载页面...
  </div>
);

function getTabFromLocation(): Tab {
  return PATH_TO_TAB[getCurrentRoutePath(KNOWN_ROUTE_PATHS)] ?? 'extract';
}

async function getVideoMetadata(sourceFile: File): Promise<VideoFile> {
  const localPath = await resolveVideoLocalPath(sourceFile);

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(sourceFile);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;

    const buildVideoFile = (): VideoFile => ({
      id: Math.random().toString(36).substr(2, 9),
      file: sourceFile,
      localPath,
      name: sourceFile.name,
      size: sourceFile.size,
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      previewUrl: url,
    });

    const cleanup = () => {
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('error', onError);
    };

    const onLoadedData = () => {
      if (!isFinite(video.duration) || video.duration === 0) return;
      cleanup();
      resolve(buildVideoFile());
    };

    const onDurationChange = () => {
      if (isFinite(video.duration) && video.duration > 0) {
        cleanup();
        resolve(buildVideoFile());
      }
    };

    const onError = () => {
      cleanup();
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load video metadata for ${sourceFile.name}`));
    };

    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('error', onError);
    video.src = url;
    video.load();
  });
}

function presetToRoi(preset: RoiPreset): ROI {
  return {
    x: preset.x_ratio * 100,
    y: preset.y_ratio * 100,
    width: preset.w_ratio * 100,
    height: preset.h_ratio * 100,
  };
}

function waitForUi(ms: number = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildExtractionParams(options: BuildExtractionParamsOptions): ExtractionParams {
  const {
    baseParams,
    srtFile,
    timeRange,
    frameInterval,
    group,
    skipSubtitle,
    autoDeduplication,
  } = options;

  if (srtFile) {
    return {
      ...baseParams,
      mode: ExtractionMode.SRT,
      srtFile,
      startTime: timeRange.startTime,
      endTime: timeRange.endTime,
      selectedGroup: group,
      skipSubtitleRegions: skipSubtitle,
      autoDeduplication,
    };
  }

  return {
    ...baseParams,
    mode: ExtractionMode.FRAME,
    srtFile: undefined,
    interval: frameInterval ?? 30,
    startTime: timeRange.startTime,
    endTime: timeRange.endTime,
    selectedGroup: group,
    skipSubtitleRegions: false,
    autoDeduplication,
  };
}

function getSkipSubtitleRegions(
  category: 'dialogue' | 'location',
  srtFile: File | null,
  options: QuickProcessOptions
): boolean {
  if (!srtFile) return false;
  if (category === 'dialogue') return options.skipSubtitleDialogue ?? false;
  return options.skipSubtitleLocation ?? true;
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_ACTIVE_TAB':
      if (state.activeTab === action.payload) return state;
      return { ...state, activeTab: action.payload };
    case 'SET_PENDING_DEDUPLICATION':
      return { ...state, pendingDeduplication: action.payload };
    default:
      return state;
  }
}

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
  function getMainLayoutClass(tab: Tab): string {
    if (tab === 'proofread2') return 'min-h-0 overflow-hidden';
    if (tab === 'gallery') return 'px-0 py-0';
    return 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6';
  }

  const mainLayoutClass = getMainLayoutClass(activeTab);

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

    const handleRouteChange = () => {
      const nextTab = getTabFromLocation();
      dispatch({ type: 'SET_ACTIVE_TAB', payload: nextTab });
    };

    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('popstate', handleRouteChange);
    return () => {
      window.removeEventListener('hashchange', handleRouteChange);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  useEffect(() => {
    const targetPath = TAB_TO_PATH[activeTab];
    const currentPath = getCurrentRoutePath(KNOWN_ROUTE_PATHS);
    if (currentPath !== targetPath) {
      syncHashRoute(targetPath);
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
  const handleQuickProcess = async (options: QuickProcessOptions) => {
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
        await waitForUi();
      } else {
        return;
      }
    }

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
        videoProcessing.setRoi(presetToRoi(dialoguePreset));
        await waitForUi();
        videoProcessing.handleParamsSet(
          buildExtractionParams({
            baseParams: videoProcessing.params,
            srtFile,
            timeRange,
            frameInterval,
            group: 'group1',
            skipSubtitle: skipSubtitleDialogue ?? false,
            autoDeduplication: false,
          }),
          false
        );
        notifier.addToast('正在处理对话截图...', 'info');
      }
    } else {
      videoProcessing.updateNextStepInfo(null);

      const preset = captureType === 'dialogue' ? dialoguePreset : locationPreset;
      if (!preset) return;

      const category = captureType === 'dialogue' ? 'dialogue' : 'location';
      const group = captureType === 'dialogue' ? 'group1' : 'group2';
      const autoDedup =
        category === 'dialogue' ? autoDeduplicationDialogue : autoDeduplicationLocation;

      videoProcessing.setRoi(presetToRoi(preset));
      await waitForUi();
      videoProcessing.handleParamsSet(
        buildExtractionParams({
          baseParams: videoProcessing.params,
          srtFile,
          timeRange,
          frameInterval,
          group,
          skipSubtitle: getSkipSubtitleRegions(category, srtFile, options),
          autoDeduplication: autoDedup,
        }),
        false
      );
      notifier.addToast(
        `已一键处理${category === 'dialogue' ? '对话' : '地点'}截图${useSrt ? '' : '（固定帧间隔）'}`,
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
      await waitForUi(1000);

      const locationPreset = currentNextStepInfo.preset;
      videoProcessing.setRoi(presetToRoi(locationPreset));
      await waitForUi();

      const locationParams = buildExtractionParams({
        baseParams: videoProcessing.params,
        srtFile: currentNextStepInfo.srtFile,
        timeRange: currentNextStepInfo.timeRange,
        frameInterval: currentNextStepInfo.frameInterval,
        group: 'group2',
        skipSubtitle: currentNextStepInfo.skipSubtitleLocation ?? true,
        autoDeduplication: false,
      });

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

      await waitForUi(800);

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

      await waitForUi(800);
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

      const [h, m, secStr] = parts;
      const [s, ms = '0'] = secStr.split('.');
      const totalSeconds =
        parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;

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
  const [oneClickProgress, setOneClickProgress] = useState<{
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

      <div className={`${activeTab === 'proofread2' ? 'h-screen overflow-hidden' : 'min-h-screen'} flex flex-col bg-slate-50`}>
        <AppHeader
          activeTab={activeTab}
          isProcessing={videoProcessing.isProcessing}
          onChangeTab={(tab) => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab })}
          isAiChatProcessing={oneClickProgress.isLoading}
        />

        <main className={`grow w-full ${mainLayoutClass}`}>
          {activeTab === 'extract' && (
            <ExtractTab
              sectionUploadRef={sectionUploadRef}
              sectionRoiRef={sectionRoiRef}
              activeVideo={videoProcessing.activeVideo}
              videoSrc={videoProcessing.videoSrc}
              isProcessing={videoProcessing.isProcessing}
              processingProgress={videoProcessing.processingProgress}
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
            <Suspense fallback={tabLoadingFallback}>
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
            </Suspense>
          )}

          {activeTab === 'proofread' && (
            <Suspense fallback={tabLoadingFallback}>
              <ProofreadTab />
            </Suspense>
          )}

          {activeTab === 'proofread2' && (
            <Suspense fallback={tabLoadingFallback}>
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
            </Suspense>
          )}

          {activeTab === 'baimiao' && (
            <Suspense fallback={tabLoadingFallback}>
              <BaimiaoTab
                mergedImages={frameManagement.mergedImages}
                onOneClickRecognize={handleOneClickRecognize}
              />
            </Suspense>
          )}

          {activeTab === 'aichat' && (
            <Suspense fallback={tabLoadingFallback}>
              <AiChatTab
                mergedImages={frameManagement.mergedImages}
                onOneClickRecognize={handleOneClickRecognize}
                oneClickProgress={oneClickProgress}
              />
            </Suspense>
          )}
        </main>
      </div>
    </>
  );
};

export default App;
