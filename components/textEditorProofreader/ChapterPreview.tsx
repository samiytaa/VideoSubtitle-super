import React from 'react';
import { Chapter } from './types';

interface ChapterPreviewProps {
  chapter: Chapter;
  chapterIndex: number;
  chapters: Chapter[];
  currentChapterIndex: number;
  onChapterClick: (index: number) => void;
  renderBlock: (index: number) => React.ReactNode;
}

const ChapterPreview: React.FC<ChapterPreviewProps> = ({
  chapter,
  chapterIndex,
  chapters,
  currentChapterIndex,
  onChapterClick,
  renderBlock
}) => {
  const chapterKey = `${chapter.character}${chapter.chapterNum}`;

  return (
    <div key={chapterKey} className="mb-0">
      <div className="bg-[#e8e8e0] p-5 rounded-lg border border-[#d0d0c8]">
        {chapter.blocks.map((_, index) => renderBlock(index))}
      </div>

      {chapters[0]?.format !== 'general' && (
        <div className="flex justify-center gap-3 pt-4 pb-2">
          <button
            onClick={() => currentChapterIndex > 0 && onChapterClick(currentChapterIndex - 1)}
            disabled={currentChapterIndex === 0}
            className={`bg-white border border-gray-300 px-6 py-2.5 rounded text-sm transition-all ${currentChapterIndex === 0 ? 'text-gray-400 cursor-not-allowed opacity-50' : 'text-gray-800 cursor-pointer hover:bg-gray-100 hover:border-gray-400'}`}
          >
            上一节
          </button>
          <button
            onClick={() => currentChapterIndex < chapters.length - 1 && onChapterClick(currentChapterIndex + 1)}
            disabled={currentChapterIndex === chapters.length - 1}
            className={`bg-white border border-gray-300 px-6 py-2.5 rounded text-sm transition-all ${currentChapterIndex === chapters.length - 1 ? 'text-gray-400 cursor-not-allowed opacity-50' : 'text-gray-800 cursor-pointer hover:bg-gray-100 hover:border-gray-400'}`}
          >
            下一节
          </button>
        </div>
      )}
    </div>
  );
};

export default ChapterPreview;

