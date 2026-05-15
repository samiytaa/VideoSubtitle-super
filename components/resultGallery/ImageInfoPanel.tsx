import React from 'react';
import { Clock, FileText, Image as ImageIcon, Layers, HardDrive, Calendar } from 'lucide-react';
import { ExtractedFrame, MergedImage } from '../../types';
import { formatFileSize, estimateImageSize } from '../../utils/imageUtils';
import RightSlidePanel from '../common/RightSlidePanel';

interface ImageInfoPanelProps {
  item: ExtractedFrame | MergedImage | null;
  viewType: 'frames' | 'merged';
  onClose: () => void;
}

const ImageInfoPanel: React.FC<ImageInfoPanelProps> = ({ item, viewType, onClose }) => {
  if (!item) return null;

  const isFrame = viewType === 'frames';
  const frame = isFrame ? (item as ExtractedFrame) : null;
  const merged = !isFrame ? (item as MergedImage) : null;

  return (
    <RightSlidePanel
      open={!!item}
      onClose={onClose}
      title="图片详情"
      headerIcon={<ImageIcon className="w-5 h-5 text-indigo-600" />}
    >
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 图片预览 */}
        <div
          className="flex items-center justify-center overflow-hidden rounded-xl border-2 border-gray-200 bg-black"
          style={{ maxHeight: '400px' }}
        >
          <img
            src={item.url}
            alt={item.filename}
            className="h-auto w-full object-contain"
            style={{ maxHeight: '400px' }}
          />
        </div>

        {/* 基本信息 */}
        <div className="space-y-3 rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <FileText className="h-4 w-4 text-indigo-600" />
            基本信息
          </h4>

          <div className="space-y-2.5">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="mb-0.5 text-xs text-gray-500">文件名</p>
                <p className="break-all text-sm font-medium text-gray-800">{item.filename}</p>
              </div>
            </div>

            {frame && (
              <>
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div className="flex-1">
                    <p className="mb-0.5 text-xs text-gray-500">时间戳</p>
                    <p className="text-sm font-semibold text-indigo-600">{frame.timestamp}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Layers className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div className="flex-1">
                    <p className="mb-0.5 text-xs text-gray-500">分组</p>
                    <p className="text-sm text-gray-800">
                      {frame.group === 'group1' ? '【对话】' : '【地点】'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="mb-0.5 text-xs text-gray-500">视频名称</p>
                    <p className="truncate text-sm text-gray-800">{frame.videoName}</p>
                  </div>
                </div>
              </>
            )}

            {merged && (
              <div className="flex items-start gap-3">
                <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <div className="flex-1">
                  <p className="mb-0.5 text-xs text-gray-500">图片尺寸</p>
                  <p className="font-mono text-sm text-gray-800">
                    {merged.width} × {merged.height} px
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div className="flex-1">
                <p className="mb-0.5 text-xs text-gray-500">文件大小</p>
                <p className="text-sm font-medium text-gray-800">
                  {formatFileSize(estimateImageSize(item.url))}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div className="flex-1">
                <p className="mb-0.5 text-xs text-gray-500">ID</p>
                <p className="break-all font-mono text-xs text-gray-600">{item.id}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="space-y-2">
          <button
            onClick={() => {
              const a = document.createElement('a');
              a.href = item.url;
              a.download = item.filename;
              a.click();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-200"
          >
            <HardDrive className="h-4 w-4" />
            下载图片
          </button>
        </div>
      </div>
    </RightSlidePanel>
  );
};

export default ImageInfoPanel;
