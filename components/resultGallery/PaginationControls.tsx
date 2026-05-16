import React from 'react';

interface PaginationControlsProps {
  itemsPerRow: number;
  itemsPerPage: number;
  onItemsPerRowChange: (value: 1 | 3 | 5) => void;
  onItemsPerPageChange: (value: number) => void;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  itemsPerRow,
  itemsPerPage,
  onItemsPerRowChange,
  onItemsPerPageChange,
}) => {
  return (
    <div className="flex items-center gap-2 px-2 py-1">
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
    </div>
  );
};

export default PaginationControls;
