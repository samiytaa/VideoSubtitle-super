import { ParsedBlock, Chapter } from './types';
import { normalizeAvatarName } from '../../utils/avatarMap';
import { convertTextMainline, reverseConvertText } from '../../utils/textConversionUtils';

export const parseSingleBlock = (line: string): ParsedBlock | null => {
  const m = line.match(/^\{\{([^|]+)\|(.+)\}\}$/s);
  if (!m) return null;
  const type = m[1];
  const parts = m[2].split('|');
  if (type === '旁白') {
    if (parts.length > 1 && parts[0] === '心理') return { type: 'narration-thought', content: parts[1] };
    return { type: 'narration', content: parts[0] };
  }
  if (type === '对话') {
    let avatarStyle = '', customColor = '';
    for (let i = 2; i < parts.length; i++) {
      if (parts[i].startsWith('头像=')) avatarStyle = normalizeAvatarName(parts[i].replace('头像=', ''));
      else if (parts[i].startsWith('color=')) customColor = parts[i].replace('color=', '');
    }
    return { type: 'dialogue', character: parts[0], content: parts[1], avatarStyle, customColor };
  }
  return null;
};

export const parseChoiceBlock = (raw: string): ParsedBlock => {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const options: { label: string; blocks: ParsedBlock[] }[] = [];
  let current: { label: string; blocks: ParsedBlock[] } | null = null;
  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    const inner = line.slice(1);
    const sub = parseSingleBlock(inner);
    if (sub && current) {
      current.blocks.push(sub);
    } else {
      if (current) options.push(current);
      current = { label: inner, blocks: [] };
    }
  }
  if (current) options.push(current);
  return { type: 'choice', content: '', choiceOptions: options };
};

const tokenizeTemplateText = (text: string): string[] => {
  const tokens: string[] = [];
  const tokenRegex = /\{\{[\s\S]*?\}\}|__CHOICE_\d+__/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRegex.exec(text)) !== null) {
    tokens.push(m[0]);
  }
  return tokens;
};

export const parseSectionBlocks = (section: string): ParsedBlock[] => {
  const choiceMap = new Map<string, ParsedBlock>();
  let idx = 0;
  const processed = section.replace(/\{\{分歧\n[\s\S]*?\n\}\}/g, (match) => {
    const key = `__CHOICE_${idx++}__`;
    const inner = match.replace(/^\{\{分歧\n/, '').replace(/\n\}\}$/, '');
    choiceMap.set(key, parseChoiceBlock(inner));
    return key;
  });

  const tokens = tokenizeTemplateText(processed);

  const parseSingleToken = (t: string): ParsedBlock | null => {
    if (choiceMap.has(t)) return choiceMap.get(t)!;
    const sm = t.match(/^\{\{([^|]+)\|(.+)\}\}$/s);
    if (!sm) return null;
    const type = sm[1];
    const parts = sm[2].split('|');
    if (type === '旁白') {
      if (parts.length > 1 && parts[0] === '心理') return { type: 'narration-thought', content: parts[1] };
      return { type: 'narration', content: parts[0] };
    }
    if (type === '对话') {
      let avatarStyle = '', customColor = '';
      for (let i = 2; i < parts.length; i++) {
        if (parts[i].startsWith('头像=')) avatarStyle = normalizeAvatarName(parts[i].replace('头像=', ''));
        else if (parts[i].startsWith('color=')) customColor = parts[i].replace('color=', '');
      }
      return { type: 'dialogue', character: parts[0], content: parts[1], avatarStyle, customColor };
    }
    return null;
  };

  const blocks: ParsedBlock[] = [];
  let i = 0;

  while (i < tokens.length) {
    const t = tokens[i];

    if (t === '{{嵌套分歧|头}}') {
      const options: { label: string; showIndex: number; blocks: ParsedBlock[] }[] = [];
      i++;
      let optIdx = 1;
      while (i < tokens.length && tokens[i] !== '{{嵌套分歧|尾}}') {
        const om = tokens[i].match(/^\{\{嵌套分歧\|(.+?)\}\}$/);
        if (om) {
          const parts = om[1].split('|');
          const label = parts[0];
          const showIndex = parts[1] ? Number(parts[1]) : optIdx;
          options.push({ label, showIndex, blocks: [] });
          optIdx++;
        }
        i++;
      }
      i++;

      while (i < tokens.length) {
        const ct = tokens[i];
        const contentHeadMatch = ct.match(/^\{\{嵌套分歧\|内容头(?:\|显示=(\d+))?\}\}$/);
        if (!contentHeadMatch) break;
        const showNum = contentHeadMatch[1] ? Number(contentHeadMatch[1]) : null;
        i++;
        const contentBlocks: ParsedBlock[] = [];
        while (i < tokens.length && tokens[i] !== '{{嵌套分歧|内容尾}}') {
          const b = parseSingleToken(tokens[i]);
          if (b) contentBlocks.push(b);
          i++;
        }
        i++;
        if (showNum !== null) {
          const opt = options.find(o => o.showIndex === showNum);
          if (opt) opt.blocks = contentBlocks;
        } else {
          const opt = options.find(o => o.blocks.length === 0);
          if (opt) opt.blocks = contentBlocks;
        }
      }

      blocks.push({ type: 'nested-choice-group', content: '', nestedOptions: options });
      continue;
    }

    const b = parseSingleToken(t);
    if (b) blocks.push(b);
    i++;
  }

  return blocks;
};

const serializeBlock = (block: ParsedBlock): string => {
  if (block.type === 'narration') return `{{旁白|${block.content}}}`;
  if (block.type === 'narration-thought') return `{{旁白|心理|${block.content}}}`;
  if (block.type === 'dialogue') {
    let s = `{{对话|${block.character}|${block.content}`;
    if (block.avatarStyle) s += `|头像=${normalizeAvatarName(block.avatarStyle)}`;
    return s + '}}';
  }
  if (block.type === 'choice') {
    const parts: string[] = [];
    (block.choiceOptions || []).forEach(opt => {
      parts.push(`|${opt.label}`);
      parts.push(`|${opt.blocks.map(serializeBlock).join('')}`);
    });
    return `{{分歧\n${parts.join('\n')}\n}}`;
  }
  if (block.type === 'nested-choice-group') {
    const opts = block.nestedOptions || [];
    const optDefs = opts.map(o => `{{嵌套分歧|${o.label}|${o.showIndex}}}`).join('');
    const contentSections = opts.map((o, oi) => {
      const inner = o.blocks.map(serializeBlock).join('');
      const head = oi === 0 ? `{{嵌套分歧|内容头|显示=${o.showIndex}}}` : `{{嵌套分歧|内容头}}`;
      return `${head}${inner}{{嵌套分歧|内容尾}}`;
    }).join('');
    return `{{嵌套分歧|头}}${optDefs}{{嵌套分歧|尾}}${contentSections}`;
  }
  return '';
};

export const serializeBlocksText = (blocks: ParsedBlock[]): string =>
  blocks
    .filter(block => block.type !== 'header' && block.type !== 'footer' && block.type !== 'nested-choice')
    .map(serializeBlock)
    .join('\n');

export const parseEditableBlocksText = (text: string): { blocks: ParsedBlock[]; error?: string } => {
  const trimmed = text.trim();
  if (!trimmed) return { blocks: [] };

  const processed = trimmed.replace(/\{\{分歧\n[\s\S]*?\n\}\}/g, (match) => match);
  const residue = processed.replace(/\{\{[\s\S]*?\}\}/g, '').trim();
  if (residue) {
    return { blocks: [], error: '存在无法识别的原文内容，请确认使用 {{旁白}} / {{对话}} / {{分歧}} 模板格式。' };
  }

  const blocks = parseSectionBlocks(trimmed).filter(block => block.type !== 'header' && block.type !== 'footer' && block.type !== 'nested-choice');
  const tokenCount = tokenizeTemplateText(trimmed).length;
  if (tokenCount > 0 && blocks.length === 0) {
    return { blocks: [], error: '原文格式无法解析，请检查模板是否完整闭合。' };
  }
  return { blocks };
};

export const serializeBlocksOriginalText = (blocks: ParsedBlock[]): { text: string; error?: string } => {
  const serialized = serializeBlocksText(blocks);
  if (!serialized.trim()) return { text: '' };

  const reversed = reverseConvertText(serialized, 'mainline');
  if (!reversed.success) {
    return { text: '', error: reversed.error || '转换前内容生成失败' };
  }

  return { text: reversed.output };
};

export const parseOriginalBlocksText = (text: string): { blocks: ParsedBlock[]; error?: string } => {
  const trimmed = text.trim();
  if (!trimmed) return { blocks: [] };

  const converted = convertTextMainline(trimmed);
  if (!converted.success) {
    return { blocks: [], error: converted.error || '转换失败' };
  }

  const blocks = parseSectionBlocks(converted.output).filter(
    block => block.type !== 'header' && block.type !== 'footer' && block.type !== 'nested-choice'
  );

  return { blocks };
};

export const parseText = (text: string): Chapter[] => {
  if (text.includes('{{对话-头}}') && text.includes('{{对话-尾}}')) {
    const inner = text
      .replace(/\{\{对话-头\}\}/, '')
      .replace(/\{\{对话-尾\}\}/, '');
    const blocks: ParsedBlock[] = [
      { type: 'header', content: '', character: '', chapter: '' },
      ...parseSectionBlocks(inner),
      { type: 'footer', content: '', character: '', chapter: '' },
    ];
    return [{ character: '', chapterNum: '', blocks, format: 'general' }];
  }

  const sections = text.split('|||').filter(s => s.trim());
  const parsedChapters: Chapter[] = [];

  sections.forEach(section => {
    let chapterInfo: { character: string; chapterNum: string } | null = null;

    const choiceMap = new Map<string, ParsedBlock>();
    let idx = 0;
    const processed = section.replace(/\{\{分歧\n[\s\S]*?\n\}\}/g, (match) => {
      const key = `__CHOICE_${idx++}__`;
      const inner = match.replace(/^\{\{分歧\n/, '').replace(/\n\}\}$/, '');
      choiceMap.set(key, parseChoiceBlock(inner));
      return key;
    });

    const tokens: string[] = [];
    const tokenRegex = /\{\{[\s\S]*?\}\}|__CHOICE_\d+__/g;
    let m: RegExpExecArray | null;
    while ((m = tokenRegex.exec(processed)) !== null) tokens.push(m[0]);

    const parseSingleSpyToken = (t: string): ParsedBlock | null => {
      if (choiceMap.has(t)) return choiceMap.get(t)!;
      const sm = t.match(/^\{\{([^|]+)\|(.+)\}\}$/s);
      if (!sm) return null;
      const type = sm[1];
      const parts = sm[2].split('|');
      if (type === '密探故事录入') {
        const position = parts[0], character = parts[1], chapter = parts[2];
        if (position === '头') { chapterInfo = { character, chapterNum: chapter }; return { type: 'header', content: '', character, chapter }; }
        if (position === '尾') return { type: 'footer', content: '', character, chapter };
      }
      if (type === '旁白') {
        if (parts.length > 1 && parts[0] === '心理') return { type: 'narration-thought', content: parts[1] };
        return { type: 'narration', content: parts[0] };
      }
      if (type === '对话') {
        let avatarStyle = '', customColor = '';
        for (let i = 2; i < parts.length; i++) {
          if (parts[i].startsWith('头像=')) avatarStyle = normalizeAvatarName(parts[i].replace('头像=', ''));
          else if (parts[i].startsWith('color=')) customColor = parts[i].replace('color=', '');
        }
        return { type: 'dialogue', character: parts[0], content: parts[1], avatarStyle, customColor };
      }
      return null;
    };

    const blocks: ParsedBlock[] = [];
    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t === '{{嵌套分歧|头}}') {
        const options: { label: string; showIndex: number; blocks: ParsedBlock[] }[] = [];
        i++;
        let optIdx = 1;
        while (i < tokens.length && tokens[i] !== '{{嵌套分歧|尾}}') {
          const om = tokens[i].match(/^\{\{嵌套分歧\|(.+?)\}\}$/);
          if (om) {
            const parts = om[1].split('|');
            options.push({ label: parts[0], showIndex: parts[1] ? Number(parts[1]) : optIdx, blocks: [] });
            optIdx++;
          }
          i++;
        }
        i++;
        while (i < tokens.length) {
          const ct = tokens[i];
          const chm = ct.match(/^\{\{嵌套分歧\|内容头(?:\|显示=(\d+))?\}\}$/);
          if (!chm) break;
          const showNum = chm[1] ? Number(chm[1]) : null;
          i++;
          const cb: ParsedBlock[] = [];
          while (i < tokens.length && tokens[i] !== '{{嵌套分歧|内容尾}}') {
            const b = parseSingleSpyToken(tokens[i]);
            if (b) cb.push(b);
            i++;
          }
          i++;
          if (showNum !== null) {
            const opt = options.find(o => o.showIndex === showNum);
            if (opt) opt.blocks = cb;
          } else {
            const opt = options.find(o => o.blocks.length === 0);
            if (opt) opt.blocks = cb;
          }
        }
        blocks.push({ type: 'nested-choice-group', content: '', nestedOptions: options });
        continue;
      }
      const b = parseSingleSpyToken(t);
      if (b) blocks.push(b);
      i++;
    }

    if (chapterInfo) {
      parsedChapters.push({ character: chapterInfo!.character, chapterNum: chapterInfo!.chapterNum, blocks, format: 'spy' });
    }
  });

  return parsedChapters;
};

const blockToText = (block: ParsedBlock): string => serializeBlock(block);

export const regenerateInputText = (chaptersData: Chapter[]): string => {
  if (chaptersData.length === 1 && chaptersData[0].format === 'general') {
    const chapter = chaptersData[0];
    const bodyTexts: string[] = [];
    chapter.blocks.forEach(block => {
      if (block.type === 'header' || block.type === 'footer') return;
      if (block.type === 'narration' || block.type === 'narration-thought' || block.type === 'dialogue') {
        bodyTexts.push(blockToText(block));
      } else if (block.type === 'choice') {
        const parts: string[] = [];
        (block.choiceOptions || []).forEach(opt => {
          parts.push(`|${opt.label}`);
          parts.push(`|${opt.blocks.map(blockToText).join('')}`);
        });
        bodyTexts.push(`{{分歧\n${parts.join('\n')}\n}}`);
      } else if (block.type === 'nested-choice-group') {
        const opts = block.nestedOptions || [];
        const optDefs = opts.map(o => `{{嵌套分歧|${o.label}|${o.showIndex}}}`).join('');
        const contentSections = opts.map((o, oi) => {
          const inner = o.blocks.map(blockToText).join('');
          const head = oi === 0 ? `{{嵌套分歧|内容头|显示=${o.showIndex}}}` : `{{嵌套分歧|内容头}}`;
          return `${head}${inner}{{嵌套分歧|内容尾}}`;
        }).join('');
        bodyTexts.push(`{{嵌套分歧|头}}${optDefs}{{嵌套分歧|尾}}${contentSections}`);
      }
    });
    return `{{对话-头}}${bodyTexts.join('')}{{对话-尾}}`;
  }

  const sections: string[] = [];
  chaptersData.forEach(chapter => {
    const blockTexts: string[] = [];
    chapter.blocks.forEach(block => {
      if (block.type === 'header') {
        blockTexts.push(`{{密探故事录入|头|${block.character}|${block.chapter}}}`);
      } else if (block.type === 'footer') {
        blockTexts.push(`{{密探故事录入|尾|${block.character}|${block.chapter}}}`);
      } else if (block.type === 'narration' || block.type === 'narration-thought' || block.type === 'dialogue') {
        blockTexts.push(blockToText(block));
      } else if (block.type === 'choice') {
        const parts: string[] = [];
        (block.choiceOptions || []).forEach(opt => {
          parts.push(`|${opt.label}`);
          parts.push(`|${opt.blocks.map(blockToText).join('')}`);
        });
        blockTexts.push(`{{分歧\n${parts.join('\n')}\n}}`);
      } else if (block.type === 'nested-choice-group') {
        const opts = block.nestedOptions || [];
        const optDefs = opts.map(o => `{{嵌套分歧|${o.label}|${o.showIndex}}}`).join('');
        const contentSections = opts.map((o, oi) => {
          const inner = o.blocks.map(blockToText).join('');
          const head = oi === 0 ? `{{嵌套分歧|内容头|显示=${o.showIndex}}}` : `{{嵌套分歧|内容头}}`;
          return `${head}${inner}{{嵌套分歧|内容尾}}`;
        }).join('');
        blockTexts.push(`{{嵌套分歧|头}}${optDefs}{{嵌套分歧|尾}}${contentSections}`);
      }
    });
    sections.push(blockTexts.join(''));
  });

  return sections.join('|||');
};

export const getCharacterColor = (character: string, customColor?: string): string => {
  if (customColor) return customColor;
  const colorMap: { [key: string]: string } = {
    '我': '#e79c09',
    '袁基': '#00676d',
    '傅融': '#4f4475',
    '刘辩': '#550e16',
    '孙策': '#953400',
    '左慈': '#3b4c77',
  };
  return colorMap[character] || '#5d3920';
};
