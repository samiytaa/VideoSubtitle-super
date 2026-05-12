import { ParsedBlock } from '../../types';

export interface BasicBlockItemProps<T extends ParsedBlock = ParsedBlock> {
  block: T;
  index: number;
  blockKey: string;
}
