export type NarrationType = 'narration' | 'narration-thought';
export type ModalKey = 'avatar' | 'nestedAvatar' | 'subAvatar' | 'batchAvatar' | 'search' | 'quickReplace';

export interface ParsedBlock {
  type: 'header' | 'narration' | 'dialogue' | 'narration-thought' | 'footer' | 'choice' | 'nested-choice' | 'nested-choice-group';
  content: string;
  character?: string;
  chapter?: string;
  avatarStyle?: string;
  customColor?: string;
  choiceOptions?: { label: string; blocks: ParsedBlock[] }[];
  nestedChoiceLabel?: string;
  nestedChoiceIndex?: number;
  nestedOptions?: { label: string; showIndex: number; blocks: ParsedBlock[] }[];
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
