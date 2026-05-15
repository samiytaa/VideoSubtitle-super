import { BookOpen, Copy, Download, FileCheck, FileText, RotateCcw, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useNotifier } from './Notifications';
import { convertTextMainline, convertTextMitan, reverseConvertText } from '../utils/textConversionUtils';

const MODE_STORAGE_KEY = 'formatConverter_mode';
const RECENT_TITLES_STORAGE_KEY = 'recentTitles';
const MAX_RECENT_TITLES = 5;

const FormatConverter: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [mode, setMode] = useState<'mitan' | 'mainline'>(() => {
    const savedMode = localStorage.getItem(MODE_STORAGE_KEY);
    return savedMode === 'mainline' ? 'mainline' : 'mitan';
  });
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [chapterInput, setChapterInput] = useState('');
  const [recentTitles, setRecentTitles] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_TITLES_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const { addToast } = useNotifier();

  useEffect(() => {
    localStorage.setItem(RECENT_TITLES_STORAGE_KEY, JSON.stringify(recentTitles));
  }, [recentTitles]);

  useEffect(() => {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  }, [mode]);

  const applyTitle = (title: string) => {
    const titleLine = `《${title}》`;
    setInputText((prev) => {
      const lines = prev.split('\n');
      if (lines[0]?.startsWith('《') && lines[0]?.endsWith('》')) {
        lines[0] = titleLine;
        return lines.join('\n');
      }
      return titleLine + (prev ? `\n${prev}` : '');
    });
  };

  const handleAddTitle = () => {
    const title = titleInput.trim();
    if (!title) {
      addToast('请输入标题', 'error');
      return;
    }

    applyTitle(title);
    setRecentTitles((prev) => [title, ...prev.filter((item) => item !== title)].slice(0, MAX_RECENT_TITLES));
    setTitleInput('');
  };

  const handleAddChapter = () => {
    const chapter = chapterInput.trim();
    if (!/^\d+$/.test(chapter) || Number(chapter) <= 0) {
      addToast('请输入章节数字', 'error');
      return;
    }

    const paddedChapter = chapter.padStart(2, '0');
    setInputText((prev) => {
      const lines = prev.split('\n');
      const titleIndex = lines.findIndex((line) => line.startsWith('《') && line.endsWith('》'));
      if (titleIndex === -1) {
        addToast('请先添加标题《xxx》', 'error');
        return prev;
      }

      lines.splice(titleIndex + 1, 0, `==${paddedChapter}==`);
      return lines.join('\n');
    });
    setChapterInput('');
  };

  const handleConvert = () => {
    if (!inputText.trim()) {
      addToast('请输入要转换的文本', 'error');
      return;
    }

    if (mode === 'mitan') {
      const hasTitle = /《.+?》/.test(inputText);
      const hasChapter = /==\d+==/.test(inputText);
      if (!hasTitle) {
        addToast('请先添加标题《xxx》', 'error');
        return;
      }
      if (!hasChapter) {
        addToast('请先添加章节 ==数字==', 'error');
        return;
      }
    }

    const result = mode === 'mitan' ? convertTextMitan(inputText) : convertTextMainline(inputText);

    if (result.success) {
      setOutputText(result.output);
      addToast('文本转换成功', 'success');
      return;
    }

    addToast(result.error || '转换失败', 'error');
  };

  const handleReverseConvert = () => {
    if (!outputText.trim()) {
      addToast('请先进行正向转换，或保证输出区域有内容', 'error');
      return;
    }

    const result = reverseConvertText(outputText, mode);
    if (result.success) {
      setInputText(result.output);
      addToast('反推成功', 'success');
      return;
    }

    addToast(result.error || '反推失败', 'error');
  };

  const handleCopyOutput = async () => {
    if (!outputText) {
      addToast('没有可复制的内容', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(outputText);
      addToast('已复制到剪贴板', 'success');
    } catch {
      addToast('复制失败', 'error');
    }
  };

  const handleDownload = () => {
    if (!outputText) {
      addToast('没有可下载的内容', 'error');
      return;
    }

    const blob = new Blob([outputText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `converted_${Date.now()}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    addToast('文件下载成功', 'success');
  };

  const lineCount = (text: string) => (text ? `${text.split('\n').length} 行` : '');

  const infoRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!infoDialogOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setInfoDialogOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [infoDialogOpen]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex justify-center">
        <div ref={infoRef} className="relative inline-flex shrink-0 items-center rounded-xl border border-indigo-100 bg-white p-1 shadow-sm">
          <div
            role="tablist"
            aria-label="转换方式"
            className="inline-flex items-center"
          >
          <button
            role="tab"
            aria-selected={mode === 'mitan'}
            onClick={() => setMode('mitan')}
            className={`min-w-19 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-150 ${
              mode === 'mitan'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
            }`}
          >
            密探
          </button>
          <button
            role="tab"
            aria-selected={mode === 'mainline'}
            onClick={() => setMode('mainline')}
            className={`min-w-19 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-150 ${
              mode === 'mainline'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
            }`}
          >
            通用
          </button>
          <div className="mx-1 h-5 w-px bg-indigo-100" />
          <button
            type="button"
            onClick={() => setInfoDialogOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-150 ${
              infoDialogOpen
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-500 hover:bg-indigo-50 hover:text-indigo-700'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>说明</span>
          </button>
          </div>

          {infoDialogOpen && (
            <div className="absolute left-1/2 top-full z-50 mt-2 w-104 -translate-x-1/2 rounded-2xl border border-gray-200 bg-white shadow-2xl">
              {/* 标题栏 */}
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100">
                <BookOpen className="h-4 w-4 text-indigo-600 shrink-0" />
                <span className="text-sm font-semibold text-gray-800 tracking-wide">
                  {mode === 'mitan' ? '密探模式说明' : '通用模式说明'}
                </span>
              </div>
              {/* 内容区 */}
              <div className="px-5 py-4">
                <ul className="space-y-2.5">
                  {mode === 'mitan' ? (
                    <>
                      <li className="flex items-start gap-2.5 text-sm text-gray-700">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                        <span>标题：<code className="font-mono text-indigo-600">《标题名》</code>，章节：<code className="font-mono text-indigo-600">==数字==</code></span>
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-gray-700">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                        <span>场景标记：<code className="font-mono text-indigo-600">【==场景名==】</code></span>
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-gray-700">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                        <span>对话：<code className="font-mono text-indigo-600">角色名：对话内容</code></span>
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-gray-700">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                        <span>心理活动：<code className="font-mono text-indigo-600">（内容）</code></span>
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-gray-700">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                        <span>旁白：<code className="font-mono text-indigo-600">【内容】</code> 或普通文本</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-gray-700">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                        <span>嵌套分歧：<code className="font-mono text-violet-600">{'{{选择开始}} / {{选择：选项}} / {{选择结束}}'}</code></span>
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-start gap-2.5 text-sm text-gray-700">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                        <span>对话：<code className="font-mono text-indigo-600">角色名：对话内容</code></span>
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-gray-700">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                        <span>心理活动：<code className="font-mono text-indigo-600">（内容）</code></span>
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-gray-700">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                        <span>旁白：<code className="font-mono text-indigo-600">【内容】</code> 或普通文本</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-gray-700">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                        <span>场景标记：<code className="font-mono text-indigo-600">【==场景名==】</code></span>
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-gray-700">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                        <span>嵌套分歧：<code className="font-mono text-violet-600">{'{{选择开始}} / {{选择：选项}} / {{选择结束}}'}</code></span>
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>


      <div className="flex min-h-0 flex-1 gap-3">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
              <div className="flex shrink-0 items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-xs font-medium text-gray-600">输入文本</span>
              </div>
              {mode === 'mitan' && (
                <>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTitle()}
                      placeholder="标题名..."
                      className="w-24 rounded-md border border-gray-300 px-2 py-1 text-xs transition-shadow duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddTitle}
                      className="whitespace-nowrap rounded-md bg-indigo-100 px-2 py-1 text-xs text-indigo-700 transition-colors duration-150 hover:bg-indigo-200"
                    >
                      + 标题
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={chapterInput}
                      onChange={(e) => setChapterInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddChapter()}
                      placeholder="章节数字..."
                      className="w-20 rounded-md border border-gray-300 px-2 py-1 text-xs transition-shadow duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddChapter}
                      className="whitespace-nowrap rounded-md bg-indigo-100 px-2 py-1 text-xs text-indigo-700 transition-colors duration-150 hover:bg-indigo-200"
                    >
                      + 章节
                    </button>
                  </div>
                  {recentTitles.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-xs text-gray-400">最近:</span>
                      {recentTitles.map((title) => (
                        <span key={title} className="inline-flex items-center rounded border border-gray-200 bg-white text-xs text-gray-600">
                          <button
                            type="button"
                            onClick={() => applyTitle(title)}
                            className="px-1.5 py-0.5 transition-colors duration-150 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            《{title}》
                          </button>
                          <button
                            type="button"
                            onClick={() => setRecentTitles((prev) => prev.filter((t) => t !== title))}
                            className="border-l border-gray-200 px-1 py-0.5 text-gray-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-500"
                            aria-label="删除"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="在此输入或粘贴要转换的文本..."
            className="flex-1 resize-none rounded-lg border border-gray-300 p-3 font-mono text-sm transition-shadow duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="mt-1 text-right text-xs text-gray-400">{lineCount(inputText)}</div>
        </div>

        <div className="flex flex-col items-center justify-center gap-2 px-1">
          <button
            onClick={handleConvert}
            className="flex w-20 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-indigo-700"
          >
            <FileCheck className="h-4 w-4" />
            转换
          </button>
          <button
            type="button"
            onClick={() => { setInputText(''); setOutputText(''); }}
            className="flex w-20 items-center justify-center gap-1.5 rounded-lg bg-gray-200 px-3 py-2 text-sm font-medium text-gray-600 shadow-sm transition-colors duration-150 hover:bg-gray-300"
          >
            <X className="h-4 w-4" />
            清空
          </button>
          <button
            onClick={handleReverseConvert}
            disabled={!outputText}
            className="flex w-20 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" />
            反推
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-1.5 flex items-center gap-1.5">
            <FileCheck className="h-3.5 w-3.5 text-gray-500" />
            <span className="text-xs font-medium text-gray-600">转换结果</span>
            <div className="ml-auto flex gap-1.5">
              <button
                onClick={handleCopyOutput}
                disabled={!outputText}
                className="flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 transition-colors duration-150 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Copy className="h-3 w-3" />
                复制
              </button>
              <button
                onClick={handleDownload}
                disabled={!outputText}
                className="flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 transition-colors duration-150 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download className="h-3 w-3" />
                下载
              </button>
            </div>
          </div>
          <textarea
            value={outputText}
            onChange={(e) => setOutputText(e.target.value)}
            placeholder="转换结果将显示在这里..."
            className="flex-1 resize-none rounded-lg border border-gray-300 p-3 font-mono text-sm transition-shadow duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="mt-1 text-right text-xs text-gray-400">{lineCount(outputText)}</div>
        </div>
      </div>
    </div>
  );
};

export default FormatConverter;
