import React, { useState } from 'react';
import { ExternalLink, Loader2, Info } from 'lucide-react';
import { ExtractedFrame } from '../../types';
import { formatFileSize, estimateImageSize } from '../../utils/imageUtils';

interface FrameCardProps {
  frame: ExtractedFrame;
  isSelected: boolean;
  isRangeStart: boolean;
  selectionOrder: number;
  onClick: (id: string) => void;
  onJumpToTime?: (timestamp: string) => void;
  onShowInfo?: (frame: ExtractedFrame) => void;
}

const FrameCard: React.FC<FrameCardProps> = ({
  frame,
  isSelected,
  isRangeStart,
  selectionOrder,
  onClick,
  onJumpToTime,
  onShowInfo,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  let borderClass = 'border-gray-200 bg-white hover:border-indigo-400 hover:shadow-lg';
  if (isRangeStart) {
    borderClass = 'border-green-500 bg-green-50 shadow-lg ring-2 ring-green-300';
  } else if (isSelected) {
    borderClass = 'border-indigo-500 bg-indigo-50 shadow-lg ring-2 ring-indigo-300';
  }

  return (
    <div
      onClick={() => onClick(frame.id)}
      className={`group relative border-2 transition-all duration-300 cursor-pointer overflow-hidden rounded-xl ${borderClass}`}
    >
      <div className="flex flex-col h-full">
        {/* 图片容器 - 16:9 宽高比 */}
        <div className="relative w-full bg-black overflow-hidden" style={{ paddingBottom: '56.25%' }}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </div>
          )}
          
          {hasError ? (
            <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm">
              加载失败
            </div>
          ) : (
            <img
              src={frame.url}
              alt={frame.filename}
              className="absolute inset-0 w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
              loading="lazy"
            />
          )}
          
          {/* 操作按钮 */}
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShowInfo?.(frame);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/92 text-slate-600 shadow-md backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-white"
              title="查看详细信息"
            >
              <Info className="h-3.5 w-3.5 stroke-[2.1]" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onJumpToTime?.(frame.timestamp);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/92 text-slate-600 shadow-md backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-white"
              title="跳转到视频时间点"
            >
              <ExternalLink className="h-3.5 w-3.5 stroke-[2.1]" />
            </button>
          </div>

          {/* 选中序号 */}
          {isSelected && !isRangeStart && (
            <div className="absolute top-3 left-3 min-w-[2.3rem] rounded-xl border border-white/70 bg-indigo-500/88 px-2 py-1 text-center text-[0.95rem] font-semibold leading-none text-white shadow-[0_6px_18px_rgba(79,70,229,0.22)] backdrop-blur-sm ring-1 ring-indigo-200/70 animate-in zoom-in duration-200 [font-variant-numeric:tabular-nums]">
              {selectionOrder}
            </div>
          )}

          {/* 范围起始标记 */}
          {isRangeStart && (
            <div className="absolute top-2 left-2 bg-green-600 text-white px-2 py-1 rounded-md text-[10px] font-bold shadow-lg ring-1 ring-white animate-in zoom-in duration-200 border border-white/80">
              起始
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FrameCard;
