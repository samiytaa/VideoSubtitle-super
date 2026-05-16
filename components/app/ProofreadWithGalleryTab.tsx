import React, { useState } from 'react';
import FormatConverter from '../FormatConverter';
import ProofreadGallery from '../ProofreadGallery';
import { ExtractedFrame, MergedImage } from '../../types';
import { Image as ImageIcon, FileText, Layout } from 'lucide-react';

type ProofreadWithGalleryTabProps = {
  extractedFrames: ExtractedFrame[];
  mergedImages: MergedImage[];
  onJumpToTime: (timestamp: string) => void;
};

type LayoutMode = 'text-only' | 'image-only' | 'split';

const ProofreadWithGalleryTab: React.FC<ProofreadWithGalleryTabProps> = ({
  extractedFrames,
  mergedImages,
  onJumpToTime,
}) => {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('text-only');

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col bg-gray-50">
      {/* 顶部布局切换按钮 */}
      <div className="flex items-center gap-2 p-3 bg-white border-b border-gray-200 shadow-sm">
        <Layout className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">布局模式：</span>
        <div className="flex gap-2">
          <button
            onClick={() => setLayoutMode('text-only')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              layoutMode === 'text-only'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            仅文本校对
          </button>
          <button
            onClick={() => setLayoutMode('image-only')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              layoutMode === 'image-only'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            仅查看图片
          </button>
          <button
            onClick={() => setLayoutMode('split')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              layoutMode === 'split'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Layout className="w-4 h-4" />
            左右分屏
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {layoutMode === 'text-only' && (
          <div className="h-full p-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 p-4 h-full flex flex-col">
              <FormatConverter />
            </div>
          </div>
        )}

        {layoutMode === 'image-only' && (
          <div className="h-full p-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 h-full overflow-hidden">
              <ProofreadGallery
                frames={extractedFrames}
                mergedImages={mergedImages}
                onJumpToTime={onJumpToTime}
              />
            </div>
          </div>
        )}

        {layoutMode === 'split' && (
          <div className="h-full flex gap-4 p-4">
            {/* 左侧：文本校对 */}
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 p-4 h-full flex flex-col">
                <FormatConverter />
              </div>
            </div>

            {/* 右侧：图片查看 */}
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 h-full overflow-hidden">
                <ProofreadGallery
                  frames={extractedFrames}
                  mergedImages={mergedImages}
                  onJumpToTime={onJumpToTime}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProofreadWithGalleryTab;
