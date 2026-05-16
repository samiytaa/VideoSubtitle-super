import React from 'react';
import RoiSelector from '../RoiSelector';
import { ExtractedFrame, ROI, RoiPreset, VideoFile } from '../../types';

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

const ExtractTab: React.FC<ExtractTabProps> = ({
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
}) => {
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

export default ExtractTab;
