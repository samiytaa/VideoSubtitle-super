import React from 'react';
import { ExternalLink } from 'lucide-react';
import { ExtractedFrame } from '../../types';
import { formatFileSize, estimateImageSize } from '../../utils/imageUtils';

interface FrameCardProps {
  frame: ExtractedFrame;
  isSelected: boolean;
  isRangeStart: boolean;
  selectionOrder: number;
  onClick: (id: string) => void;
  onJumpToTime?: (timestamp: string) => void;
}

const FrameCard: React.FC<FrameCardProps> = ({
  frame,
  isSelected,
  isRangeStart,
  selectionOrder,
  onClick,
  onJumpToTime,
}) => {
  let borderClass = 'border-gray-200 bg-white hover:border-indigo-300';
  if (isRangeStart) {
    borderClass = 'border-green-500 bg-green-50 shadow-md ring-2 ring-green-200';
  } else if (isSelected) {
    borderClass = 'border-indigo-500 bg-indigo-50 shadow-md ring-2 ring-indigo-200';
  }

  return (
    <div
      onClick={() => onClick(frame.id)}
      className={`group relative border transition-all cursor-pointer overflow-hidden rounded-xl ${borderClass}`}
    >
      <div className="flex flex-col h-full">
        <div className="relative bg-black overflow-hidden flex items-center justify-center min-h-[120px]">
          <img
            src={frame.url}
            alt={frame.filename}
            className="w-full object-contain group-hover:scale-105 transition-transform duration-500 max-h-[300px]"
          />
          <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity" />
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onJumpToTime?.(frame.timestamp);
              }}
              className="p-1.5 bg-white/80 backdrop-blur rounded-full text-indigo-600 hover:bg-white shadow-sm"
              title="跳转到视频时间点"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {isSelected && !isRangeStart && (
            <div className="absolute top-2 left-2 bg-indigo-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
              {selectionOrder}
            </div>
          )}

          {isRangeStart && (
            <div className="absolute top-2 left-2 bg-green-600 text-white px-2 py-1 rounded-md text-xs font-bold shadow-lg">
              起始
            </div>
          )}
        </div>
        <div className="p-2 flex justify-between items-center bg-gray-50">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-indigo-600 font-medium">{frame.timestamp}</p>
            <p className="text-[11px] text-gray-600 truncate">{frame.filename}</p>
          </div>
          <div className="text-[10px] text-gray-400 ml-2">
            {formatFileSize(estimateImageSize(frame.url))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FrameCard;
