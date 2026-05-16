import React from 'react';
import {
  Download,
  Scissors,
  Image as ImageIcon,
  Trash2,
  Layers,
  Upload,
  Sparkles,
  CheckSquare,
} from 'lucide-react';
import { GalleryToolbarProps } from './types';

const GalleryToolbar: React.FC<GalleryToolbarProps> = ({
  frames,
  mergedImages,
  filteredFrames,
  viewType,
  selectedGroup,
  selectedIds,
  rangeSelectMode,
  isDeduplicating,
  deduplicateProgress,
  isDownloading,
  batchSize,
  fileInputRef,
  onViewTypeChange,
  onGroupChange,
  onToggleRangeSelectMode,
  onMergeSelected,
  onBatchSizeChange,
  onRemoveDuplicates,
  onImportClick,
  onFileImport,
  onDownloadZip,
  onClearCurrent,
  onMergeGroupsClick,
  onSelectAll,
}) => {
  const selectedFramesCount = filteredFrames.filter((f) => selectedIds.has(f.id)).length;
  const currentCount = viewType === 'frames' ? filteredFrames.length : mergedImages.length;

  return (
    <>
      {/* 工具栏主体 */}
      <div className="space-y-2">
        {/* 第一行：标题和视图切换 */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* 左侧：标题和图片数量 */}
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-lg font-bold text-gray-900 whitespace-nowrap">
            {viewType === 'frames' ? '截取结果' : '拼接结果'}
          </h2>
          {(frames.length > 0 || mergedImages.length > 0) && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full whitespace-nowrap flex items-center gap-1">
              <CheckSquare className="w-3 h-3" />
              已自动保存
            </span>
          )}
        </div>

        {/* 中间：导入、下载和清空 */}
        <div className="flex items-center gap-1.5 flex-1 justify-center min-w-[180px]">
          <button
            onClick={onImportClick}
            className="flex items-center gap-1 px-2 py-1 text-xs text-green-700 hover:bg-green-50 rounded transition-colors"
            title="导入图片"
          >
            <Upload className="w-3.5 h-3.5" /> 导入
          </button>
          <button
            onClick={onDownloadZip}
            disabled={
              (viewType === 'frames' ? filteredFrames.length === 0 : mergedImages.length === 0) ||
              isDownloading
            }
            className="flex items-center gap-1 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
            title="下载ZIP"
          >
            <Download className="w-3.5 h-3.5" /> {isDownloading ? '下载中' : 'ZIP'}
          </button>
          <button
            onClick={onClearCurrent}
            disabled={currentCount === 0}
            className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="清空当前列表"
          >
            <Trash2 className="w-3.5 h-3.5" /> 清空
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={onFileImport}
            className="hidden"
          />
        </div>

        {/* 右侧：视图切换 */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => onViewTypeChange('frames')}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                viewType === 'frames'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5" />
                截取结果
              </span>
            </button>
            <button
              onClick={() => onViewTypeChange('merged')}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                viewType === 'merged'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                拼接结果
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <div className="overflow-x-auto">
          <div className="flex min-w-max items-center gap-3 py-0">
            {viewType === 'frames' && (
              <>
                <div className="flex items-center gap-1">
                    {[
                      { key: 'all', label: '全部', count: frames.length },
                      { key: 'group1', label: '【对话】', count: frames.filter((f) => f.group === 'group1').length },
                      { key: 'group2', label: '【地点】', count: frames.filter((f) => f.group === 'group2').length },
                    ].map(({ key, label, count }) => (
                      <button
                        key={key}
                        onClick={() => onGroupChange(key as any)}
                        className={`px-2 py-1 text-xs rounded transition-all whitespace-nowrap ${
                          selectedGroup === key
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {label} ({count})
                      </button>
                    ))}
                </div>

                <button
                  onClick={onMergeGroupsClick}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 rounded transition-colors whitespace-nowrap"
                  title="合并分组"
                >
                  <Layers className="w-3.5 h-3.5" />
                  合并分组
                </button>

                <button
                  onClick={onRemoveDuplicates}
                  disabled={filteredFrames.length === 0 || isDeduplicating}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-purple-700 hover:bg-purple-50 rounded transition-colors disabled:opacity-50 whitespace-nowrap"
                  title="去除重复"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isDeduplicating
                    ? `${deduplicateProgress.current}/${deduplicateProgress.total}`
                    : '去重'}
                </button>

                <button
                  onClick={onMergeSelected}
                  disabled={selectedFramesCount < 1}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  <Scissors className="w-3.5 h-3.5" /> 拼接 ({selectedFramesCount})
                </button>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={batchSize}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    onBatchSizeChange(Math.max(1, Math.min(100, value)));
                  }}
                  className="w-10 text-xs text-center bg-white border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  title="每组张数"
                />
              </>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* 范围选择提示 */}
      {rangeSelectMode && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-purple-700">
            <span className="font-medium">范围选择:</span>
            <span>点击图片选择范围</span>
          </div>
          <button
            onClick={onToggleRangeSelectMode}
            className="text-xs text-purple-600 hover:text-purple-800"
          >
            取消
          </button>
        </div>
      )}
    </>
  );
};

export default GalleryToolbar;
