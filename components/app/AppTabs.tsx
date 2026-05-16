import React from 'react';
import BaimiaoOcrTab from '../BaimiaoOcrTab';
import CompactGallery from '../CompactGallery';
import ResizablePanel from '../ResizablePanel';
import ResultGallery from '../ResultGallery';
import RoiSelector from '../RoiSelector';
import TextEditorProofreader from '../TextEditorProofreader';
import { SIDE_PANEL_COLLAPSED_WIDTH } from '../panelConstants';
import { ExtractedFrame, MergedImage, ROI, RoiPreset, VideoFile } from '../../types';

type ProcessingProgress = {
  current: number;
  total: number;
  message: string;
  stage?: 'extracting' | 'extracting-dialogue' | 'extracting-location' | 'deduplicating';
};

type ExtractTabProps = {
  sectionUploadRef: React.RefObject<HTMLDivElement | null>;
  sectionRoiRef: React.RefObject<HTMLDivElement | null>;
  activeVideo: VideoFile | null;
  videoSrc: string | null;
  isProcessing: boolean;
  processingProgress: ProcessingProgress;
  videoElementRef: React.RefObject<HTMLVideoElement | null>;
  onRoiSet: (newRoi: ROI, timeRange?: { startTime: number; endTime: number }, skipSubtitleRegions?: boolean) => void;
  onFrameCaptured: (frame: ExtractedFrame) => void;
  onQuickProcess: (options: {
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
  onUpload: (video: VideoFile) => void;
  onClearVideo: () => void;
  onReplaceVideo: () => void;
  processingView: React.ReactNode;
};

export const ExtractTab: React.FC<ExtractTabProps> = (props) => {
  const {
    sectionUploadRef,
    sectionRoiRef,
    activeVideo,
    videoSrc,
    isProcessing,
    processingProgress,
    videoElementRef,
    onRoiSet,
    onFrameCaptured,
    onQuickProcess,
    onUpload,
    onClearVideo,
    onReplaceVideo,
    processingView,
  } = props;
  const [quickProcessSrtFile, setQuickProcessSrtFile] = React.useState<File | null>(null);

  return (
    <div className="pb-20">
      <section ref={sectionUploadRef} className="scroll-mt-20">
        <div ref={sectionRoiRef} className="bg-white rounded-xl shadow-sm border border-gray-200/60 overflow-hidden">
          <RoiSelector
            video={activeVideo}
            videoSrc={videoSrc}
            onConfirm={onRoiSet}
            onFrameCaptured={onFrameCaptured}
            videoRef={videoElementRef}
            onQuickProcess={onQuickProcess}
            isProcessing={isProcessing}
            progress={processingProgress}
            onUpload={onUpload}
            onClearVideo={onClearVideo}
            onReplaceVideo={onReplaceVideo}
            quickProcessSrtFile={quickProcessSrtFile}
            onSrtFileChange={setQuickProcessSrtFile}
          />
        </div>
      </section>
      {processingView}
    </div>
  );
};

type GalleryTabProps = {
  extractedFrames: ExtractedFrame[];
  mergedImages: MergedImage[];
  onMergeImages: (selectedFrames: ExtractedFrame[], batchSize?: number) => void;
  onOneClickRecognize: () => void;
  onDeleteFrames: (ids: string[]) => void;
  onDeleteMerged: (ids: string[]) => void;
  onClearMerged: () => void;
  onClearAllData: () => void;
  onImportFrames: (frames: ExtractedFrame[]) => void;
  onImportMerged: (images: MergedImage[]) => void;
  onMergeGroups: (sourceGroup: 'group1' | 'group2', targetGroup: 'group1' | 'group2') => void;
  onJumpToTime: (timestamp: string) => void;
};

export const GalleryTab: React.FC<GalleryTabProps> = ({
  extractedFrames,
  mergedImages,
  onMergeImages,
  onOneClickRecognize,
  onDeleteFrames,
  onDeleteMerged,
  onClearMerged,
  onClearAllData,
  onImportFrames,
  onImportMerged,
  onMergeGroups,
  onJumpToTime,
}) => (
  <div className="pb-20">
    <ResultGallery
      frames={extractedFrames}
      mergedImages={mergedImages}
      onMerge={onMergeImages}
      onOneClickRecognize={onOneClickRecognize}
      onDelete={onDeleteFrames}
      onDeleteMerged={onDeleteMerged}
      onClearMerged={onClearMerged}
      onClearAll={onClearAllData}
      onImportFrames={onImportFrames}
      onImportMerged={onImportMerged}
      onMergeGroups={onMergeGroups}
      onJumpToTime={onJumpToTime}
    />
  </div>
);

type ProofreadEditorTabProps = {
  extractedFrames: ExtractedFrame[];
  activeVideo: VideoFile | null;
  videoSrc: string | null;
  videoElementRef: React.RefObject<HTMLVideoElement | null>;
  roi: ROI;
  onDeleteFrames: (ids: string[]) => void;
  onJumpToTime: (timestamp: string) => void;
  onCaptureFrame: (frame: ExtractedFrame) => void;
};

export const ProofreadEditorTab: React.FC<ProofreadEditorTabProps> = ({
  extractedFrames,
  activeVideo,
  videoSrc,
  videoElementRef,
  roi,
  onDeleteFrames,
  onJumpToTime,
  onCaptureFrame,
}) => (
  <div className="h-full min-h-0 overflow-hidden">
    <div className="flex h-full min-h-0 gap-0">
      <ResizablePanel defaultWidth="50%" minWidth={200} maxWidth={1200} collapsedWidth={SIDE_PANEL_COLLAPSED_WIDTH} defaultCollapsed={true}>
        <CompactGallery
          frames={extractedFrames}
          onDelete={onDeleteFrames}
          onJumpToTime={onJumpToTime}
          activeVideo={activeVideo}
          videoSrc={videoSrc}
          sharedVideoRef={videoElementRef}
          roi={roi}
          onCaptureFrame={onCaptureFrame}
        />
      </ResizablePanel>

      <TextEditorProofreader
        extractedFrames={extractedFrames}
        onDeleteFrames={onDeleteFrames}
        onJumpToTime={onJumpToTime}
        activeVideo={activeVideo}
        videoSrc={videoSrc}
        sharedVideoRef={videoElementRef}
        roi={roi}
        onCaptureFrame={onCaptureFrame}
      />
    </div>
  </div>
);

export const BaimiaoTab: React.FC<{ mergedImages: MergedImage[]; onOneClickRecognize: () => void }> = ({
  mergedImages,
  onOneClickRecognize,
}) => (
  <div className="pb-20">
    <section className="scroll-mt-20">
      <BaimiaoOcrTab mergedImages={mergedImages} onOneClickRecognize={onOneClickRecognize} />
    </section>
  </div>
);
