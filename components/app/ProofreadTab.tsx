import React, { useState } from 'react';
import FormatConverter from '../FormatConverter';
import ProofreadGallery from '../ProofreadGallery';
import { ExtractedFrame, MergedImage } from '../../types';
import { Image as ImageIcon, FileText } from 'lucide-react';

type ProofreadTabProps = {
  extractedFrames: ExtractedFrame[];
  mergedImages: MergedImage[];
  onJumpToTime: (timestamp: string) => void;
};

const ProofreadTab: React.FC<ProofreadTabProps> = ({
  extractedFrames,
  mergedImages,
  onJumpToTime,
}) => {
  const [showGallery, setShowGallery] = useState(false);

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col">
      {/* 切换按钮 */}
      <div className="flex items-center gap-2 p-3 bg-white border-b border-gray-200">
        <button
          onClick={() => setShowGallery(false)}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            !showGallery
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          文本校对
        </button>
        <button
          onClick={() => setShowGallery(true)}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            showGallery
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          查看图片
        </button>
      </div>

      {/* 内容区域 */}
      <section className="flex-1 flex flex-col min-h-0">
        {showGallery ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 flex-1 flex flex-col min-h-0 overflow-hidden">
            <ProofreadGallery
              frames={extractedFrames}
              mergedImages={mergedImages}
              onJumpToTime={onJumpToTime}
            />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 p-4 flex-1 flex flex-col min-h-0">
            <FormatConverter />
          </div>
        )}
      </section>
    </div>
  );
};

export default ProofreadTab;
