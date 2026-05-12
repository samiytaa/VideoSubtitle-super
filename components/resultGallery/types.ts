import React from 'react';
import { ExtractedFrame, MergedImage } from '../../types';

export type ViewType = 'frames' | 'merged';
export type GroupFilter = 'all' | 'group1' | 'group2';
export type ItemsPerRow = 1 | 3 | 5;

export interface ResultGalleryProps {
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
}

export interface GalleryToolbarProps {
  // 数据
  frames: ExtractedFrame[];
  mergedImages: MergedImage[];
  filteredFrames: ExtractedFrame[];
  // 视图状态
  viewType: ViewType;
  selectedGroup: GroupFilter;
  selectedIds: Set<string>;
  selectedOrder: string[];
  rangeSelectMode: boolean;
  rangeStart: string | null;
  // 分页
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  itemsPerRow: ItemsPerRow;
  // 去重状态
  isDeduplicating: boolean;
  deduplicateProgress: { current: number; total: number };
  // 下载状态
  isDownloading: boolean;
  // 拼接参数
  batchSize: number;
  // 文件输入 ref
  fileInputRef: React.RefObject<HTMLInputElement>;
  // 回调
  onViewTypeChange: (type: ViewType) => void;
  onGroupChange: (group: GroupFilter) => void;
  onSelectAll: () => void;
  onInvertSelection: () => void;
  onToggleRangeSelectMode: () => void;
  onClearSelection: () => void;
  onMergeSelected: () => void;
  onBatchSizeChange: (size: number) => void;
  onRemoveDuplicates: () => void;
  onImportClick: () => void;
  onFileImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDownloadZip: () => void;
  onDeleteSelected: () => void;
  onClearCurrent: () => void;
  onClearAllData: () => void;
  onMergeGroupsClick: () => void;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (n: number) => void;
  onItemsPerRowChange: (n: ItemsPerRow) => void;
}
