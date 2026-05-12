import React, { createContext, useContext } from 'react';
import { Chapter, ParsedBlock } from '../types';

export type InsertBlockType = 'narration' | 'narration-thought' | 'dialogue' | 'nested-choice-group';

export interface EditorBlockContextValue {
  editingState: {
    blockIndex: number | null;
    content: string;
    character: string;
    avatar: string;
    isMultiSelectMode: boolean;
    selectedBlockIndices: Set<number>;
  };
  menuState: {
    activeInsertMenuIndex: number | null;
    activeNarrationConvertMenuIndex: number | null;
  };
  resources: {
    chapters: Chapter[];
    currentChapterIndex: number;
    characterName: string;
    characterAvatarHistory: Record<string, string[]>;
  };
  actions: {
    setBlockRef: (key: string, el: HTMLDivElement | null) => void;
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
    insertBlockFromMenu: (index: number, type: InsertBlockType) => void;
    toggleBlockSelection: (index: number) => void;
    deleteNarrationBlock: (index: number) => Promise<void>;
    deleteThoughtBlock: (index: number) => Promise<void>;
    deleteDialogueBlock: (index: number) => Promise<void>;
    convertNarrationToThought: (index: number) => void;
    convertNarrationToDialogue: (index: number) => void;
    convertThoughtToNarration: (index: number) => void;
    convertThoughtToDialogueAsSelf: (index: number) => void;
    convertDialogueToNarration: (index: number) => void;
  };
}

export const EditorBlockContext = createContext<EditorBlockContextValue | null>(null);

export const useEditorBlockContext = () => {
  const ctx = useContext(EditorBlockContext);
  if (!ctx) throw new Error('EditorBlockContext is missing');
  return ctx;
};
