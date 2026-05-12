export type NarrationType = 'narration' | 'narration-thought';
export type ModalKey = 'avatar' | 'nestedAvatar' | 'subAvatar' | 'batchAvatar' | 'search' | 'quickReplace';

export interface ChoiceOption {
  label: string;
  blocks: ParsedBlock[];
}

export interface NestedOption {
  label: string;
  showIndex: number;
  blocks: ParsedBlock[];
}

export type HeaderBlock = {
  type: 'header';
  content: string;
  character: string;
  chapter: string;
};

export type FooterBlock = {
  type: 'footer';
  content: string;
  character: string;
  chapter: string;
};

export type NarrationBlock = {
  type: 'narration';
  content: string;
};

export type NarrationThoughtBlock = {
  type: 'narration-thought';
  content: string;
};

export type DialogueBlock = {
  type: 'dialogue';
  content: string;
  character: string;
  avatarStyle: string;
  customColor?: string;
};

export type ChoiceBlock = {
  type: 'choice';
  content: string;
  choiceOptions: ChoiceOption[];
};

export type NestedChoiceBlock = {
  type: 'nested-choice';
  content: string;
};

export type NestedChoiceGroupBlock = {
  type: 'nested-choice-group';
  content: string;
  nestedOptions: NestedOption[];
};

export type ParsedBlock =
  | HeaderBlock
  | FooterBlock
  | NarrationBlock
  | NarrationThoughtBlock
  | DialogueBlock
  | ChoiceBlock
  | NestedChoiceBlock
  | NestedChoiceGroupBlock;

export function isDialogueBlock(block: ParsedBlock): block is DialogueBlock {
  return block.type === 'dialogue';
}

export interface Chapter {
  character: string;
  chapterNum: string;
  blocks: ParsedBlock[];
  format?: 'spy' | 'general';
}

export interface SearchResult {
  chapterIndex: number;
  blockIndex: number;
  type: 'narration' | 'dialogue' | 'character' | 'nested-option';
  content: string;
  character?: string;
  matchText: string;
  nestedShowIndex?: number;
  nestedBi?: number;
}
