import React from 'react';
import CompactGallery from '../CompactGallery';
import ResizablePanel from '../ResizablePanel';
import TextEditorProofreader from '../TextEditorProofreader';
import { SIDE_PANEL_COLLAPSED_WIDTH } from '../panelConstants';
import { ExtractedFrame, ROI, VideoFile } from '../../types';

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

const ProofreadEditorTab: React.FC<ProofreadEditorTabProps> = ({
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

export default ProofreadEditorTab;
