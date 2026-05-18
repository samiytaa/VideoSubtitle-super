import React, { Suspense, useRef, memo } from 'react';
import AppHeader from './components/app/AppHeader';
import ExtractTab from './components/app/ExtractTab';
import LoadingOverlay from './components/app/LoadingOverlay';
import ErrorBoundary from './components/ErrorBoundary';
import { NotificationProvider, useNotifier } from './components/Notifications';
import ProcessingView from './components/ProcessingView';
import { ExtractedFrame } from './types';
import {
  useFrameManagement,
  useVideoProcessing,
  useDeduplication,
  useAppState,
  useVideoUpload,
  useQuickProcess,
  useProcessingComplete,
  useOneClickRecognize,
  useScrollHelpers,
  useJumpToTime,
  useClearAllData,
} from './hooks';


const GalleryTab = React.lazy(() => import('./components/app/GalleryTab'));
const ProofreadEditorTab = React.lazy(() => import('./components/app/ProofreadEditorTab'));
const BaimiaoTab = React.lazy(() => import('./components/app/BaimiaoTab'));
const AvatarTab = React.lazy(() => import('./components/app/AvatarTab'));
const AiChatTab = React.lazy(() => import('./components/AiChatTab'));

const tabLoadingFallback = (
  <div className="flex min-h-[12rem] items-center justify-center text-sm text-gray-500">
    正在加载页面...
  </div>
);

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </ErrorBoundary>
  );
};

const AppContent: React.FC = () => {
  const notifier = useNotifier();
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  // 状态管理
  const { activeTab, pendingDeduplication, setActiveTab, setPendingDeduplication } = useAppState();

  // 滚动辅助
  const {
    sectionUploadRef,
    sectionRoiRef,
    sectionProcessRef,
    sectionResultRef,
    scrollToRoi,
    scrollToResult,
  } = useScrollHelpers();

  // 核心业务逻辑 Hooks
  const frameManagement = useFrameManagement(notifier);
  const videoProcessing = useVideoProcessing();
  const deduplication = useDeduplication({
    extractedFramesRef: frameManagement.extractedFramesRef,
    setExtractedFrames: frameManagement.setExtractedFrames,
    setProcessingProgress: videoProcessing.updateProcessingProgress,
    notifier,
  });

  // 视频上传
  const { handleVideoUploaded, handleReplaceVideo } = useVideoUpload({
    notifier,
    extractedFramesCount: frameManagement.extractedFrames.length,
    onClearFrames: () => frameManagement.setExtractedFrames([]),
    onVideoSet: (video) => {
      videoProcessing.setActiveVideo(video);
      videoProcessing.setIsProcessing(false);
      videoProcessing.setIsCompleted(false);
      videoProcessing.setParams((prev) => ({
        ...prev,
        startTime: 0,
        endTime: video.duration,
      }));
    },
    onScrollToRoi: scrollToRoi,
  });

  // 一键处理
  const { handleQuickProcess } = useQuickProcess({
    activeVideo: videoProcessing.activeVideo,
    extractedFramesCount: frameManagement.extractedFrames.length,
    params: videoProcessing.params,
    notifier,
    onClearFrames: () => frameManagement.setExtractedFrames([]),
    onSetRoi: videoProcessing.setRoi,
    onParamsSet: videoProcessing.handleParamsSet,
    onUpdateNextStepInfo: videoProcessing.updateNextStepInfo,
  });

  // 处理完成
  const { handleProcessingComplete } = useProcessingComplete({
    params: videoProcessing.params,
    nextStepInfoRef: videoProcessing.nextStepInfoRef,
    pendingDeduplication,
    notifier,
    onAddFrames: (frames) => frameManagement.setExtractedFrames((prev) => [...prev, ...frames]),
    onUpdateProgress: videoProcessing.updateProcessingProgress,
    onSetRoi: videoProcessing.setRoi,
    onParamsSet: videoProcessing.handleParamsSet,
    onUpdateNextStepInfo: videoProcessing.updateNextStepInfo,
    onSetPendingDeduplication: setPendingDeduplication,
    onPerformDeduplication: deduplication.performDeduplication,
    onCompleteProcessing: videoProcessing.completeProcessing,
    onScrollToResult: scrollToResult,
  });

  // 一键识别
  const { oneClickProgress, handleOneClickRecognize } = useOneClickRecognize({
    extractedFrames: frameManagement.extractedFrames,
    mergedImages: frameManagement.mergedImages,
    notifier,
    onSetExtractedFrames: frameManagement.setExtractedFrames,
    onSetMergedImages: frameManagement.setMergedImages,
    onMergeFramesToImages: frameManagement.mergeFramesToImages,
  });

  // 跳转到时间点
  const { handleJumpToTime } = useJumpToTime({
    videoElementRef,
    notifier,
    onSetActiveTab: setActiveTab,
    onScrollToRoi: scrollToRoi,
  });

  // 清空所有数据
  const { handleClearAllData } = useClearAllData({
    extractedFramesCount: frameManagement.extractedFrames.length,
    mergedImagesCount: frameManagement.mergedImages.length,
    notifier,
    onClearFrames: () => frameManagement.setExtractedFrames([]),
    onClearMerged: () => frameManagement.setMergedImages([]),
  });

  // 布局样式
  const mainLayoutClass = getMainLayoutClass(activeTab);

  return (
    <>
      <LoadingOverlay visible={!frameManagement.isDataLoaded} />

      <div
        className={`${activeTab === 'proofread2' || activeTab === 'avatars' ? 'h-screen overflow-hidden' : 'min-h-screen'} flex flex-col bg-slate-50`}
      >
        <AppHeader
          activeTab={activeTab}
          isProcessing={videoProcessing.isProcessing}
          onChangeTab={setActiveTab}
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

          {activeTab === 'avatars' && (
            <Suspense fallback={tabLoadingFallback}>
              <AvatarTab
                extractedFrames={frameManagement.extractedFrames}
                onDeleteFrames={frameManagement.handleDeleteFrames}
                onJumpToTime={handleJumpToTime}
                activeVideo={videoProcessing.activeVideo}
                videoSrc={videoProcessing.videoSrc}
                videoElementRef={videoElementRef}
                roi={videoProcessing.roi}
                onCaptureFrame={frameManagement.handleFrameCaptured}
              />
            </Suspense>
          )}
        </main>
      </div>
    </>
  );
};

function getMainLayoutClass(tab: string): string {
  if (tab === 'proofread2') return 'min-h-0 overflow-hidden';
  if (tab === 'avatars') return 'min-h-0 overflow-hidden';
  if (tab === 'gallery') return 'px-0 py-0';
  return 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6';
}

export default App;
