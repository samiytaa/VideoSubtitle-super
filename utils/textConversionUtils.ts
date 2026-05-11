export interface ConversionResult {
  success: boolean;
  output: string;
  error?: string;
}

function convertLine(trimmedLine: string): string {
  if (/^【==.+?==】$/.test(trimmedLine)) {
    const m = trimmedLine.match(/【==(.+?)==】/);
    return m ? `{{旁白|【${m[1]}】}}` : `{{旁白|${trimmedLine}}}`;
  }
  if (trimmedLine.includes('：')) {
    const idx = trimmedLine.indexOf('：');
    return `{{对话|${trimmedLine.substring(0, idx)}|${trimmedLine.substring(idx + 1)}}}`;
  }
  if (trimmedLine.startsWith('（') && trimmedLine.endsWith('）')) {
    return `{{旁白|心理|${trimmedLine.slice(1, -1)}}}`;
  }
  if (trimmedLine.startsWith('【') && trimmedLine.endsWith('】')) {
    return `{{旁白|${trimmedLine.slice(1, -1)}}}`;
  }
  return `{{旁白|${trimmedLine}}}`;
}

function convertChoiceBlock(block: string): string {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  const choices: { label: string; lines: string[] }[] = [];
  let current: { label: string; lines: string[] } | null = null;

  for (const line of lines) {
    if (line === '{{选择开始}}' || line === '{{选择结束}}') continue;
    const m = line.match(/^{{选择\d*[：:](.+?)}}$/);
    if (m) {
      if (current) choices.push(current);
      current = { label: m[1], lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) choices.push(current);

  // 所有选项（单个或多个）都走 {{嵌套分歧}} 格式
  // 头部列出所有选项，再依次输出各选项内容块
  const parts: string[] = [`{{嵌套分歧|头}}`];
  choices.forEach((c, i) => parts.push(`{{嵌套分歧|${c.label}|${i + 1}}}`));
  parts.push(`{{嵌套分歧|尾}}`);

  choices.forEach((c, i) => {
    if (c.lines.length === 0) return;
    parts.push(i === 0 ? `{{嵌套分歧|内容头|显示=1}}` : `{{嵌套分歧|内容头}}`);
    for (const cl of c.lines) parts.push(convertLine(cl));
    parts.push(`{{嵌套分歧|内容尾}}`);
  });

  return parts.join('\n');
}


function extractChoiceBlocks(content: string): { text: string; map: Map<string, string> } {
  const map = new Map<string, string>();
  let idx = 0;
  const text = content.replace(/{{选择开始}}[\s\S]*?{{选择结束}}/g, (match) => {
    const key = `__CHOICE_BLOCK_${idx++}__`;
    map.set(key, convertChoiceBlock(match));
    return key;
  });
  return { text, map };
}

export function convertTextMitan(content: string): ConversionResult {
  try {
    const { text: preprocessed, map: choiceMap } = extractChoiceBlocks(content);
    const titleMatch = preprocessed.match(/《(.+?)》/);
    const title = titleMatch ? titleMatch[1] : "";

    // 有章节标记但无标题时拒绝转换
    const hasSections = /==\d+==/.test(preprocessed);
    if (hasSections && !title) {
      return { success: false, output: '', error: '检测到章节标记，但未找到标题《》，请先添加标题' };
    }
    const sections = preprocessed.split(/==(\d{2})==/);
    const result: string[] = [];

    const processLine = (trimmedLine: string) => {
      if (choiceMap.has(trimmedLine)) {
        result.push(choiceMap.get(trimmedLine)!);
        return;
      }
      result.push(convertLine(trimmedLine));
    };

    if (sections.length === 1) {
      for (const line of preprocessed.split('\n')) {
        const t = line.trim();
        if (!t) continue;
        if (t.includes('《') && t.includes('》')) continue;
        processLine(t);
      }
    } else {
      for (let i = 1; i < sections.length; i += 2) {
        if (i >= sections.length) break;
        const sectionNum = sections[i];
        const sectionContent = sections[i + 1].trim();
        result.push(`{{密探故事录入|头|${title}|${sectionNum}}}`);
        for (const line of sectionContent.split('\n')) {
          const t = line.trim();
          if (!t) continue;
          processLine(t);
        }
        result.push(`{{密探故事录入|尾|${title}|${sectionNum}}}`);
        result.push("|||");
      }
      if (result[result.length - 1] === "|||") result.pop();
    }

    if (result.length === 0) {
      return { success: false, output: '', error: '未能识别文本格式，请检查输入内容' };
    }
    return { success: true, output: result.join('\n') };
  } catch (error) {
    return { success: false, output: '', error: error instanceof Error ? error.message : '转换失败' };
  }
}

export function convertTextMainline(content: string): ConversionResult {
  try {
    const { text: preprocessed, map: choiceMap } = extractChoiceBlocks(content);

    const result: string[] = [];

    const processLine = (trimmedLine: string) => {
      if (choiceMap.has(trimmedLine)) {
        result.push(choiceMap.get(trimmedLine)!);
        return;
      }
      result.push(convertLine(trimmedLine));
    };

    for (const line of preprocessed.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      processLine(t);
    }

    if (result.length === 0) {
      return { success: false, output: '', error: '未能识别文本格式，请检查输入内容' };
    }
    const hasQiantao = result.some(l => l.includes('{{嵌套分歧|'));
    const prefix = hasQiantao ? [`{{JS|Qiantao.js}}`, `{{对话-头}}`] : [`{{对话-头}}`];
    return { success: true, output: [...prefix, ...result, `{{对话-尾}}`].join('\n') };
  } catch (error) {
    return { success: false, output: '', error: error instanceof Error ? error.message : '转换失败' };
  }
}

function reverseConvertLine(t: string): string {
  const dialogueMatch = t.match(/^{{对话\|(.+?)\|(.+?)}}$/);
  if (dialogueMatch) return `${dialogueMatch[1]}：${dialogueMatch[2]}`;

  const asideMatch = t.match(/^{{旁白\|(.+?)}}$/);
  if (asideMatch) {
    const c = asideMatch[1];
    const mentalMatch = c.match(/^心理\|(.+)$/);
    if (mentalMatch) return `（${mentalMatch[1]}）`;
    if (c.startsWith('【') && c.endsWith('】')) return `【==${c.slice(1, -1)}==】`;
    return `【${c}】`;
  }
  return t;
}

function reverseChoiceBlock(block: string): string {
  // 提取所有选项标签（按编号排序）
  const labelMatches = [...block.matchAll(/{{嵌套分歧\|(.+?)\|(\d+)}}/g)];
  const labels = labelMatches
    .sort((a, b) => Number(a[2]) - Number(b[2]))
    .map(m => m[1]);

  // 提取所有内容块（按出现顺序）
  const contentBlocks: string[][] = [];
  const contentRe = /{{嵌套分歧\|内容头[^}]*}}\n([\s\S]*?)\n{{嵌套分歧\|内容尾}}/g;
  let cm: RegExpExecArray | null;
  while ((cm = contentRe.exec(block)) !== null) {
    contentBlocks.push(cm[1].split('\n').map(l => l.trim()).filter(Boolean));
  }

  const lines: string[] = ['{{选择开始}}'];
  labels.forEach((label, i) => {
    lines.push(`{{选择：${label}}}`);
    const cLines = contentBlocks[i] || [];
    for (const cl of cLines) lines.push(reverseConvertLine(cl));
  });
  lines.push('{{选择结束}}');
  return lines.join('\n');
}

export function reverseConvertText(content: string): ConversionResult {
  try {
    // 先提取并还原分歧/嵌套分歧块
    const choiceMap = new Map<string, string>();
    let idx = 0;

    // 匹配 {{嵌套分歧|头}} ... {{嵌套分歧|尾}} 及其后跟随的所有内容头/尾块
    let processed = content.replace(/{{嵌套分歧\|头}}[\s\S]*?{{嵌套分歧\|尾}}((?:\n{{嵌套分歧\|内容头[^}]*}}[\s\S]*?{{嵌套分歧\|内容尾}})*)/g, (match) => {
      const key = `__REV_CHOICE_${idx++}__`;
      choiceMap.set(key, reverseChoiceBlock(match));
      return key;
    });

    const lines = processed.split('\n');
    const result: string[] = [];
    let currentTitle = '';
    let sectionCount = 0;

    for (const line of lines) {
      const t = line.trim();
      if (!t || t === '|||') continue;

      // 还原分歧占位符
      if (choiceMap.has(t)) {
        result.push(choiceMap.get(t)!);
        continue;
      }

      // 密探：{{密探故事录入|头|标题|章节}}
      const mitanHeaderMatch = t.match(/^{{密探故事录入\|头\|(.+?)\|(\d{2})}}$/);
      if (mitanHeaderMatch) {
        currentTitle = mitanHeaderMatch[1];
        if (result.length === 0) result.push(`《${currentTitle}》`);
        result.push(`==${mitanHeaderMatch[2]}==`);
        continue;
      }
      if (/^{{密探故事录入\|尾\|.+?\|\d{2}}}$/.test(t)) continue;

      // 主线：{{对话-头}} / {{对话-尾}}
      if (t === '{{对话-头}}') {
        sectionCount++;
        const padded = String(sectionCount).padStart(2, '0');
        if (result.length === 0 && currentTitle) result.push(`《${currentTitle}》`);
        result.push(`==${padded}==`);
        continue;
      }
      if (t === '{{对话-尾}}') continue;

      result.push(reverseConvertLine(t));
    }

    if (result.length === 0) {
      return { success: false, output: '', error: '未能识别模板格式，请检查输入内容' };
    }
    return { success: true, output: result.join('\n') };
  } catch (error) {
    return { success: false, output: '', error: error instanceof Error ? error.message : '反向转换失败' };
  }
}
