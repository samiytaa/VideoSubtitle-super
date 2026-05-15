import React, { useRef, useCallback, useEffect, useState, useImperativeHandle } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { SIDE_PANEL_COLLAPSED_WIDTH } from '../panelConstants';

interface InputPanelProps {
  isCollapsed: boolean;
  originalText: string;
  convertedText: string;
  copySuccess: boolean;
  leftScrollRef: React.RefObject<HTMLDivElement | null>;
  onExpand: () => void;
  onCollapse: () => void;
  onCopyOriginal: () => void | Promise<void>;
  onCopyConverted: () => void | Promise<void>;
  onClear: () => void | Promise<void>;
  onStartProofreading: () => void;
  onOriginalTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onConvertedTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

const MIN_WIDTH = 520;
const DEFAULT_WIDTH = 640;

/** 从 contentEditable DOM 提取纯文本（保留换行） */
function extractPlainText(el: HTMLElement): string {
  let text = '';
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeName === 'BR') {
      // 只保留用户手动输入的换行，忽略我们插入的视觉换行 br
      if (!(node as HTMLElement).dataset?.visual) {
        text += '\n';
      }
    } else if (node.nodeName === 'DIV' || node.nodeName === 'P') {
      text += '\n' + extractPlainText(node as HTMLElement);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      text += extractPlainText(node as HTMLElement);
    }
  });
  return text;
}

/** 将纯文本转为带视觉换行的 HTML（}} 后插入视觉 br） */
function textToDisplayHtml(text: string): string {
  if (!text) return '';
  // 先转义 HTML 特殊字符
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // 真实换行 → <br>
  // }} 后面（非换行）→ 插入视觉 <br data-visual="1">
  return escaped
    .replace(/\n/g, '<br>')
    .replace(/}}(?!<br>)/g, '}}<br data-visual="1">');
}

/** 保存并恢复光标位置（基于文本偏移） */
function getCaretOffset(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(el);
  preRange.setEnd(range.endContainer, range.endOffset);
  return preRange.toString().length;
}

function setCaretOffset(el: HTMLElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  let remaining = offset;
  let found = false;

  function walk(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length ?? 0;
      if (remaining <= len) {
        range.setStart(node, remaining);
        range.collapse(true);
        found = true;
        return true;
      }
      remaining -= len;
    } else {
      for (const child of Array.from(node.childNodes)) {
        if (walk(child)) return true;
      }
    }
    return false;
  }

  walk(el);
  if (!found) {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

interface InputEditorProps {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  mode?: 'original' | 'converted';
}

interface InputEditorHandle {
  focusMatch: (start: number, end: number) => void;
}

type IndexedTextNode = {
  node: Text;
  start: number;
  end: number;
};

type IndexedNode = IndexedTextNode | {
  node: HTMLBRElement;
  start: number;
  end: number;
  isLineBreak: true;
};

function collectIndexedNodes(root: HTMLElement): IndexedNode[] {
  const nodes: IndexedNode[] = [];
  let currentOffset = 0;

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      const text = textNode.textContent ?? '';
      if (text.length > 0) {
        nodes.push({
          node: textNode,
          start: currentOffset,
          end: currentOffset + text.length,
        });
        currentOffset += text.length;
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === 'BR') {
        if (!el.dataset?.visual) {
          nodes.push({
            node: el as HTMLBRElement,
            start: currentOffset,
            end: currentOffset + 1,
            isLineBreak: true,
          });
          currentOffset += 1;
        }
        return;
      }

      Array.from(node.childNodes).forEach(walk);
    }
  }

  walk(root);
  return nodes;
}

function findTextPosition(root: HTMLElement, targetOffset: number): { node: Node; offset: number } | null {
  const indexedNodes = collectIndexedNodes(root);
  if (indexedNodes.length === 0) {
    return { node: root, offset: root.childNodes.length };
  }

  const clampedOffset = Math.max(0, targetOffset);
  const totalLength = indexedNodes[indexedNodes.length - 1].end;
  const hit = indexedNodes.find(({ start, end }) => {
    if (clampedOffset === totalLength) {
      return clampedOffset >= start && clampedOffset <= end;
    }
    return clampedOffset >= start && clampedOffset < end;
  });
  if (hit) {
    if ('isLineBreak' in hit) {
      const parent = hit.node.parentNode;
      if (!parent) return null;
      const childNodes = Array.from(parent.childNodes);
      const index = childNodes.indexOf(hit.node);
      return { node: parent, offset: Math.max(0, index) };
    }

    return { node: hit.node, offset: Math.min(clampedOffset - hit.start, hit.node.textContent?.length ?? 0) };
  }

  const last = indexedNodes[indexedNodes.length - 1];
  if ('isLineBreak' in last) {
    const parent = last.node.parentNode;
    if (!parent) return null;
    const childNodes = Array.from(parent.childNodes);
    const index = childNodes.indexOf(last.node);
    return { node: parent, offset: index + 1 };
  }
  return { node: last.node, offset: last.node.textContent?.length ?? 0 };
}

const InputEditor = React.forwardRef<InputEditorHandle, InputEditorProps>(({ value, onChange, placeholder, mode = 'original' }, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposing = useRef(false);
  // 记录上一次渲染的 value，避免外部 value 未变时重置 DOM
  const lastValueRef = useRef<string>(value);

  // 当外部 value 变化时同步到 DOM（保留光标）
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value === lastValueRef.current) return;
    lastValueRef.current = value;

    const offset = document.activeElement === el ? getCaretOffset(el) : null;
    el.innerHTML = textToDisplayHtml(value);
    if (offset !== null) {
      setCaretOffset(el, offset);
    }
  }, [value]);

  // 初始化
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = textToDisplayHtml(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInput = useCallback(() => {
    if (isComposing.current) return;
    const el = editorRef.current;
    if (!el) return;

    const offset = getCaretOffset(el);
    const plain = extractPlainText(el);
    lastValueRef.current = plain;
    onChange(plain);

    // 重新渲染显示（插入视觉换行）
    el.innerHTML = textToDisplayHtml(plain);
    // 恢复光标（偏移量不变，因为视觉 br 不计入文本长度）
    setCaretOffset(el, offset);
  }, [onChange]);

  const handleCompositionEnd = useCallback(() => {
    isComposing.current = false;
    handleInput();
  }, [handleInput]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      // 触发 input 处理
      handleInput();
    },
    [handleInput],
  );

  useImperativeHandle(ref, () => ({
    focusMatch: (start: number, end: number) => {
      const el = editorRef.current;
      if (!el) return;

      const startPos = findTextPosition(el, start);
      const endPos = findTextPosition(el, end);
      if (!startPos || !endPos) return;

      const selection = window.getSelection();
      if (!selection) return;

      const range = document.createRange();
      range.setStart(startPos.node, startPos.offset);
      range.setEnd(endPos.node, endPos.offset);
      selection.removeAllRanges();
      selection.addRange(range);
      el.focus();

      const scrollContainer = el.parentElement;
      const rect = range.getBoundingClientRect();
      const containerRect = scrollContainer?.getBoundingClientRect();

      if (scrollContainer && rect.height > 0 && containerRect) {
        const offsetTop = rect.top - containerRect.top;
        const targetScrollTop = scrollContainer.scrollTop + offsetTop - (containerRect.height / 2) + (rect.height / 2);
        scrollContainer.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
      }
    }
  }), []);

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onCompositionStart={() => { isComposing.current = true; }}
      onCompositionEnd={handleCompositionEnd}
      onPaste={handlePaste}
      data-placeholder={placeholder}
      className="inline-block min-w-full min-h-full p-2 border border-transparent rounded-md text-[13px] focus:outline-none"
      style={{
        fontFamily: mode === 'converted' ? '"Cascadia Code", "Consolas", "Courier New", monospace' : 'inherit',
        whiteSpace: 'pre',
        wordBreak: 'normal',
        overflowWrap: 'normal',
        lineHeight: '2rem',
      }}
    />
  );
});

InputEditor.displayName = 'InputEditor';

function getMatchOffsets(text: string, keyword: string): Array<{ start: number; end: number }> {
  if (!keyword.trim()) return [];

  const matches: Array<{ start: number; end: number }> = [];
  let fromIndex = 0;

  while (fromIndex < text.length) {
    const matchIndex = text.indexOf(keyword, fromIndex);
    if (matchIndex === -1) break;
    matches.push({ start: matchIndex, end: matchIndex + keyword.length });
    fromIndex = matchIndex + keyword.length;
  }

  return matches;
}

interface AlignedRow {
  original: string;
  converted: string;
}

function convertOriginalLine(trimmedLine: string): string {
  if (/^【==.+?==】$/.test(trimmedLine)) {
    const match = trimmedLine.match(/【==(.+?)==】/);
    return match ? `{{旁白|【${match[1]}】}}` : `{{旁白|${trimmedLine}}}`;
  }
  if (trimmedLine.startsWith('（') && trimmedLine.endsWith('）')) {
    return `{{旁白|心理|${trimmedLine.slice(1, -1)}}}`;
  }
  if (trimmedLine.startsWith('【') && trimmedLine.endsWith('】')) {
    return `{{旁白|${trimmedLine.slice(1, -1)}}}`;
  }
  if (trimmedLine.includes('：')) {
    const idx = trimmedLine.indexOf('：');
    return `{{对话|${trimmedLine.substring(0, idx)}|${trimmedLine.substring(idx + 1)}}}`;
  }
  return `{{旁白|${trimmedLine}}}`;
}

function buildAlignedRows(originalText: string, convertedText: string): AlignedRow[] {
  const originalLines = originalText.split('\n').map((line) => line.trim()).filter(Boolean);
  const rows: AlignedRow[] = [];

  if (originalLines.length === 0) {
    return convertedText.split('\n').filter(Boolean).map((converted) => ({ original: '', converted }));
  }

  const hasNestedChoice = originalText.includes('{{选择开始}}');
  if (hasNestedChoice) {
    rows.push({ original: '', converted: '{{JS|Qiantao.js}}' });
  }
  rows.push({ original: '', converted: '{{对话-头}}' });

  let i = 0;
  while (i < originalLines.length) {
    const line = originalLines[i];

    if (/^《.+》$/.test(line)) {
      rows.push({ original: line, converted: '' });
      i++;
      continue;
    }

    const chapterMatch = line.match(/^==(\d+)==$/);
    if (chapterMatch) {
      rows.push({ original: line, converted: `{{密探故事录入|头|标题|${chapterMatch[1]}}}` });
      i++;
      continue;
    }

    if (line === '{{选择开始}}') {
      const options: { label: string; headerLine: string; lines: string[] }[] = [];
      let current: { label: string; headerLine: string; lines: string[] } | null = null;

      rows.push({ original: line, converted: '{{嵌套分歧|头}}' });
      i++;

      while (i < originalLines.length && originalLines[i] !== '{{选择结束}}') {
        const optionMatch = originalLines[i].match(/^{{选择\d*[：:](.+?)}}$/);
        if (optionMatch) {
          if (current) options.push(current);
          current = { label: optionMatch[1], headerLine: originalLines[i], lines: [] };
        } else if (current) {
          current.lines.push(originalLines[i]);
        }
        i++;
      }
      if (current) options.push(current);

      options.forEach((option, optionIndex) => {
        rows.push({ original: option.headerLine, converted: `{{嵌套分歧|${option.label}|${optionIndex + 1}}}` });
      });
      rows.push({ original: '', converted: '{{嵌套分歧|尾}}' });

      options.forEach((option, optionIndex) => {
        rows.push({
          original: '',
          converted: optionIndex === 0 ? '{{嵌套分歧|内容头|显示=1}}' : '{{嵌套分歧|内容头}}',
        });
        option.lines.forEach((contentLine) => {
          rows.push({ original: contentLine, converted: convertOriginalLine(contentLine) });
        });
        rows.push({ original: '', converted: '{{嵌套分歧|内容尾}}' });
      });

      if (i < originalLines.length && originalLines[i] === '{{选择结束}}') {
        rows.push({ original: originalLines[i], converted: '' });
        i++;
      }
      continue;
    }

    rows.push({ original: line, converted: convertOriginalLine(line) });
    i++;
  }

  rows.push({ original: '', converted: '{{对话-尾}}' });
  return rows;
}

function highlightText(text: string, keyword: string): React.ReactNode {
  if (!keyword.trim()) return text || '\u00a0';
  const index = text.indexOf(keyword);
  if (index === -1) return text || '\u00a0';

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-amber-200 px-0.5 text-gray-950">{text.slice(index, index + keyword.length)}</mark>
      {text.slice(index + keyword.length)}
    </>
  );
}

interface AlignedTextGridProps {
  rows: AlignedRow[];
  searchKeyword: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  activeRowIndex: number | null;
}

const AlignedTextGrid: React.FC<AlignedTextGridProps> = ({
  rows,
  searchKeyword,
  scrollRef,
  activeRowIndex,
}) => (
  <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
    <div className="overflow-hidden rounded-md border border-gray-200">
      {rows.map((row, index) => (
        <div
          key={`${index}-${row.original}-${row.converted}`}
          data-row-index={index}
          className={`grid grid-cols-2 border-b border-gray-100 last:border-b-0 ${
            index % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'
          }`}
        >
          <div className={`min-h-9 min-w-0 border-r border-gray-100 px-3 py-1.5 text-[13px] leading-6 text-gray-950 whitespace-pre-wrap break-words ${
            activeRowIndex === index ? 'bg-amber-50 ring-1 ring-inset ring-amber-300' : ''
          }`}>
            {highlightText(row.original, searchKeyword)}
          </div>
          <div className={`min-h-9 min-w-0 px-3 py-1.5 font-mono text-[13px] leading-6 text-gray-950 whitespace-pre-wrap break-words ${
            activeRowIndex === index ? 'bg-amber-50 ring-1 ring-inset ring-amber-300' : ''
          }`}>
            {highlightText(row.converted, searchKeyword)}
          </div>
        </div>
      ))}
    </div>
  </div>
);

interface EditorPaneProps {
  title: string;
  value: string;
  placeholder: string;
  searchKeyword: string;
  currentMatchIndex: number;
  onSearchKeywordChange: (value: string) => void;
  onJumpToRelativeMatch: (direction: 1 | -1) => void;
  onEditorChange: (text: string) => void;
  editorRef: React.RefObject<InputEditorHandle | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  mode: 'original' | 'converted';
}

const EditorPane: React.FC<EditorPaneProps> = ({
  title,
  value,
  placeholder,
  searchKeyword,
  currentMatchIndex,
  onSearchKeywordChange,
  onJumpToRelativeMatch,
  onEditorChange,
  editorRef,
  scrollRef,
  onScroll,
  mode,
}) => {
  const searchMatches = getMatchOffsets(value, searchKeyword);

  useEffect(() => {
    if (searchMatches.length === 0) return;
    const activeMatch = searchMatches[Math.min(currentMatchIndex, searchMatches.length - 1)];
    if (!activeMatch) return;
    editorRef.current?.focusMatch(activeMatch.start, activeMatch.end);
  }, [currentMatchIndex, editorRef, searchMatches]);

  return (
    <div className="min-w-0 flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between gap-2 shrink-0">
        <span className="text-xs font-semibold text-gray-700">{title}</span>
        <span className="text-[11px] text-gray-400">{value ? `${value.split('\n').length} 行` : '0 行'}</span>
      </div>

      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5 shrink-0">
        <input
          type="text"
          value={searchKeyword}
          onChange={(e) => onSearchKeywordChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onJumpToRelativeMatch(e.shiftKey ? -1 : 1);
            }
          }}
          placeholder={`搜索${title}`}
          className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-200 rounded outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <span className={`text-[11px] w-14 text-center ${searchKeyword && searchMatches.length === 0 ? 'text-red-500' : 'text-gray-500'}`}>
          {searchKeyword ? `${searchMatches.length === 0 ? 0 : Math.min(currentMatchIndex + 1, searchMatches.length)}/${searchMatches.length}` : '--/--'}
        </span>
        <button
          onClick={() => onJumpToRelativeMatch(-1)}
          disabled={searchMatches.length === 0}
          className="px-2 py-1.5 text-xs text-gray-700 border border-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
        >
          上一个
        </button>
        <button
          onClick={() => onJumpToRelativeMatch(1)}
          disabled={searchMatches.length === 0}
          className="px-2 py-1.5 text-xs text-gray-700 border border-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
        >
          下一个
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-auto p-3"
        style={{
          backgroundImage: 'repeating-linear-gradient(to bottom, rgba(248,250,252,0.0) 0, rgba(248,250,252,0.0) 2rem, rgba(99,102,241,0.045) 2rem, rgba(99,102,241,0.045) 4rem)',
        }}
      >
        <InputEditor
          ref={editorRef}
          value={value}
          onChange={onEditorChange}
          placeholder={placeholder}
          mode={mode}
        />
      </div>
    </div>
  );
};

const InputPanel: React.FC<InputPanelProps> = ({
  isCollapsed,
  originalText,
  convertedText,
  copySuccess,
  leftScrollRef,
  onExpand,
  onCollapse,
  onCopyOriginal,
  onCopyConverted,
  onClear,
  onStartProofreading,
  onOriginalTextChange,
  onConvertedTextChange,
}) => {
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('inputPanel_width');
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const originalEditorRef = useRef<InputEditorHandle>(null);
  const convertedEditorRef = useRef<InputEditorHandle>(null);
  const originalScrollRef = useRef<HTMLDivElement>(null);
  const convertedScrollRef = useRef<HTMLDivElement>(null);
  const syncScrollSourceRef = useRef<'original' | 'converted' | null>(null);
  const [comparisonSearchKeyword, setComparisonSearchKeyword] = useState('');
  const [comparisonMatchIndex, setComparisonMatchIndex] = useState(0);

  const isResizing = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const alignedRows = buildAlignedRows(originalText, convertedText);
  const comparisonMatchRows = comparisonSearchKeyword.trim()
    ? alignedRows
      .map((row, index) => (row.original.includes(comparisonSearchKeyword) || row.converted.includes(comparisonSearchKeyword) ? index : -1))
      .filter((index) => index >= 0)
    : [];
  const activeComparisonRowIndex = comparisonMatchRows[comparisonMatchIndex] ?? null;

  const scrollToAlignedRow = useCallback((rowIndex: number) => {
    const container = leftScrollRef.current;
    const rowElement = container?.querySelector(`[data-row-index="${rowIndex}"]`) as HTMLElement | null;
    if (!container || !rowElement) return;

    const offsetTop = rowElement.offsetTop - container.offsetTop;
    container.scrollTo({
      top: Math.max(0, offsetTop - container.clientHeight / 2 + rowElement.clientHeight / 2),
      behavior: 'smooth',
    });
  }, [leftScrollRef]);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isCollapsed) return;
      e.preventDefault();
      isResizing.current = true;
      resizeStartX.current = e.clientX;
      resizeStartWidth.current = panelWidth;
    },
    [isCollapsed, panelWidth],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = resizeStartX.current - e.clientX;
      const newWidth = Math.max(MIN_WIDTH, resizeStartWidth.current + delta);
      setPanelWidth(newWidth);
    };
    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        localStorage.setItem('inputPanel_width', String(panelWidth));
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [panelWidth]);

  useEffect(() => {
    if (!isResizing.current) {
      localStorage.setItem('inputPanel_width', String(panelWidth));
    }
  }, [panelWidth]);

  useEffect(() => {
    if (comparisonMatchRows.length === 0) {
      setComparisonMatchIndex(0);
      return;
    }
    if (comparisonMatchIndex >= comparisonMatchRows.length) {
      setComparisonMatchIndex(0);
    }
  }, [comparisonMatchRows.length, comparisonMatchIndex]);

  useEffect(() => {
    if (activeComparisonRowIndex !== null) scrollToAlignedRow(activeComparisonRowIndex);
  }, [activeComparisonRowIndex, scrollToAlignedRow]);

  // 将 onChange 适配为纯文本回调
  const handleOriginalEditorChange = useCallback(
    (text: string) => {
      const fakeEvent = {
        target: { value: text },
      } as React.ChangeEvent<HTMLTextAreaElement>;
      onOriginalTextChange(fakeEvent);
    },
    [onOriginalTextChange],
  );

  const handleConvertedEditorChange = useCallback(
    (text: string) => {
      const fakeEvent = {
        target: { value: text },
      } as React.ChangeEvent<HTMLTextAreaElement>;
      onConvertedTextChange(fakeEvent);
    },
    [onConvertedTextChange],
  );

  const jumpComparisonMatch = useCallback((direction: 1 | -1) => {
    const total = comparisonMatchRows.length;
    if (total === 0) return;
    setComparisonMatchIndex((prev) => {
      if (direction === 1) return (prev + 1) % total;
      return (prev - 1 + total) % total;
    });
  }, [comparisonMatchRows.length]);

  const syncScrollPosition = useCallback((source: 'original' | 'converted') => {
    const sourceEl = source === 'original' ? originalScrollRef.current : convertedScrollRef.current;
    const targetEl = source === 'original' ? convertedScrollRef.current : originalScrollRef.current;
    if (!sourceEl || !targetEl) return;

    const sourceMaxScroll = Math.max(1, sourceEl.scrollHeight - sourceEl.clientHeight);
    const targetMaxScroll = Math.max(0, targetEl.scrollHeight - targetEl.clientHeight);
    const scrollRatio = sourceEl.scrollTop / sourceMaxScroll;

    syncScrollSourceRef.current = source;
    targetEl.scrollTop = targetMaxScroll * scrollRatio;
    window.requestAnimationFrame(() => {
      syncScrollSourceRef.current = null;
    });
  }, []);

  const handleOriginalScroll = useCallback(() => {
    if (syncScrollSourceRef.current === 'converted') return;
    syncScrollPosition('original');
  }, [syncScrollPosition]);

  const handleConvertedScroll = useCallback(() => {
    if (syncScrollSourceRef.current === 'original') return;
    syncScrollPosition('converted');
  }, [syncScrollPosition]);

  return (
    <div
      className="border-l border-gray-200 bg-white shrink-0 flex flex-col relative transition-all duration-300 h-full"
      style={{ width: isCollapsed ? SIDE_PANEL_COLLAPSED_WIDTH : panelWidth }}
    >
      {/* 左侧拖拽条（展开时显示） */}
      {!isCollapsed && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors z-10"
          onMouseDown={handleResizeMouseDown}
        />
      )}

      {isCollapsed ? (
        /* 折叠状态 */
        <div className="box-border h-full w-full flex flex-col items-center justify-start pt-5 px-1.5">
          <button
            onClick={onExpand}
            className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
            title="展开输入文本"
          >
            <PanelRightOpen className="w-3.5 h-3.5" />
          </button>
          <div className="[writing-mode:vertical-rl] text-[11px] leading-none text-gray-500 mt-2.5 select-none">
            输入文本
          </div>
        </div>
      ) : (
        /* 展开状态 */
        <>
          {/* 标题栏 */}
          <div className="px-3 py-2.5 border-b border-gray-200 flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-gray-700 shrink-0">输入文本</span>
            <span className="text-[11px] text-gray-400">双栏对照</span>
            <button
              onClick={onCollapse}
              className="ml-auto p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors shrink-0"
              title="折叠面板"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          </div>

          {/* 操作按钮 */}
          <div className="px-3 py-2 border-b border-gray-100 flex flex-wrap gap-1.5 shrink-0">
            <button
              onClick={onClear}
              className="flex-1 px-2 py-1.5 text-xs text-red-700 hover:bg-red-50 border border-red-200 rounded transition-colors"
            >
              清空
            </button>
            <button
              onClick={onStartProofreading}
              className="w-full px-2 py-1.5 text-xs text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors"
            >
              开始校对
            </button>
          </div>

          {/* 双栏文本区域 */}
          <div className="flex-1 overflow-hidden p-2">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5 shrink-0">
                <input
                  type="text"
                  value={comparisonSearchKeyword}
                  onChange={(e) => setComparisonSearchKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      jumpComparisonMatch(e.shiftKey ? -1 : 1);
                    }
                  }}
                  placeholder="搜索对比内容"
                  className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-200 rounded outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <span className={`text-[11px] w-14 text-center ${comparisonSearchKeyword && comparisonMatchRows.length === 0 ? 'text-red-500' : 'text-gray-500'}`}>
                  {comparisonSearchKeyword ? `${comparisonMatchRows.length === 0 ? 0 : comparisonMatchIndex + 1}/${comparisonMatchRows.length}` : '--/--'}
                </span>
                <button
                  onClick={() => jumpComparisonMatch(-1)}
                  disabled={comparisonMatchRows.length === 0}
                  className="px-2 py-1.5 text-xs text-gray-700 border border-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                >
                  上一个
                </button>
                <button
                  onClick={() => jumpComparisonMatch(1)}
                  disabled={comparisonMatchRows.length === 0}
                  className="px-2 py-1.5 text-xs text-gray-700 border border-gray-200 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                >
                  下一个
                </button>
              </div>
              <div className="grid grid-cols-2 border-b border-gray-100">
                <div className="border-r border-gray-100">
                  <div className="px-3 py-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-700">转换前</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400">{originalText ? `${originalText.split('\n').filter(Boolean).length} 行` : '0 行'}</span>
                      <button
                        onClick={onCopyOriginal}
                        className={`px-2 py-1 text-[11px] rounded transition-colors ${
                          copySuccess ? 'bg-green-600 text-white' : 'text-gray-700 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        {copySuccess ? '已复制' : '复制前'}
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="px-3 py-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-700">转换后</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400">{convertedText ? `${convertedText.split('\n').filter(Boolean).length} 行` : '0 行'}</span>
                      <button
                        onClick={onCopyConverted}
                        className="px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-100 border border-gray-200 rounded transition-colors"
                      >
                        复制后
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <AlignedTextGrid
                rows={alignedRows}
                searchKeyword={comparisonSearchKeyword}
                scrollRef={leftScrollRef}
                activeRowIndex={activeComparisonRowIndex}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default InputPanel;
