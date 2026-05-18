import React from 'react';
import CompactGallery from './CompactGallery';
import { ExtractedFrame, ROI, VideoFile } from '../types';

type ProofreadImageGalleryProps = {
  extractedFrames: ExtractedFrame[];
  onDeleteFrames?: (ids: string[]) => void;
  onJumpToTime?: (timestamp: string) => void;
  activeVideo?: VideoFile | null;
  videoSrc?: string | null;
  sharedVideoRef?: React.RefObject<HTMLVideoElement | null> | React.MutableRefObject<HTMLVideoElement | null>;
  roi?: ROI | null;
  onCaptureFrame?: (frame: ExtractedFrame) => void;
  selectedReferenceFrameId?: string | null;
  onSelectReferenceFrame?: (frame: ExtractedFrame) => void;
};

const ProofreadImageGallery: React.FC<ProofreadImageGalleryProps> = ({
  extractedFrames,
  onDeleteFrames,
  onJumpToTime,
  activeVideo,
  videoSrc,
  sharedVideoRef,
  roi,
  onCaptureFrame,
  selectedReferenceFrameId,
  onSelectReferenceFrame,
}) => {
  return (
    <CompactGallery
      frames={extractedFrames}
      onDelete={onDeleteFrames}
      onJumpToTime={onJumpToTime}
      activeVideo={activeVideo}
      videoSrc={videoSrc}
      sharedVideoRef={sharedVideoRef}
      roi={roi}
      onCaptureFrame={onCaptureFrame}
      selectedReferenceFrameId={selectedReferenceFrameId}
      onSelectReferenceFrame={onSelectReferenceFrame}
    />
  );
};

export default ProofreadImageGallery;
