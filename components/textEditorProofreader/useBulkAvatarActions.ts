import type React from 'react';
import { produce } from 'immer';
import { Chapter } from './types';

interface UseBulkAvatarActionsParams {
  chapters: Chapter[];
  currentChapterIndex: number;
  selectedBlockIndices: Set<number>;
  selectedNestedKeys: Set<string>;
  characterAvatarHistory: Record<string, string[]>;
  setCharacterAvatarHistory: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  commitChapters: (chapters: Chapter[]) => void;
  setShowBatchAvatarPicker: (open: boolean) => void;
  clearSelections: () => void;
  exitMultiSelect: () => void;
}

export const useBulkAvatarActions = (params: UseBulkAvatarActionsParams) => {
  const getAffectedDialogueCount = () => params.selectedBlockIndices.size + params.selectedNestedKeys.size;

  const updateChapterDialogues = (avatarStyle: string) => {
    const currentChapter = params.chapters[params.currentChapterIndex];
    if (!currentChapter) {
      return params.chapters;
    }

    const nextBlocks = currentChapter.blocks.map((block, blockIndex) => {
      if (params.selectedBlockIndices.has(blockIndex) && block.type === 'dialogue') {
        return { ...block, avatarStyle };
      }

      if (block.type !== 'nested-choice-group') {
        return block;
      }

      let nestedChanged = false;
      const nextNestedOptions = (block.nestedOptions || []).map((option) => {
        let optionChanged = false;
        const nextOptionBlocks = option.blocks.map((nestedBlock, nestedBlockIndex) => {
          const nestedKey = `${blockIndex}-${option.showIndex}-${nestedBlockIndex}`;
          if (params.selectedNestedKeys.has(nestedKey) && nestedBlock.type === 'dialogue') {
            optionChanged = true;
            nestedChanged = true;
            return { ...nestedBlock, avatarStyle };
          }
          return nestedBlock;
        });

        return optionChanged ? { ...option, blocks: nextOptionBlocks } : option;
      });

      return nestedChanged ? { ...block, nestedOptions: nextNestedOptions } : block;
    });

    const nextChapter = { ...currentChapter, blocks: nextBlocks };
    return params.chapters.map((chapter, chapterIndex) =>
      chapterIndex === params.currentChapterIndex ? nextChapter : chapter
    );
  };

  const toggleBlockSelection = (blockIndex: number, setSelectedBlockIndices: (value: Set<number>) => void) => {
    const newSelected = new Set<number>(params.selectedBlockIndices);
    if (newSelected.has(blockIndex)) newSelected.delete(blockIndex);
    else newSelected.add(blockIndex);
    setSelectedBlockIndices(newSelected);
  };

  const toggleSelectAllDialogues = (
    setSelectedBlockIndices: (value: Set<number>) => void,
    setSelectedNestedKeys: (value: Set<string>) => void
  ) => {
    const currentChapter = params.chapters[params.currentChapterIndex];
    const dialogueIndices = currentChapter.blocks
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => block.type === 'dialogue')
      .map(({ index }) => index);
    const nestedDialogueKeys = currentChapter.blocks.flatMap((block, blockIndex) => {
      if (block.type !== 'nested-choice-group') {
        return [];
      }

      return (block.nestedOptions || []).flatMap((option) =>
        option.blocks.flatMap((nestedBlock, nestedBlockIndex) =>
          nestedBlock.type === 'dialogue' ? [`${blockIndex}-${option.showIndex}-${nestedBlockIndex}`] : []
        )
      );
    });

    const allTopLevelSelected = dialogueIndices.every(index => params.selectedBlockIndices.has(index));
    const allNestedSelected = nestedDialogueKeys.every(key => params.selectedNestedKeys.has(key));
    const allSelected = dialogueIndices.length + nestedDialogueKeys.length > 0 && allTopLevelSelected && allNestedSelected;

    setSelectedBlockIndices(allSelected ? new Set<number>() : new Set(dialogueIndices));
    setSelectedNestedKeys(allSelected ? new Set<string>() : new Set(nestedDialogueKeys));
  };

  const batchSetAvatar = (avatarName: string) => {
    const affectedCount = getAffectedDialogueCount();
    if (!avatarName || affectedCount === 0) {
      return { affectedCount: 0, affectedCharacters: [] as string[] };
    }

    const updatedChapters = updateChapterDialogues(avatarName);

    const currentChapter = updatedChapters[params.currentChapterIndex];
    if (!currentChapter) {
      return { affectedCount: 0, affectedCharacters: [] as string[] };
    }

    const updatedHistory = { ...params.characterAvatarHistory };
    const affectedChars = new Set<string>();
    params.selectedBlockIndices.forEach(index => {
      const block = currentChapter.blocks[index];
      if (block.type === 'dialogue' && block.character) affectedChars.add(block.character);
    });
    params.selectedNestedKeys.forEach(key => {
      const [gi, si, bi] = key.split('-').map(Number);
      const groupBlock = currentChapter.blocks[gi];
      if (groupBlock?.type === 'nested-choice-group') {
        const opt = (groupBlock.nestedOptions || []).find(o => o.showIndex === si);
        if (opt && opt.blocks[bi]?.type === 'dialogue' && opt.blocks[bi].character) affectedChars.add(opt.blocks[bi].character!);
      }
    });
    affectedChars.forEach(char => {
      const history = updatedHistory[char] || [];
      updatedHistory[char] = [avatarName, ...history.filter(a => a !== avatarName)].slice(0, 3);
    });
    params.setCharacterAvatarHistory(updatedHistory);

    params.commitChapters(updatedChapters);
    params.setShowBatchAvatarPicker(false);
    params.clearSelections();
    params.exitMultiSelect();

    return {
      affectedCount,
      affectedCharacters: Array.from(affectedChars)
    };
  };

  const batchClearAvatar = () => {
    const affectedCount = getAffectedDialogueCount();
    if (affectedCount === 0) {
      return { affectedCount: 0 };
    }

    const updatedChapters = updateChapterDialogues('');

    params.commitChapters(updatedChapters);
    params.clearSelections();
    params.exitMultiSelect();

    return { affectedCount };
  };

  const batchDeleteDialogues = () => {
    const affectedCount = getAffectedDialogueCount();
    if (affectedCount === 0) {
      return { affectedCount: 0 };
    }

    const currentChapter = params.chapters[params.currentChapterIndex];
    if (!currentChapter) {
      return { affectedCount: 0 };
    }

    const nextBlocks = currentChapter.blocks.flatMap((block, blockIndex) => {
      if (params.selectedBlockIndices.has(blockIndex) && block.type === 'dialogue') {
        return [];
      }

      if (block.type !== 'nested-choice-group') {
        return [block];
      }

      const nextNestedOptions = (block.nestedOptions || []).map((option) => ({
        ...option,
        blocks: option.blocks.filter((nestedBlock, nestedBlockIndex) => {
          const nestedKey = `${blockIndex}-${option.showIndex}-${nestedBlockIndex}`;
          return !(nestedBlock.type === 'dialogue' && params.selectedNestedKeys.has(nestedKey));
        })
      }));

      return [{ ...block, nestedOptions: nextNestedOptions }];
    });

    const nextChapter = { ...currentChapter, blocks: nextBlocks };
    const updatedChapters = params.chapters.map((chapter, chapterIndex) =>
      chapterIndex === params.currentChapterIndex ? nextChapter : chapter
    );

    params.commitChapters(updatedChapters);
    params.clearSelections();
    params.exitMultiSelect();

    return { affectedCount };
  };

  return { toggleBlockSelection, toggleSelectAllDialogues, batchSetAvatar, batchClearAvatar, batchDeleteDialogues };
};
