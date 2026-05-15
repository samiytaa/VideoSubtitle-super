import { describe, expect, it } from 'vitest';
import { parseEditableBlocksText, serializeBlocksText } from '../components/textEditorProofreader/textParserUtils';
import { ParsedBlock } from '../components/textEditorProofreader/types';

describe('textEditorProofreader raw choice option editing', () => {
  it('serializes and parses dialogue and narration blocks for raw option editing', () => {
    const blocks: ParsedBlock[] = [
      { type: 'dialogue', character: '法正', content: '殿下', avatarStyle: '法正', customColor: '' },
      { type: 'narration-thought', content: '先看看情况' },
    ];

    const raw = serializeBlocksText(blocks);
    const parsed = parseEditableBlocksText(raw);

    expect(parsed.error).toBeUndefined();
    expect(parsed.blocks).toEqual(blocks);
  });

  it('returns an error when raw option text contains unsupported residue', () => {
    const parsed = parseEditableBlocksText('{{对话|法正|殿下}}\n这不是模板原文');

    expect(parsed).toEqual({
      blocks: [],
      error: '存在无法识别的原文内容，请确认使用 {{旁白}} / {{对话}} / {{分歧}} 模板格式。'
    });
  });
});
