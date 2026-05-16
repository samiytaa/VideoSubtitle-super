import React, { useState } from 'react';
import { Download, Loader2, Info } from 'lucide-react';
import { MergedImage } from '../../types';
import { formatFileSize, estimateImageSize, downloadFile } from '../../utils/imageUtils';
import { useNotifier } from '../Notifications';

interface MergedImageCardProps {
  img: MergedImage;
  isSelected: boolean;
  isRangeStart: boolean;
  selectionOrder: number;
  onClick: (id: string) => void;
  onShowInfo?: (img: MergedImage) => void;
}

const MergedImageCard: React.FC<MergedImageCardProps> = ({
  img,
  isSelected,
  isRangeStart,
  selectionOrder,
  onClick,
  onShowInfo,
}) => {
  const notifier = useNotifier();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  let borderClass = 'border-gray-200 bg-white hover:border-indigo-400 hover:shadow-lg';
  if (isRangeStart) {
    borderClass = 'border-green-500 bg-green-50 shadow-lg ring-2 ring-green-300';
  } else if (isSelected) {
    borderClass = 'border-indigo-500 bg-indigo-50 shadow-lg ring-2 ring-indigo-300';
  }

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadFile(img.url, img.filename);
    notifier.addToast(`已下载 ${img.filename}`, 'success');
  };

  // 计算图片宽高比，用于动态容器高度
  const aspectRatio = img.height / img.width;
  const isVertical = aspectRatio > 1.5; // 竖图判断

  return (
    <div
      onClick={() => onClick(img.id)}
      className={`group relative border-2 transition-all duration-300 cursor-pointer overflow-hidden rounded-xl ${borderClass}`}
    >
      <div className="flex flex-col h-full">
        {/* 图片容器 - 动态高度 */}
        <div 
          className="relative w-full bg-black overflow-hidden"
          style={{ 
            paddingBottom: isVertical ? '150%' : '75%', // 竖图更高，横图适中
            maxHeight: '600px'
          }}
        >
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
              src={img.url}
              alt={img.filename}
              className="absolute inset-0 w-full h-full object-contain group-hover:scale-[1.01] transition-transform duration-300"
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
              loading="lazy"
            />
          )}
          
          {/* 尺寸标签 */}
          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-md font-mono shadow-lg border border-white/20">
            {img.width}×{img.height}
          </div>

          {/* 操作按钮 */}
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShowInfo?.(img);
              }}
              className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white/92 text-slate-600 shadow-md backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-white"
              title="查看详细信息"
            >
              <Info className="h-3 w-3 stroke-[2.1]" />
            </button>
            <button
              onClick={handleDownload}
              className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white/92 text-slate-600 shadow-md backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-white"
              title="下载此图"
            >
              <Download className="h-3 w-3 stroke-[2.1]" />
            </button>
          </div>

          {/* 选中序号 */}
          {isSelected && !isRangeStart && (
            <div className="absolute bottom-2 left-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/70 bg-indigo-500/88 text-xs font-semibold text-white shadow-[0_4px_12px_rgba(79,70,229,0.22)] backdrop-blur-sm ring-1 ring-indigo-200/70 animate-in zoom-in duration-200 [font-variant-numeric:tabular-nums]">
              {selectionOrder}
            </div>
          )}

          {/* 范围起始标记 */}
          {isRangeStart && (
            <div className="absolute bottom-2 left-2 bg-green-600 text-white px-2 py-1 rounded-md text-[10px] font-bold shadow-lg ring-1 ring-white animate-in zoom-in duration-200 border border-white/80">
              起始
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MergedImageCard;
