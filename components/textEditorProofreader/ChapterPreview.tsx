import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Chapter } from './types';

interface ChapterPreviewProps {
  chapter: Chapter;
  chapterIndex: number;
  chapters: Chapter[];
  currentChapterIndex: number;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  onChapterClick: (index: number) => void;
  renderBlock: (index: number) => React.ReactNode;
}

const ChapterPreview: React.FC<ChapterPreviewProps> = ({
  chapter,
  chapterIndex,
  chapters,
  currentChapterIndex,
  scrollContainerRef,
  onChapterClick,
  renderBlock
}) => {
  const chapterKey = `${chapter.character}${chapter.chapterNum}`;
  const virtualizer = useVirtualizer({
    count: chapter.blocks.length,
    getScrollElement: () => scrollContainerRef?.current ?? null,
    estimateSize: () => 110,
    overscan: 8
  });
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div key={chapterKey} className="mb-0">
      <div className="bg-[#e8e8e0] p-5 rounded-lg border border-[#d0d0c8]">
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {virtualItems.map((virtualItem) => (
            <div
              key={virtualItem.key}
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`
              }}
            >
              {renderBlock(virtualItem.index)}
            </div>
          ))}
        </div>
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
