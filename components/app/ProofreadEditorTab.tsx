import React, { useCallback, useEffect, useMemo } from 'react';
import ProofreadImageGallery from '../ProofreadImageGallery';
import ResizablePanel from '../ResizablePanel';
import TextEditorProofreader from '../TextEditorProofreader';
import { SIDE_PANEL_COLLAPSED_WIDTH } from '../panelConstants';
import { ExtractedFrame, ROI, VideoFile } from '../../types';
import { useSharedReferenceFrame } from '../../hooks/useSharedReferenceFrame';

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
}) => {
  const { selectedReferenceFrameId, setSelectedReferenceFrameId } = useSharedReferenceFrame();

  const handleSelectReferenceFrame = useCallback((frame: ExtractedFrame) => {
    setSelectedReferenceFrameId(frame.id);
  }, [setSelectedReferenceFrameId]);

  const syncedReferenceFrameId = useMemo(() => {
    if (!selectedReferenceFrameId) return null;
    return extractedFrames.some((frame) => frame.id === selectedReferenceFrameId) ? selectedReferenceFrameId : null;
  }, [extractedFrames, selectedReferenceFrameId]);

  useEffect(() => {
    if (selectedReferenceFrameId && !syncedReferenceFrameId) {
      setSelectedReferenceFrameId(null);
    }
  }, [selectedReferenceFrameId, setSelectedReferenceFrameId, syncedReferenceFrameId]);

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <div className="flex h-full min-h-0 gap-0">
        <ResizablePanel defaultWidth="50%" minWidth={200} maxWidth={1200} collapsedWidth={SIDE_PANEL_COLLAPSED_WIDTH} defaultCollapsed={true}>
          <ProofreadImageGallery
            extractedFrames={extractedFrames}
            onDeleteFrames={onDeleteFrames}
            onJumpToTime={onJumpToTime}
            activeVideo={activeVideo}
            videoSrc={videoSrc}
            sharedVideoRef={videoElementRef}
            roi={roi}
            onCaptureFrame={onCaptureFrame}
            selectedReferenceFrameId={syncedReferenceFrameId}
            onSelectReferenceFrame={handleSelectReferenceFrame}
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
          selectedReferenceFrameId={syncedReferenceFrameId}
          onSelectReferenceFrame={handleSelectReferenceFrame}
        />
      </div>
    </div>
  );
};

export default ProofreadEditorTab;
