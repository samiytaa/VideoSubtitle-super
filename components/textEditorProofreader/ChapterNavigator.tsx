import React from 'react';

interface ChapterInfo {
  chapterNum: string;
}

interface ChapterNavigatorProps {
  chapters: ChapterInfo[];
  currentChapterIndex: number;
  onChapterClick: (index: number) => void;
}

const ChapterNavigator: React.FC<ChapterNavigatorProps> = ({
  chapters,
  currentChapterIndex,
  onChapterClick
}) => {
  if (chapters.length === 0) return null;

  return (
    <div className="bg-white py-2 px-3 border-b border-gray-200 shrink-0">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {chapters.map((chapter, index) => {
              const rawNum = chapter.chapterNum || String(index + 1);
              const displayNum = rawNum.length === 1 ? `0${rawNum}` : rawNum;
              const isActive = index === currentChapterIndex;

              return (
                <button
                  key={index}
                  onClick={() => onChapterClick(index)}
                  className={`px-3 py-1 rounded-full text-xs transition-colors whitespace-nowrap ${isActive
                    ? 'bg-[#c9a95e] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {displayNum}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              if (currentChapterIndex > 0) {
                onChapterClick(currentChapterIndex - 1);
              }
            }}
            disabled={currentChapterIndex === 0}
            className={`px-3 py-1 rounded text-xs transition-colors ${currentChapterIndex === 0
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
              }`}
            title="上一节"
          >
            ◀
          </button>
          <button
            onClick={() => {
              if (currentChapterIndex < chapters.length - 1) {
                onChapterClick(currentChapterIndex + 1);
              }
            }}
            disabled={currentChapterIndex === chapters.length - 1}
            className={`px-3 py-1 rounded text-xs transition-colors ${currentChapterIndex === chapters.length - 1
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
              }`}
            title="下一节"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChapterNavigator;
