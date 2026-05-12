import { MutableRefObject } from 'react';
import { Chapter, ParsedBlock, SearchResult } from './types';

interface UseEditorSearchParams {
  chapters: Chapter[];
  setSearchKeyword: (value: string) => void;
  setSearchResults: (value: SearchResult[]) => void;
  setCurrentChapterIndexSafe: (index: number) => void;
  setShowSearchDialog: (open: boolean) => void;
  setNestedSelectedOption: (updater: (prev: Record<number, number | null>) => Record<number, number | null>) => void;
  setNestedHighlight: (value: { blockIndex: number; showIndex: number; bi?: number } | null) => void;
  blockRefs: MutableRefObject<{ [key: string]: HTMLDivElement | null }>;
}

export const useEditorSearch = (params: UseEditorSearchParams) => {
  const handleSearch = (keyword: string) => {
    params.setSearchKeyword(keyword);

    if (!keyword.trim()) {
      params.setSearchResults([]);
      return;
    }

    const results: SearchResult[] = [];

    const searchBlock = (b: ParsedBlock, chapterIndex: number, blockIndex: number, nestedShowIndex?: number, nestedBi?: number) => {
      if (b.type === 'narration' || b.type === 'narration-thought') {
        if (b.content.includes(keyword)) {
          results.push({ chapterIndex, blockIndex, type: 'narration', content: b.content, matchText: b.content, nestedShowIndex, nestedBi });
        }
      }
      if (b.type === 'dialogue') {
        if (b.content.includes(keyword)) {
          results.push({ chapterIndex, blockIndex, type: 'dialogue', content: b.content, character: b.character, matchText: b.content, nestedShowIndex, nestedBi });
        }
        if (b.character && b.character.includes(keyword)) {
          results.push({ chapterIndex, blockIndex, type: 'character', content: b.content, character: b.character, matchText: b.character, nestedShowIndex, nestedBi });
        }
      }
    };

    params.chapters.forEach((chapter, chapterIndex) => {
      chapter.blocks.forEach((block, blockIndex) => {
        if (block.type === 'header' || block.type === 'footer') return;

        if (block.type === 'nested-choice-group') {
          (block.nestedOptions || []).forEach(opt => {
            if (opt.label.includes(keyword)) {
              results.push({ chapterIndex, blockIndex, type: 'nested-option', content: opt.label, matchText: opt.label, nestedShowIndex: opt.showIndex });
            }
            opt.blocks.forEach((b, bi) => searchBlock(b, chapterIndex, blockIndex, opt.showIndex, bi));
          });
          return;
        }

        searchBlock(block, chapterIndex, blockIndex);
      });
    });

    params.setSearchResults(results);
  };

  const jumpToSearchResult = (chapterIndex: number, blockIndex: number, nestedShowIndex?: number, nestedBi?: number) => {
    params.setCurrentChapterIndexSafe(chapterIndex);
    params.setShowSearchDialog(false);

    if (nestedShowIndex !== undefined) {
      params.setNestedSelectedOption(prev => ({ ...prev, [blockIndex]: nestedShowIndex }));
      params.setNestedHighlight({ blockIndex, showIndex: nestedShowIndex, bi: nestedBi });
      setTimeout(() => params.setNestedHighlight(null), 2000);
    }

    setTimeout(() => {
      const refKey = nestedShowIndex !== undefined && nestedBi !== undefined
        ? `nested-${blockIndex}-${nestedShowIndex}-${nestedBi}`
        : `${chapterIndex}-${blockIndex}`;
      const blockElement = params.blockRefs.current[refKey] ?? params.blockRefs.current[`${chapterIndex}-${blockIndex}`];

      if (blockElement) {
        blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (nestedShowIndex === undefined) {
          blockElement.style.transition = 'background-color 0.3s';
          blockElement.style.backgroundColor = '#fef3c7';
          setTimeout(() => { blockElement.style.backgroundColor = ''; }, 2000);
        }
      }
    }, 100);
  };

  return { handleSearch, jumpToSearchResult };
};

