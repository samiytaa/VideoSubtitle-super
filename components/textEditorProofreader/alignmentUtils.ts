export interface AlignedRow {
  original: string;
  converted: string;
}

type SemanticEntry = {
  key: string;
  order: number[];
  original?: string;
  converted?: string;
};

function tokenizeConvertedText(text: string): string[] {
  const trimmedText = text.trim();
  if (!trimmedText) return [];

  if (trimmedText.includes('\n')) {
    return trimmedText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  const templateTokens = trimmedText.match(/\{\{[\s\S]*?\}\}/g);
  if (templateTokens?.length) {
    return templateTokens;
  }

  return [trimmedText];
}

function createOrder(...parts: number[]): number[] {
  return parts;
}

function compareOrder(a: number[], b: number[]): number {
  const maxLength = Math.max(a.length, b.length);
  for (let i = 0; i < maxLength; i += 1) {
    const av = a[i] ?? -1;
    const bv = b[i] ?? -1;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function buildOriginalEntries(originalText: string): SemanticEntry[] {
  const lines = originalText.split('\n').map((line) => line.trim()).filter(Boolean);
  const entries: SemanticEntry[] = [];

  let chapterIndex = 0;
  let blockIndex = 0;
  let choiceIndex = 0;

  const currentScope = () => (chapterIndex > 0 ? `chapter:${chapterIndex}` : 'main');
  const currentScopeOrder = () => (chapterIndex > 0 ? [chapterIndex] : [0]);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (/^《.+》$/.test(line)) {
      entries.push({
        key: 'mitan:title',
        order: createOrder(0, 0),
        original: line,
      });
      continue;
    }

    const chapterMatch = line.match(/^==(\d+)==$/);
    if (chapterMatch) {
      chapterIndex += 1;
      blockIndex = 0;
      choiceIndex = 0;
      entries.push({
        key: `chapter:${chapterIndex}:header`,
        order: createOrder(chapterIndex, 0),
        original: line,
      });
      continue;
    }

    if (line === '{{选择开始}}') {
      choiceIndex += 1;
      const scopeKey = currentScope();
      const scopeOrder = currentScopeOrder();
      const thisChoiceIndex = choiceIndex;
      entries.push({
        key: `${scopeKey}:choice:${thisChoiceIndex}:start`,
        order: createOrder(...scopeOrder, 1000 + thisChoiceIndex * 100),
        original: line,
      });

      let optionIndex = 0;
      let optionLineIndex = 0;

      while (i + 1 < lines.length && lines[i + 1] !== '{{选择结束}}') {
        i += 1;
        const nestedLine = lines[i];
        const optionMatch = nestedLine.match(/^{{选择\d*[：:](.+?)}}$/);
        if (optionMatch) {
          optionIndex += 1;
          optionLineIndex = 0;
          entries.push({
            key: `${scopeKey}:choice:${thisChoiceIndex}:option:${optionIndex}`,
            order: createOrder(...scopeOrder, 1000 + thisChoiceIndex * 100, optionIndex, 0),
            original: nestedLine,
          });
          continue;
        }

        optionLineIndex += 1;
        entries.push({
          key: `${scopeKey}:choice:${thisChoiceIndex}:option:${optionIndex}:line:${optionLineIndex}`,
          order: createOrder(...scopeOrder, 1000 + thisChoiceIndex * 100, optionIndex, 20 + optionLineIndex),
          original: nestedLine,
        });
      }

      if (i + 1 < lines.length && lines[i + 1] === '{{选择结束}}') {
        i += 1;
        entries.push({
          key: `${scopeKey}:choice:${thisChoiceIndex}:end`,
          order: createOrder(...scopeOrder, 1000 + thisChoiceIndex * 100, 999),
          original: lines[i],
        });
      }
      continue;
    }

    blockIndex += 1;
    entries.push({
      key: `${currentScope()}:block:${blockIndex}`,
      order: createOrder(...currentScopeOrder(), 100 + blockIndex),
      original: line,
    });
  }

  return entries;
}

function buildConvertedEntries(convertedText: string): SemanticEntry[] {
  const tokens = tokenizeConvertedText(convertedText);
  const entries: SemanticEntry[] = [];

  let chapterIndex = 0;
  let blockIndex = 0;
  let choiceIndex = 0;
  let mainWrapperIndex = 0;
  let pendingChoiceOptionMap = new Map<number, number>();

  const currentScope = () => (chapterIndex > 0 ? `chapter:${chapterIndex}` : 'main');
  const currentScopeOrder = () => (chapterIndex > 0 ? [chapterIndex] : [0]);

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (token === '{{JS|Qiantao.js}}') {
      entries.push({
        key: 'main:wrapper:js',
        order: createOrder(0, mainWrapperIndex),
        converted: token,
      });
      mainWrapperIndex += 1;
      continue;
    }

    if (token === '{{对话-头}}') {
      entries.push({
        key: 'main:wrapper:head',
        order: createOrder(0, mainWrapperIndex),
        converted: token,
      });
      mainWrapperIndex += 1;
      continue;
    }

    if (token === '{{对话-尾}}') {
      entries.push({
        key: 'main:wrapper:tail',
        order: createOrder(999999, 999999),
        converted: token,
      });
      continue;
    }

    const mitanHeadMatch = token.match(/^{{密探故事录入\|头\|.+?\|(\d+)}}$/);
    if (mitanHeadMatch) {
      chapterIndex += 1;
      blockIndex = 0;
      choiceIndex = 0;
      pendingChoiceOptionMap = new Map<number, number>();
      entries.push({
        key: `chapter:${chapterIndex}:header`,
        order: createOrder(chapterIndex, 0),
        converted: token,
      });
      continue;
    }

    const mitanTailMatch = token.match(/^{{密探故事录入\|尾\|.+?\|(\d+)}}$/);
    if (mitanTailMatch) {
      entries.push({
        key: `chapter:${chapterIndex}:footer`,
        order: createOrder(chapterIndex, 999999),
        converted: token,
      });
      continue;
    }

    if (token === '{{嵌套分歧|头}}') {
      choiceIndex += 1;
      const scopeKey = currentScope();
      const scopeOrder = currentScopeOrder();
      const thisChoiceIndex = choiceIndex;
      pendingChoiceOptionMap = new Map<number, number>();

      entries.push({
        key: `${scopeKey}:choice:${thisChoiceIndex}:start`,
        order: createOrder(...scopeOrder, 1000 + thisChoiceIndex * 100),
        converted: token,
      });

      while (i + 1 < tokens.length && tokens[i + 1] !== '{{嵌套分歧|尾}}') {
        i += 1;
        const optionToken = tokens[i];
        const optionMatch = optionToken.match(/^\{\{嵌套分歧\|(.+?)\|(\d+)\}\}$/);
        if (!optionMatch) continue;
        const optionNumber = Number(optionMatch[2]);
        pendingChoiceOptionMap.set(optionNumber, optionNumber);
        entries.push({
          key: `${scopeKey}:choice:${thisChoiceIndex}:option:${optionNumber}`,
          order: createOrder(...scopeOrder, 1000 + thisChoiceIndex * 100, optionNumber, 0),
          converted: optionToken,
        });
      }

      if (i + 1 < tokens.length && tokens[i + 1] === '{{嵌套分歧|尾}}') {
        i += 1;
        entries.push({
          key: `${scopeKey}:choice:${thisChoiceIndex}:options-end`,
          order: createOrder(...scopeOrder, 1000 + thisChoiceIndex * 100, 500),
          converted: tokens[i],
        });
      }

      let inferredOptionIndex = 0;
      while (i + 1 < tokens.length) {
        const nextToken = tokens[i + 1];
        const contentHeadMatch = nextToken.match(/^\{\{嵌套分歧\|内容头(?:\|显示=(\d+))?\}\}$/);
        if (!contentHeadMatch) break;

        i += 1;
        const explicitOptionIndex = contentHeadMatch[1] ? Number(contentHeadMatch[1]) : null;
        inferredOptionIndex = explicitOptionIndex ?? (inferredOptionIndex + 1);
        const optionNumber = explicitOptionIndex ?? inferredOptionIndex;
        let optionLineIndex = 0;

        entries.push({
          key: `${scopeKey}:choice:${thisChoiceIndex}:option:${optionNumber}:content-start`,
          order: createOrder(...scopeOrder, 1000 + thisChoiceIndex * 100, optionNumber, 10),
          converted: tokens[i],
        });

        while (i + 1 < tokens.length && tokens[i + 1] !== '{{嵌套分歧|内容尾}}') {
          i += 1;
          optionLineIndex += 1;
          entries.push({
            key: `${scopeKey}:choice:${thisChoiceIndex}:option:${optionNumber}:line:${optionLineIndex}`,
            order: createOrder(...scopeOrder, 1000 + thisChoiceIndex * 100, optionNumber, 20 + optionLineIndex),
            converted: tokens[i],
          });
        }

        if (i + 1 < tokens.length && tokens[i + 1] === '{{嵌套分歧|内容尾}}') {
          i += 1;
          entries.push({
            key: `${scopeKey}:choice:${thisChoiceIndex}:option:${optionNumber}:content-end`,
            order: createOrder(...scopeOrder, 1000 + thisChoiceIndex * 100, optionNumber, 90),
            converted: tokens[i],
          });
        }
      }
      continue;
    }

    blockIndex += 1;
    entries.push({
      key: `${currentScope()}:block:${blockIndex}`,
      order: createOrder(...currentScopeOrder(), 100 + blockIndex),
      converted: token,
    });
  }

  return entries;
}

export function buildAlignedRows(originalText: string, convertedText: string): AlignedRow[] {
  const originalEntries = buildOriginalEntries(originalText);
  const convertedEntries = buildConvertedEntries(convertedText);

  if (originalEntries.length === 0) {
    return convertedEntries.map((entry) => ({ original: '', converted: entry.converted ?? '' }));
  }

  if (convertedEntries.length === 0) {
    return originalEntries.map((entry) => ({ original: entry.original ?? '', converted: '' }));
  }

  const merged = new Map<string, SemanticEntry>();

  originalEntries.forEach((entry) => {
    merged.set(entry.key, { ...entry });
  });

  convertedEntries.forEach((entry) => {
    const current = merged.get(entry.key);
    if (current) {
      merged.set(entry.key, {
        key: entry.key,
        order: current.order.length ? current.order : entry.order,
        original: current.original,
        converted: entry.converted,
      });
      return;
    }
    merged.set(entry.key, { ...entry });
  });

  return Array.from(merged.values())
    .sort((a, b) => compareOrder(a.order, b.order))
    .map((entry) => ({
      original: entry.original ?? '',
      converted: entry.converted ?? '',
    }));
}

export function buildLineMappedPaneText(rows: AlignedRow[], pane: 'original' | 'converted'): string {
  return rows.map((row) => (pane === 'original' ? row.original : row.converted)).join('\n');
}

export function normalizeLineMappedEditorText(text: string): string {
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .join('\n');
}
