import React from 'react';
import {
  Download,
  CheckSquare,
  Square,
  Scissors,
  Image as ImageIcon,
  Trash2,
  Layers,
  Upload,
  X,
  Sparkles,
} from 'lucide-react';
import { GalleryToolbarProps } from './types';

const GalleryToolbar: React.FC<GalleryToolbarProps> = ({
  frames,
  mergedImages,
  filteredFrames,
  viewType,
  selectedGroup,
  selectedIds,
  selectedOrder,
  rangeSelectMode,
  rangeStart,
  currentPage,
  totalPages,
  itemsPerPage,
  itemsPerRow,
  isDeduplicating,
  deduplicateProgress,
  isDownloading,
  batchSize,
  fileInputRef,
  onViewTypeChange,
  onGroupChange,
  onSelectAll,
  onInvertSelection,
  onToggleRangeSelectMode,
  onClearSelection,
  onMergeSelected,
  onBatchSizeChange,
  onRemoveDuplicates,
  onImportClick,
  onFileImport,
  onDownloadZip,
  onDeleteSelected,
  onClearCurrent,
  onClearAllData,
  onMergeGroupsClick,
  onPageChange,
  onItemsPerPageChange,
  onItemsPerRowChange,
}) => {
  const currentItems = viewType === 'frames' ? filteredFrames : mergedImages;
  const allCurrentSelected =
    currentItems.length > 0 && currentItems.every((item) => selectedIds.has(item.id));
  const selectedInCurrentView = currentItems.filter((item) => selectedIds.has(item.id)).length;
  const selectedFramesCount = filteredFrames.filter((f) => selectedIds.has(f.id)).length;

  return (
    <div className="sticky top-10 z-40 bg-white -mx-6 px-6 -mt-6 pt-4 shadow-sm">
      {/* 第一行：标题和视图切换 */}
      <div className="flex items-center justify-between gap-4 pb-3">
        {/* 左侧：标题和图片数量 */}
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-lg font-bold text-gray-900 whitespace-nowrap">
            {viewType === 'frames' ? '截取结果' : '拼接结果'}
          </h2>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap">
            共 {viewType === 'frames' ? filteredFrames.length : mergedImages.length} 张图片
          </span>
          {(frames.length > 0 || mergedImages.length > 0) && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full whitespace-nowrap flex items-center gap-1">
              <CheckSquare className="w-3 h-3" />
              已自动保存
            </span>
          )}
        </div>

        {/* 右侧：视图切换和清空所有数据按钮 */}
        <div className="flex items-center gap-3 shrink-0">
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

          {(frames.length > 0 || mergedImages.length > 0) && (
            <button
              onClick={onClearAllData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-700 border border-red-800 rounded-lg hover:bg-red-800 transition-colors shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" /> 清空所有数据
            </button>
          )}
        </div>
      </div>

      {/* 分组过滤器 - 仅在截取结果视图显示 */}
      {viewType === 'frames' && (
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">分组筛选：</span>
            <div className="flex items-center gap-1">
              {[
                { key: 'all', label: '全部', count: frames.length },
                { key: 'group1', label: '【对话】', count: frames.filter((f) => f.group === 'group1').length },
                { key: 'group2', label: '【地点】', count: frames.filter((f) => f.group === 'group2').length },
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => onGroupChange(key as any)}
                  className={`px-2 py-1 text-xs rounded transition-all ${
                    selectedGroup === key
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onMergeGroupsClick}
            className="flex items-center gap-1 px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 rounded transition-colors"
            title="合并分组"
          >
            <Layers className="w-3.5 h-3.5" />
            合并分组
          </button>
        </div>
      )}

      {/* 操作按钮区域 */}
      <div className="pb-2 border-b border-gray-200">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* 左侧：选择操作 */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onSelectAll}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 rounded transition-colors"
              title="全选"
            >
              {allCurrentSelected ? (
                <CheckSquare className="w-3.5 h-3.5" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
              全选
            </button>
            <button
              onClick={onInvertSelection}
              className="px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 rounded transition-colors"
              title="反选"
            >
              反选
            </button>
            <button
              onClick={onToggleRangeSelectMode}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                rangeSelectMode ? 'bg-purple-100 text-purple-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
              title="范围选择"
            >
              <Scissors className="w-3.5 h-3.5" />
              范围选择
            </button>

            {selectedIds.size > 0 && (
              <>
                <div className="h-4 w-px bg-gray-300" />
                <span className="text-xs text-indigo-600 font-medium">
                  已选 {selectedInCurrentView} 项
                </span>
              </>
            )}
          </div>

          {/* 中间：图片处理 */}
          <div className="flex items-center gap-1.5">
            {viewType === 'frames' && (
              <>
                <button
                  onClick={onRemoveDuplicates}
                  disabled={filteredFrames.length === 0 || isDeduplicating}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-purple-700 hover:bg-purple-50 rounded transition-colors disabled:opacity-50"
                  title="去除重复"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isDeduplicating
                    ? `${deduplicateProgress.current}/${deduplicateProgress.total}`
                    : '去重'}
                </button>

                <div className="h-4 w-px bg-gray-300" />

                <button
                  onClick={onMergeSelected}
                  disabled={selectedFramesCount < 1}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
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

                <div className="h-4 w-px bg-gray-300" />
              </>
            )}
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={onFileImport}
              className="hidden"
            />
          </div>

          {/* 右侧：删除和显示控制 */}
          <div className="flex items-center gap-1.5">
            {selectedInCurrentView > 0 && (
              <>
                <button
                  onClick={onClearSelection}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                  title="取消选择"
                >
                  <X className="w-3.5 h-3.5" /> 取消选择
                </button>
                <button
                  onClick={onDeleteSelected}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                  title={`删除选中 (${selectedInCurrentView})`}
                >
                  <Trash2 className="w-3.5 h-3.5" /> 删除({selectedInCurrentView})
                </button>
              </>
            )}
            <button
              onClick={onClearCurrent}
              disabled={viewType === 'frames' ? filteredFrames.length === 0 : mergedImages.length === 0}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
              title="清空列表"
            >
              <Trash2 className="w-3.5 h-3.5" /> 清空
            </button>

            <div className="h-4 w-px bg-gray-300" />

            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">每行</span>
              <select
                value={itemsPerRow}
              onChange={(e) => onItemsPerRowChange(Number(e.target.value) as any)}
              className="px-1 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value={1}>1张</option>
                <option value={3}>3张</option>
                <option value={5}>5张</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">每页</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  onItemsPerPageChange(Number(e.target.value));
                  onPageChange(1);
                }}
                className="px-1 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 分页控制 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            {(currentPage - 1) * itemsPerPage + 1}-
            {Math.min(
              currentPage * itemsPerPage,
              viewType === 'frames' ? filteredFrames.length : mergedImages.length
            )}
            / {viewType === 'frames' ? filteredFrames.length : mergedImages.length}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 text-xs text-gray-700 hover:bg-white rounded transition-colors disabled:opacity-30"
            >
              首页
            </button>
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 text-xs text-gray-700 hover:bg-white rounded transition-colors disabled:opacity-30"
            >
              ‹
            </button>

            <div className="flex items-center gap-1">
              {(() => {
                const pages = [];
                const showPages = 5;
                let startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
                let endPage = Math.min(totalPages, startPage + showPages - 1);
                if (endPage - startPage < showPages - 1) {
                  startPage = Math.max(1, endPage - showPages + 1);
                }
                for (let i = startPage; i <= endPage; i++) {
                  pages.push(
                    <button
                      key={i}
                      onClick={() => onPageChange(i)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        currentPage === i ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-white'
                      }`}
                    >
                      {i}
                    </button>
                  );
                }
                return pages;
              })()}
            </div>

            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 text-xs text-gray-700 hover:bg-white rounded transition-colors disabled:opacity-30"
            >
              ›
            </button>
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 text-xs text-gray-700 hover:bg-white rounded transition-colors disabled:opacity-30"
            >
              末页
            </button>
          </div>

          <div className="text-xs text-gray-500">
            {currentPage}/{totalPages}
          </div>
        </div>
      )}

      {/* 范围选择提示 */}
      {rangeSelectMode && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 mt-2 mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-purple-700">
            <span className="font-medium">范围选择:</span>
            <span>{!rangeStart ? '点击起始图片' : '点击结束图片'}</span>
          </div>
          <button
            onClick={onToggleRangeSelectMode}
            className="text-xs text-purple-600 hover:text-purple-800"
          >
            取消
          </button>
        </div>
      )}
    </div>
  );
};

export default GalleryToolbar;
