import { MutableRefObject, useMemo } from 'react';
import { EditorBlockContextValue } from '../context/EditorBlockContext';
import { ParsedBlock } from '../types';

interface ConfirmFn {
  (params: { title: string; message: string }): Promise<boolean>;
}

interface UseBlockOperationsParams {
  blockRefs: MutableRefObject<{ [key: string]: HTMLDivElement | null }>;
  startEditing: (index: number, block: ParsedBlock) => void;
  setEditingContent: (value: string) => void;
  setEditingCharacter: (value: string) => void;
  setEditingAvatar: (value: string) => void;
  setShowAvatarPicker: (show: boolean) => void;
  saveEditing: () => void;
  cancelEditing: () => void;
  toggleNarrationConvertMenu: (index: number) => void;
  toggleInsertMenu: (index: number) => void;
  closeInsertMenu: () => void;
  insertBlockFromMenu: (index: number, type: 'narration' | 'narration-thought' | 'dialogue' | 'nested-choice-group') => void;
  toggleBlockSelection: (index: number) => void;
  showConfirm: ConfirmFn;
  deleteBlock: (index: number) => void;
  updateBlock: (blockIndex: number, updater: (block: ParsedBlock) => void) => void;
  closeNarrationConvertMenu: () => void;
  characterName: string;
}

export const useBlockOperations = ({
  blockRefs,
  startEditing,
  setEditingContent,
  setEditingCharacter,
  setEditingAvatar,
  setShowAvatarPicker,
  saveEditing,
  cancelEditing,
  toggleNarrationConvertMenu,
  toggleInsertMenu,
  closeInsertMenu,
  insertBlockFromMenu,
  toggleBlockSelection,
  showConfirm,
  deleteBlock,
  updateBlock,
  closeNarrationConvertMenu,
  characterName
}: UseBlockOperationsParams): EditorBlockContextValue['actions'] => {
  return useMemo(() => ({
    setBlockRef: (key, el) => { blockRefs.current[key] = el; },
    startEditing,
    setEditingContent,
    setEditingCharacter,
    setEditingAvatar,
    setShowAvatarPicker,
    saveEditing,
    cancelEditing,
    toggleNarrationConvertMenu,
    toggleInsertMenu,
    closeInsertMenu,
    insertBlockFromMenu,
    toggleBlockSelection,
    deleteNarrationBlock: async (blockIndex) => {
      const confirmed = await showConfirm({ title: '确认删除', message: '确定要删除这条旁白吗？' });
      if (confirmed) deleteBlock(blockIndex);
    },
    deleteThoughtBlock: async (blockIndex) => {
      const confirmed = await showConfirm({ title: '确认删除', message: '确定要删除这条心理旁白吗？' });
      if (confirmed) deleteBlock(blockIndex);
    },
    deleteDialogueBlock: async (blockIndex) => {
      const confirmed = await showConfirm({ title: '确认删除', message: '确定要删除这条对话吗？' });
      if (confirmed) deleteBlock(blockIndex);
    },
    convertNarrationToThought: (blockIndex) => {
      updateBlock(blockIndex, (b) => {
        if (b.type === 'narration') b.type = 'narration-thought';
      });
      closeNarrationConvertMenu();
    },
    convertNarrationToDialogue: (blockIndex) => {
      updateBlock(blockIndex, (b) => {
        if (b.type === 'narration' || b.type === 'narration-thought') {
          (b as ParsedBlock).type = 'dialogue';
          (b as Extract<ParsedBlock, { type: 'dialogue' }>).character = characterName || '角色名';
          (b as Extract<ParsedBlock, { type: 'dialogue' }>).avatarStyle = '';
        }
      });
      closeNarrationConvertMenu();
    },
    convertThoughtToNarration: (blockIndex) => {
      updateBlock(blockIndex, (b) => {
        if (b.type === 'narration-thought') b.type = 'narration';
      });
      closeNarrationConvertMenu();
    },
    convertThoughtToDialogueAsSelf: (blockIndex) => {
      updateBlock(blockIndex, (b) => {
        if (b.type === 'narration' || b.type === 'narration-thought') {
          (b as ParsedBlock).type = 'dialogue';
          (b as Extract<ParsedBlock, { type: 'dialogue' }>).character = '我';
          (b as Extract<ParsedBlock, { type: 'dialogue' }>).avatarStyle = '';
        }
      });
      closeNarrationConvertMenu();
    },
    convertDialogueToNarration: (blockIndex) => {
      updateBlock(blockIndex, (b) => {
        if (b.type === 'dialogue') {
          (b as ParsedBlock).type = 'narration';
        }
      });
    }
  }), [
    blockRefs,
    startEditing,
    setEditingContent,
    setEditingCharacter,
    setEditingAvatar,
    setShowAvatarPicker,
    saveEditing,
    cancelEditing,
    toggleNarrationConvertMenu,
    toggleInsertMenu,
    closeInsertMenu,
    insertBlockFromMenu,
    toggleBlockSelection,
    showConfirm,
    deleteBlock,
    updateBlock,
    closeNarrationConvertMenu,
    characterName
  ]);
};
