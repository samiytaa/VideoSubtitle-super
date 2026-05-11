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
