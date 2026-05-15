import React from 'react';
import { Trash2 } from 'lucide-react';

interface PaginationControlsProps {
  itemsPerRow: number;
  itemsPerPage: number;
  totalCount: number;
  onItemsPerRowChange: (value: 1 | 3 | 5) => void;
  onItemsPerPageChange: (value: number) => void;
  onClearCurrent: () => void;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  itemsPerRow,
  itemsPerPage,
  totalCount,
  onItemsPerRowChange,
  onItemsPerPageChange,
  onClearCurrent,
}) => {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-2 py-1">
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500">每行</span>
        <select
          value={itemsPerRow}
          onChange={(e) => onItemsPerRowChange(Number(e.target.value) as any)}
          className="h-7 min-w-[72px] rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent"
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
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="h-7 min-w-[72px] rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>
      </div>

      <div className="h-5 w-px bg-gray-200" />

      <button
        onClick={onClearCurrent}
        disabled={totalCount === 0}
        className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="清空当前列表"
      >
        <Trash2 className="w-3 h-3" />
        清空
      </button>
    </div>
  );
};

export default PaginationControls;
