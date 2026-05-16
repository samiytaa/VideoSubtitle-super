import React from 'react';
import { CheckSquare, Square } from 'lucide-react';
import { ViewType } from './types';
import { ExtractedFrame, MergedImage } from '../../types';
import PaginationControls from './PaginationControls';

interface PaginationToolbarProps {
  frames: ExtractedFrame[];
  mergedImages: MergedImage[];
  filteredFrames: ExtractedFrame[];
  viewType: ViewType;
  selectedIds: Set<string>;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  itemsPerRow: number;
  onSelectAll: () => void;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (value: number) => void;
  onItemsPerRowChange: (value: 1 | 3 | 5) => void;
  onClearCurrent: () => void;
}

const PaginationToolbar: React.FC<PaginationToolbarProps> = ({
  frames,
  mergedImages,
  filteredFrames,
  viewType,
  selectedIds,
  currentPage,
  totalPages,
  itemsPerPage,
  itemsPerRow,
  onSelectAll,
  onPageChange,
  onItemsPerPageChange,
  onItemsPerRowChange,
  onClearCurrent,
}) => {
  const currentItems = viewType === 'frames' ? filteredFrames : mergedImages;
  const allCurrentSelected =
    currentItems.length > 0 && currentItems.every((item) => selectedIds.has(item.id));
  const totalCount = viewType === 'frames' ? filteredFrames.length : mergedImages.length;
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalCount);

  return (
    <div className="pt-1">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* 左侧：全选按钮和计数信息 */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSelectAll}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
            title="全选所有图片"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            全选
          </button>
          
          <div className="text-xs text-gray-600 font-medium">
            {startIndex}-{endIndex} / {totalCount}
          </div>
        </div>

        {/* 中间：分页控制 */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1 px-2 py-0.5">
            <button
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              首页
            </button>
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-1.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
                      className={`min-w-[28px] px-1.5 py-1 text-xs font-medium rounded transition-colors ${
                        currentPage === i
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-gray-700 hover:bg-gray-100'
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
              className="px-1.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ›
            </button>
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              末页
            </button>
          </div>
        )}

        {/* 右侧：分页控件 */}
        <PaginationControls
          itemsPerRow={itemsPerRow}
          itemsPerPage={itemsPerPage}
          onItemsPerRowChange={onItemsPerRowChange}
          onItemsPerPageChange={onItemsPerPageChange}
        />
      </div>
    </div>
  );
};

export default PaginationToolbar;
