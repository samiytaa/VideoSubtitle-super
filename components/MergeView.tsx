
import React, { useState } from 'react';
import { Download, Trash2, Maximize2, Layers } from 'lucide-react';
import { MergedImage } from '../types';
import { downloadAsZip, downloadFile, formatFileSize, estimateImageSize } from '../utils/imageUtils';
import { useNotifier } from './Notifications';
import { handleError } from '../utils/errorHandler';
import { confirmDelete } from '../utils/confirmActions';

interface MergeViewProps {
  mergedImages: MergedImage[];
  onDelete?: (ids: string[]) => void;
  onClear?: () => void;
}

const MergeView: React.FC<MergeViewProps> = ({ mergedImages: initialImages = [], onDelete, onClear }) => {
  const [mergedImages, setMergedImages] = useState<MergedImage[]>(initialImages);
  const [isDownloading, setIsDownloading] = useState(false);
  const notifier = useNotifier();

  const handleDownloadAll = async () => {
    if (mergedImages.length === 0) {
      notifier.addToast('没有可下载的图片', 'warning');
      return;
    }

    setIsDownloading(true);
    try {
      const imagesToDownload = mergedImages.map(img => ({
        url: img.url,
        filename: img.filename
      }));

      await downloadAsZip(imagesToDownload, `拼接结果_${new Date().getTime()}.zip`);
      notifier.addToast(`成功下载 ${mergedImages.length} 张拼接图片`, 'success');
    } catch (error) {
      handleError(error, notifier, {
        context: 'Download failed',
        userMessage: '下载失败，请重试',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadSingle = (img: MergedImage) => {
    downloadFile(img.url, img.filename);
    notifier.addToast(`已下载 ${img.filename}`, 'success');
  };

  const handleClearAll = async () => {
    if (mergedImages.length === 0) return;

    const confirmed = await confirmDelete(mergedImages.length, '拼接', notifier);

    if (confirmed) {
      setMergedImages([]);
      if (onClear) onClear();
      notifier.addToast('已清空拼接结果', 'success');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            拼接结果展示 <Layers className="w-5 h-5 text-indigo-600" />
          </h2>
          <p className="text-gray-500">自动垂直合并的字幕长图序列。</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleDownloadAll}
            disabled={mergedImages.length === 0 || isDownloading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" /> {isDownloading ? '下载中...' : '下载所有长图'}
          </button>
          <button 
            onClick={handleClearAll}
            disabled={mergedImages.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" /> 清空列表
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {mergedImages.map(img => (
          <div key={img.id} className="group relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-xl transition-all flex flex-col">
            <div className="relative grow overflow-hidden bg-gray-900 max-h-[500px]">
              <img 
                src={img.url} 
                alt={img.filename} 
                className="w-full object-contain"
              />
              <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-40 transition-opacity flex items-center justify-center">
                <button className="bg-white p-2 rounded-full shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform">
                  <Maximize2 className="w-5 h-5 text-indigo-600" />
                </button>
              </div>
              <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded font-mono">
                {img.width}x{img.height}
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-between items-center">
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-800 truncate">{img.filename}</p>
                <p className="text-[10px] text-gray-400">{formatFileSize(estimateImageSize(img.url))} PNG</p>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadSingle(img);
                }}
                className="text-gray-400 hover:text-indigo-600 transition-colors" 
                title="下载此图"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {mergedImages.length === 0 && (
          <div className="col-span-full py-24 text-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl">
            <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">暂无拼接图片。</p>
            <p className="text-sm text-gray-400">请先提取字幕，然后在结果页选中图片进行拼接。</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MergeView;
