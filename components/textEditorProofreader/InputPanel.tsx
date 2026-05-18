import React, { useRef, useCallback, useEffect, useState, useImperativeHandle, useMemo } from 'react';
import { BookOpen, ChevronDown, Copy } from 'lucide-react';
import { SIDE_PANEL_COLLAPSED_WIDTH } from '../panelConstants';
import SearchBar from './SearchBar';
import CollapsibleSidebar from '../common/CollapsibleSidebar';

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
type EditorTab = 'original' | 'converted';

type HelpItem = {
  label: string;
  example: string;
  tone: 'indigo' | 'violet';
  suffix?: string;
};

const PROOFREAD_HELP_ITEMS: HelpItem[] = [
  {
    label: '对话',
    example: '角色名：对话内容',
    tone: 'indigo',
  },
  {
    label: '心理活动',
    example: '（内容）',
    tone: 'indigo',
  },
  {
    label: '旁白',
    example: '【内容】',
    suffix: ' 或普通文本',
    tone: 'indigo',
  },
  {
    label: '场景标记',
    example: '【==场景名==】',
    tone: 'indigo',
  },
  {
    label: '嵌套分歧',
    example: '{{选择开始}} / {{选择：选项}} / {{选择结束}}',
    tone: 'violet',
  },
] as const;
const MITAN_HELP_ITEMS: HelpItem[] = [
  {
    label: '标题',
    example: '《角色名》',
    tone: 'indigo',
  },
  {
    label: '章节',
    example: '==数字==',
    tone: 'indigo',
  },
] as const;

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** 将纯文本片段转为带视觉换行的 HTML（}} 后插入视觉 br） */
function formatDisplayFragment(text: string): string {
  if (!text) return '';
  return escapeHtml(text)
    .replace(/\n/g, '<br>')
    .replace(/}}(?!<br>)/g, '}}<br data-visual="1">');
}

/** 将纯文本转为可显示 HTML，并支持搜索高亮 */
function textToDisplayHtml(text: string, searchKeyword = '', activeMatchIndex = -1): string {
  if (!text) return '';
  if (!searchKeyword.trim()) return formatDisplayFragment(text);

  const matches = getMatchOffsets(text, searchKeyword);
  if (matches.length === 0) return formatDisplayFragment(text);

  const parts: string[] = [];
  let cursor = 0;

  matches.forEach((match, index) => {
    if (cursor < match.start) {
      parts.push(formatDisplayFragment(text.slice(cursor, match.start)));
    }

    const matchHtml = formatDisplayFragment(text.slice(match.start, match.end));
    const className = index === activeMatchIndex
      ? 'bg-amber-200 ring-1 ring-amber-300 rounded-[4px]'
      : 'bg-amber-100 rounded-[4px]';
    parts.push(`<mark class="${className}" data-search-match="${index}">${matchHtml}</mark>`);
    cursor = match.end;
  });

  if (cursor < text.length) {
    parts.push(formatDisplayFragment(text.slice(cursor)));
  }

  return parts.join('');
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

function findScrollContainer(el: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = el;
  while (current) {
    if (
      current.dataset.editorScrollContainer === 'true' ||
      (current.scrollHeight > current.clientHeight && current.clientHeight > 0)
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return el.parentElement;
}

interface InputEditorProps {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  mode?: 'original' | 'converted';
  preserveLineMapping?: boolean;
  wrapLongLines?: boolean;
  searchKeyword?: string;
  activeMatchIndex?: number;
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

const InputEditor = React.forwardRef<InputEditorHandle, InputEditorProps>(({
  value,
  onChange,
  placeholder,
  mode = 'original',
  preserveLineMapping = false,
  wrapLongLines = false,
  searchKeyword = '',
  activeMatchIndex = -1,
}, ref) => {
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
    el.innerHTML = textToDisplayHtml(value, searchKeyword, activeMatchIndex);
    if (offset !== null) {
      setCaretOffset(el, offset);
    }
  }, [activeMatchIndex, searchKeyword, value]);

  // 初始化
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = textToDisplayHtml(value, searchKeyword, activeMatchIndex);
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
    el.innerHTML = textToDisplayHtml(plain, searchKeyword, activeMatchIndex);
    // 恢复光标（偏移量不变，因为视觉 br 不计入文本长度）
    setCaretOffset(el, offset);
  }, [activeMatchIndex, onChange, searchKeyword]);

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

      const scrollContainer = findScrollContainer(el);
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
      className="block h-full min-h-full min-w-full overflow-y-auto overflow-x-hidden p-2 border border-transparent rounded-md text-[13px] focus:outline-none"
      style={{
        fontFamily: mode === 'converted' ? '"Cascadia Code", "Consolas", "Courier New", monospace' : 'inherit',
        whiteSpace: wrapLongLines ? 'pre-wrap' : preserveLineMapping ? 'pre' : 'pre-wrap',
        wordBreak: wrapLongLines ? 'break-word' : preserveLineMapping ? 'normal' : 'break-word',
        overflowWrap: wrapLongLines ? 'anywhere' : preserveLineMapping ? 'normal' : 'anywhere',
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

interface EditorPaneProps {
  label?: string;
  value: string;
  placeholder: string;
  onEditorChange: (text: string) => void;
  editorRef: React.RefObject<InputEditorHandle | null>;
  mode: 'original' | 'converted';
  plainBackground?: boolean;
  preserveLineMapping?: boolean;
  heightClassName?: string;
  wrapLongLines?: boolean;
  searchKeyword?: string;
  activeMatchIndex?: number;
}

const EditorPane: React.FC<EditorPaneProps> = ({
  label,
  value,
  placeholder,
  onEditorChange,
  editorRef,
  mode,
  plainBackground = false,
  preserveLineMapping = false,
  heightClassName,
  wrapLongLines = false,
  searchKeyword = '',
  activeMatchIndex = -1,
}) => {
  return (
    <div className={`min-w-0 flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ${heightClassName ?? ''}`}>
      {label ? (
        <div className="shrink-0 border-b border-gray-100 px-3 py-2">
          <span className="inline-flex rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-600 shadow-sm">
            {label}
          </span>
        </div>
      ) : null}
      <div
        className="min-h-0 flex-1 overflow-hidden p-3"
        style={{
          backgroundImage: plainBackground
            ? 'none'
            : 'repeating-linear-gradient(to bottom, rgba(248,250,252,0.0) 0, rgba(248,250,252,0.0) 2rem, rgba(99,102,241,0.045) 2rem, rgba(99,102,241,0.045) 4rem)',
          backgroundColor: plainBackground ? '#ffffff' : undefined,
        }}
      >
        <InputEditor
          ref={editorRef}
          value={value}
          onChange={onEditorChange}
          placeholder={placeholder}
          mode={mode}
          preserveLineMapping={preserveLineMapping}
          wrapLongLines={wrapLongLines}
          searchKeyword={searchKeyword}
          activeMatchIndex={activeMatchIndex}
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
  const [activeTab, setActiveTab] = useState<EditorTab>('original');
  const [helpExpanded, setHelpExpanded] = useState(false);
  const originalEditorRef = useRef<InputEditorHandle>(null);
  const convertedEditorRef = useRef<InputEditorHandle>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);

  const isResizing = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const currentText = activeTab === 'original' ? originalText : convertedText;
  const currentEditorRef = activeTab === 'original' ? originalEditorRef : convertedEditorRef;
  const searchMatches = useMemo(() => getMatchOffsets(currentText, searchKeyword), [currentText, searchKeyword]);

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
    if (searchMatches.length === 0) {
      setSearchMatchIndex(0);
      return;
    }
    if (searchMatchIndex >= searchMatches.length) {
      setSearchMatchIndex(0);
    }
  }, [searchMatchIndex, searchMatches.length]);

  useEffect(() => {
    const activeMatch = searchMatches[searchMatchIndex];
    if (!activeMatch) return;
    currentEditorRef.current?.focusMatch(activeMatch.start, activeMatch.end);
  }, [currentEditorRef, searchMatchIndex, searchMatches]);

  useEffect(() => {
    setSearchMatchIndex(0);
  }, [activeTab]);

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

  const jumpSearchMatch = useCallback((direction: 1 | -1) => {
    const total = searchMatches.length;
    if (total === 0) return;
    setSearchMatchIndex((prev) => {
      if (direction === 1) return (prev + 1) % total;
      return (prev - 1 + total) % total;
    });
  }, [searchMatches.length]);

  const handleCopyCurrent = useCallback(() => {
    if (activeTab === 'original') {
      void onCopyOriginal();
      return;
    }
    void onCopyConverted();
  }, [activeTab, onCopyConverted, onCopyOriginal]);

  return (
    <CollapsibleSidebar
      side="right"
      title="输入文本"
      collapsed={isCollapsed}
      expandedWidth={panelWidth}
      collapsedWidth={SIDE_PANEL_COLLAPSED_WIDTH}
      onExpand={onExpand}
      onCollapse={onCollapse}
      className="bg-white"
      bodyClassName="flex-1 flex flex-col overflow-hidden"
      collapseTitle="折叠输入文本"
      expandTitle="展开输入文本"
      headerStart={<span className="text-[11px] text-gray-400">双栏对照</span>}
      headerEnd={(
        <button
          type="button"
          onClick={() => setHelpExpanded((value) => !value)}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors ${
            helpExpanded
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-gray-400 hover:bg-gray-100 hover:text-indigo-600'
          }`}
          title={helpExpanded ? '收起格式说明' : '展开格式说明'}
          aria-expanded={helpExpanded}
          aria-label="格式说明"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${helpExpanded ? 'rotate-180' : ''}`} />
        </button>
      )}
      resizeHandle={(
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors z-10"
          onMouseDown={handleResizeMouseDown}
        />
      )}
    >

          {helpExpanded && (
            <div className="mx-3 mt-2 shrink-0 overflow-hidden rounded-xl border border-indigo-100 bg-indigo-50/45">
              <div className="flex items-center gap-2 border-b border-indigo-100 px-3 py-2">
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                <span className="text-xs font-semibold text-gray-800">格式说明</span>
              </div>
              <div className="px-3 py-3">
                <div>
                  <div className="mb-2 text-[11px] font-semibold tracking-wide text-indigo-700">通用格式</div>
                  <ul className="space-y-2">
                    {PROOFREAD_HELP_ITEMS.map((item) => (
                      <li key={item.label} className="flex items-start gap-2 text-xs leading-5 text-gray-700">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                        <span>
                          {item.label}：
                          <code className={`font-mono ${item.tone === 'violet' ? 'text-violet-600' : 'text-indigo-600'}`}>
                            {item.example}
                          </code>
                          {item.suffix ?? ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-3 border-t border-indigo-100 pt-3">
                  <div className="mb-2 text-[11px] font-semibold tracking-wide text-indigo-700">密探模式特殊说明</div>
                  <ul className="space-y-2">
                    {MITAN_HELP_ITEMS.map((item) => (
                      <li key={item.label} className="flex items-start gap-2 text-xs leading-5 text-gray-700">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                        <span>
                          {item.label}：
                          <code className={`font-mono ${item.tone === 'violet' ? 'text-violet-600' : 'text-indigo-600'}`}>
                            {item.example}
                          </code>
                          {item.suffix ?? ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* 操作按钮 + 搜索栏同一行 */}
          <div className="px-3 py-1.5 border-b border-gray-100 flex items-center gap-2 shrink-0">
            <button
              onClick={onClear}
              className="shrink-0 px-3 py-1 text-xs text-red-700 hover:bg-red-50 border border-red-200 rounded transition-colors"
            >
              清空
            </button>
            <button
              onClick={onStartProofreading}
              className="shrink-0 min-w-[120px] px-3 py-1 text-xs text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors"
            >
              开始校对
            </button>
            <SearchBar
              searchKeyword={searchKeyword}
              currentMatchIndex={searchMatchIndex}
              totalMatches={searchMatches.length}
              onSearchKeywordChange={setSearchKeyword}
              onJumpToRelativeMatch={jumpSearchMatch}
              placeholder="搜索对比内容"
              embedded
              className="ml-1"
            />
          </div>

          <div className="mx-2 mb-2 mt-2 flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-3 py-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('original')}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    activeTab === 'original'
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  转换前
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('converted')}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    activeTab === 'converted'
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  转换后
                </button>
                <button
                  type="button"
                  onClick={handleCopyCurrent}
                  className="ml-auto inline-flex shrink-0 items-center gap-1 rounded border border-gray-200 px-3 py-1 text-xs text-gray-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                  title={activeTab === 'original' ? '复制转换前内容' : '复制转换后内容'}
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copySuccess ? '已复制' : '复制'}
                </button>
              </div>
            </div>
            <div
              ref={leftScrollRef}
              data-editor-scroll-container="true"
              className="min-h-0 flex-1 overflow-hidden p-3"
            >
              <EditorPane
                value={currentText}
                placeholder={activeTab === 'original' ? '在此编辑转换前原文…' : '在此编辑转换后模板…'}
                onEditorChange={activeTab === 'original' ? handleOriginalEditorChange : handleConvertedEditorChange}
                editorRef={currentEditorRef}
                mode={activeTab}
                plainBackground
                heightClassName="h-full"
                wrapLongLines={activeTab === 'original'}
                searchKeyword={searchKeyword}
                activeMatchIndex={searchMatches.length > 0 ? searchMatchIndex : -1}
              />
            </div>
          </div>
    </CollapsibleSidebar>
  );
};

export default InputPanel;
