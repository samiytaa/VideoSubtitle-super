import React from 'react';
import { Download } from 'lucide-react';
import { MergedImage } from '../../types';
import { formatFileSize, estimateImageSize, downloadFile } from '../../utils/imageUtils';
import { useNotifier } from '../Notifications';

interface MergedImageCardProps {
  img: MergedImage;
  isSelected: boolean;
  isRangeStart: boolean;
  selectionOrder: number;
  onClick: (id: string) => void;
}

const MergedImageCard: React.FC<MergedImageCardProps> = ({
  img,
  isSelected,
  isRangeStart,
  selectionOrder,
  onClick,
}) => {
  const notifier = useNotifier();

  let borderClass = 'border-gray-200 bg-white hover:border-indigo-300';
  if (isRangeStart) {
    borderClass = 'border-green-500 bg-green-50 shadow-md ring-2 ring-green-200';
  } else if (isSelected) {
    borderClass = 'border-indigo-500 bg-indigo-50 shadow-md ring-2 ring-indigo-200';
  }

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadFile(img.url, img.filename);
    notifier.addToast(`已下载 ${img.filename}`, 'success');
  };

  return (
    <div
      onClick={() => onClick(img.id)}
      className={`group relative border transition-all cursor-pointer overflow-hidden rounded-xl ${borderClass}`}
    >
      <div className="flex flex-col h-full">
        <div className="relative bg-gray-900 overflow-hidden max-h-[400px] flex items-center justify-center">
          <img
            src={img.url}
            alt={img.filename}
            className="w-full object-contain"
          />
          <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity" />
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleDownload}
              className="p-1.5 bg-white/80 backdrop-blur rounded-full text-indigo-600 hover:bg-white shadow-sm"
              title="下载此图"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded font-mono">
            {img.width}x{img.height}
          </div>

          {isSelected && !isRangeStart && (
            <div className="absolute bottom-2 left-2 bg-indigo-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
              {selectionOrder}
            </div>
          )}

          {isRangeStart && (
            <div className="absolute bottom-2 left-2 bg-green-600 text-white px-2 py-1 rounded-md text-xs font-bold shadow-lg">
              起始
            </div>
          )}
        </div>
        <div className="p-2 flex justify-between items-center bg-gray-50">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-gray-600 truncate">{img.filename}</p>
            <p className="text-[10px] text-gray-400">{formatFileSize(estimateImageSize(img.url))}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MergedImageCard;
