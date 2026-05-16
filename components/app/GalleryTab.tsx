import React from 'react';
import ResultGallery from '../ResultGallery';
import { ExtractedFrame, MergedImage } from '../../types';

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

const GalleryTab: React.FC<GalleryTabProps> = ({
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

export default GalleryTab;
