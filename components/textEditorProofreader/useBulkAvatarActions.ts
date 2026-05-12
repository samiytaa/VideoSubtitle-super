import type React from 'react';
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
  const toggleBlockSelection = (blockIndex: number, setSelectedBlockIndices: (value: Set<number>) => void) => {
    const newSelected = new Set<number>(params.selectedBlockIndices);
    if (newSelected.has(blockIndex)) newSelected.delete(blockIndex);
    else newSelected.add(blockIndex);
    setSelectedBlockIndices(newSelected);
  };

  const toggleSelectAllDialogues = (setSelectedBlockIndices: (value: Set<number>) => void) => {
    const currentChapter = params.chapters[params.currentChapterIndex];
    const dialogueIndices = currentChapter.blocks
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => block.type === 'dialogue')
      .map(({ index }) => index);
    const allSelected = dialogueIndices.every(index => params.selectedBlockIndices.has(index));
    setSelectedBlockIndices(allSelected ? new Set<number>() : new Set(dialogueIndices));
  };

  const batchSetAvatar = (avatarName: string) => {
    const updatedChapters = [...params.chapters];
    const currentChapter = updatedChapters[params.currentChapterIndex];

    params.selectedBlockIndices.forEach(index => {
      const block = currentChapter.blocks[index];
      if (block.type === 'dialogue') block.avatarStyle = avatarName;
    });

    params.selectedNestedKeys.forEach(key => {
      const [gi, si, bi] = key.split('-').map(Number);
      const groupBlock = currentChapter.blocks[gi];
      if (groupBlock?.type === 'nested-choice-group') {
        const opt = (groupBlock.nestedOptions || []).find(o => o.showIndex === si);
        if (opt && opt.blocks[bi]?.type === 'dialogue') opt.blocks[bi].avatarStyle = avatarName;
      }
    });

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
  };

  const batchClearAvatar = () => {
    if (params.selectedBlockIndices.size === 0 && params.selectedNestedKeys.size === 0) return;
    const updatedChapters = [...params.chapters];
    const currentChapter = updatedChapters[params.currentChapterIndex];

    params.selectedBlockIndices.forEach(index => {
      const block = currentChapter.blocks[index];
      if (block.type === 'dialogue') block.avatarStyle = '';
    });
    params.selectedNestedKeys.forEach(key => {
      const [gi, si, bi] = key.split('-').map(Number);
      const groupBlock = currentChapter.blocks[gi];
      if (groupBlock?.type === 'nested-choice-group') {
        const opt = (groupBlock.nestedOptions || []).find(o => o.showIndex === si);
        if (opt && opt.blocks[bi]?.type === 'dialogue') opt.blocks[bi].avatarStyle = '';
      }
    });

    params.commitChapters(updatedChapters);
    params.clearSelections();
    params.exitMultiSelect();
  };

  return { toggleBlockSelection, toggleSelectAllDialogues, batchSetAvatar, batchClearAvatar };
};
