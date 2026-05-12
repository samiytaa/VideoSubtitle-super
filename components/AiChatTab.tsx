import React, { useMemo, useRef, useState, useCallback } from 'react';
import { Copy, Layers, Loader2, ScanText, Sparkles, Trash2 } from 'lucide-react';
import { MergedImage } from '../types';
import OcrResultPanel from './baimiao/OcrResultPanel';

type ModelItem = {
  id?: string;
};

const STORAGE_KEYS = {
  apiUrl: 'apiUrl',
  apiKey: 'apiKey',
  model: 'model',
  systemPrompt: 'aiChat_systemPrompt',
};

const normalizeEndpoint = (endpoint: string) => {
  if (!endpoint) return 'https://api.openai.com/v1/chat/completions';
  const withProtocol = /^https?:\/\//i.test(endpoint) ? endpoint : `https://${endpoint}`;
  return withProtocol.endsWith('/chat/completions')
    ? withProtocol
    : `${withProtocol.replace(/\/$/, '')}/chat/completions`;
};

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 120000) => {
  const controller = new AbortController();
  const id = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    window.clearTimeout(id);
  }
};

const request = async (url: string, options: RequestInit & { timeout?: number } = {}) => {
  const { timeout = 120000, ...rest } = options;
  const response = await fetchWithTimeout(url, rest, timeout);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `API请求失败: ${response.status} ${response.statusText}${text ? ` - ${text.slice(0, 200)}` : ''}`,
    );
  }
  return response;
};

const requestStream = async (
  url: string,
  options: RequestInit & { timeout?: number },
  onChunk: (delta: string, fullContent: string) => void,
) => {
  const response = await request(url, options);
  if (!response.body) throw new Error('流式响应不可用');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data: ')) continue;
      const dataStr = trimmed.slice(6).trim();
      if (dataStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed.choices?.[0]?.delta?.content || '';
        if (!delta) continue;
        fullContent += delta;
        onChunk(delta, fullContent);
      } catch {
        continue;
      }
    }
  }

  return fullContent;
};

type AiChatTabProps = {
  mergedImages?: MergedImage[];
  onOneClickRecognize?: () => void;
};

const AiChatTab: React.FC<AiChatTabProps> = ({ mergedImages = [], onOneClickRecognize }) => {
  const [apiUrl, setApiUrl] = useState(localStorage.getItem(STORAGE_KEYS.apiUrl) || '');
  const [apiKey, setApiKey] = useState(localStorage.getItem(STORAGE_KEYS.apiKey) || '');
  const [model, setModel] = useState(localStorage.getItem(STORAGE_KEYS.model) || '');
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isTestingModel, setIsTestingModel] = useState(false);
  const [isApiConfigOpen, setIsApiConfigOpen] = useState(false);

  const [inputText, setInputText] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(
    localStorage.getItem(STORAGE_KEYS.systemPrompt) || '',
  );

  const [outputText, setOutputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _abortRef = useRef<AbortController | null>(null);

  const hasConfig = useMemo(() => !!apiUrl && !!apiKey && !!model, [apiKey, apiUrl, model]);

  const persistConfig = (next: { apiUrl?: string; apiKey?: string; model?: string }) => {
    if (next.apiUrl !== undefined) localStorage.setItem(STORAGE_KEYS.apiUrl, next.apiUrl);
    if (next.apiKey !== undefined) localStorage.setItem(STORAGE_KEYS.apiKey, next.apiKey);
    if (next.model !== undefined) localStorage.setItem(STORAGE_KEYS.model, next.model);
  };

  const fetchModels = async () => {
    if (!apiUrl || !apiKey) {
      setStatus('请先配置API地址和密钥');
      return;
    }
    setIsFetchingModels(true);
    setStatus('拉取中...');
    try {
      const base = normalizeEndpoint(apiUrl).replace(/\/chat\/completions$/, '');
      const response = await request(`${base}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000,
      });
      const data = await response.json();
      const list = ((data.data || data.models || []) as ModelItem[])
        .map((item) => item.id || String(item))
        .filter(Boolean);
      setModels(list);
      setStatus(list.length ? `✅ ${list.length}个模型` : '无模型');
      if (model && list.includes(model)) return;
      if (list[0]) {
        setModel(list[0]);
        persistConfig({ model: list[0] });
      }
    } catch (error) {
      setStatus(`❌ ${(error as Error).message}`);
    } finally {
      setIsFetchingModels(false);
    }
  };

  const testModel = async () => {
    if (!hasConfig) {
      setStatus('请先配置完整的API信息');
      return;
    }
    setIsTestingModel(true);
    setStatus('测试中...');
    try {
      const endpoint = normalizeEndpoint(apiUrl);
      const response = await request(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: '请回复"OK"，不要有其他内容。' }],
          stream: false,
        }),
        timeout: 30000,
      });
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';
      setStatus(`✅ 成功: ${String(text).slice(0, 30)}`);
    } catch (error) {
      setStatus(`❌ ${(error as Error).message}`);
    } finally {
      setIsTestingModel(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;
    if (!hasConfig) {
      setErrorMsg('请先配置API信息');
      return;
    }
    setErrorMsg('');
    setOutputText('');
    setIsSending(true);

    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt.trim()) {
      messages.push({ role: 'system', content: systemPrompt.trim() });
    }
    messages.push({ role: 'user', content: inputText.trim() });

    try {
      const endpoint = normalizeEndpoint(apiUrl);
      await requestStream(
        endpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model, messages, stream: true }),
          timeout: 120000,
        },
        (_, current) => setOutputText(current),
      );
    } catch (error) {
      setErrorMsg(`错误: ${(error as Error).message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleClear = () => {
    setInputText('');
    setOutputText('');
    setErrorMsg('');
  };

  const handleCopyOutput = () => {
    if (outputText) void navigator.clipboard.writeText(outputText);
  };

  // ── 拼接图片 OCR ──────────────────────────────────────────────────────────
  const [mergedOcrLoading, setMergedOcrLoading] = useState(false);
  const [mergedOcrText, setMergedOcrText] = useState('');
  const [mergedOcrStatus, setMergedOcrStatus] = useState('');

  const postJson = useCallback(async (url: string, body: unknown) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((payload as any).error || `Request failed: ${response.status}`);
    }
    return payload as any;
  }, []);

  const runMergedImagesOcr = async () => {
    if (mergedImages.length === 0) {
      setMergedOcrStatus('暂无拼接图片，请先在"查看图片 > 拼接结果"中生成拼接图');
      return;
    }
    setMergedOcrLoading(true);
    setMergedOcrStatus('');
    try {
      const marker = 'base64,';
      const toBase64 = async (url: string) => {
        if (url.includes(marker)) return url.split(marker)[1];
        const blob = await fetch(url).then((res) => res.blob());
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(String(e.target?.result ?? ''));
          reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'));
          reader.readAsDataURL(blob);
        });
        if (!dataUrl.includes(marker)) throw new Error('图片数据格式不支持');
        return dataUrl.split(marker)[1];
      };

      const images = await Promise.all(
        mergedImages.map(async (img) => ({
          filename: img.filename,
          image_base64: await toBase64(img.url),
        }))
      );
      const payload = await postJson('/api/baimiao/debug-ocr', {
        images: images.map((item) => ({ image_base64: item.image_base64 })),
      });

      const results = (payload.results ?? []) as Array<{ ok?: boolean; text?: string; error?: string }>;
      const rawText = results
        .map((item) =>
          item.ok
            ? `${item.text || '[空结果]'}`
            : `[识别失败] ${item.error || '未知错误'}`
        )
        .join('\n');

      // 移除空行，再移除连续重复行
      const mergedText = rawText
        .split('\n')
        .filter((line) => line.trim() !== '')
        .filter((line, idx, arr) => idx === 0 || line !== arr[idx - 1])
        .join('\n');
      const successCount = results.filter((item) => item.ok).length;
      setMergedOcrText(mergedText);
      setMergedOcrStatus(`拼接图 OCR 完成：成功 ${successCount}/${results.length}`);
    } catch (err) {
      setMergedOcrStatus(`错误：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setMergedOcrLoading(false);
    }
  };

  const copyMergedOcrText = async () => {
    if (!mergedOcrText) return;
    await navigator.clipboard.writeText(mergedOcrText);
    setMergedOcrStatus('已复制');
  };
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col gap-3">

      {/* ── 三栏主区域 ── */}
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-3">

        {/* 列一：拼接图片 OCR */}
        <div className="flex min-h-0 flex-col rounded-xl border border-gray-200/60 bg-white shadow-sm">
          {/* 卡片头 */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-semibold text-gray-800">拼接图片 OCR</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                共 {mergedImages.length} 张
              </span>
            </div>
            {mergedOcrStatus && (
              <span className="max-w-[140px] truncate text-xs text-gray-400">{mergedOcrStatus}</span>
            )}
          </div>

          {/* 卡片体 */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
            {/* 操作按钮 */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onOneClickRecognize}
                disabled={!onOneClickRecognize}
                title="先合并分组，再按默认参数拼接所有图片"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                一键识别
              </button>
              <button
                type="button"
                onClick={() => void runMergedImagesOcr()}
                disabled={mergedImages.length === 0 || mergedOcrLoading}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mergedOcrLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <ScanText className="h-4 w-4" />}
                {mergedOcrLoading ? 'OCR 中…' : '一键 OCR'}
              </button>
            </div>

            {/* OCR 结果面板 */}
            <div className="min-h-0 flex-1">
              <OcrResultPanel
                text={mergedOcrText}
                minHeightClassName="min-h-0 h-full"
                actionSlot={
                  <div className="flex items-center gap-1.5">
                    {mergedOcrText && (
                      <span className="text-[10px] text-gray-400">{mergedOcrText.length} 字符</span>
                    )}
                    <button
                      type="button"
                      onClick={() => void copyMergedOcrText()}
                      disabled={!mergedOcrText}
                      className="inline-flex h-7 items-center gap-1 rounded-md bg-gray-100 px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Copy className="h-3 w-3" />
                      复制
                    </button>
                    <button
                      type="button"
                      onClick={() => setMergedOcrText('')}
                      disabled={!mergedOcrText}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-red-100 bg-red-50 px-2.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-3 w-3" />
                      清除
                    </button>
                  </div>
                }
              />
            </div>

            {/* 传到输入框 */}
            <button
              type="button"
              onClick={() => setInputText(mergedOcrText)}
              disabled={!mergedOcrText}
              className="h-9 w-full rounded-lg border border-indigo-200 bg-indigo-50 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              传到输入框
            </button>
          </div>
        </div>

        {/* 列二：输入（上）+ 提示词（下） */}
        <div className="flex min-h-0 flex-col gap-3">
          {/* 输入卡片 */}
          <div className="flex flex-col rounded-xl border border-gray-200/60 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-gray-800">输入</span>
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-gray-400 transition-colors hover:text-red-500"
              >
                清空
              </button>
            </div>
            <div className="p-3">
              <textarea
                className="min-h-[140px] w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-200"
                placeholder="在此输入需要处理的文本..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
              />
            </div>
          </div>

          {/* 提示词卡片 */}
          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-gray-200/60 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-gray-800">提示词</span>
              <button
                type="button"
                onClick={() => setIsApiConfigOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600 transition-colors hover:border-indigo-300 hover:bg-indigo-100"
              >
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
                </svg>
                配置 API
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-3">
              <textarea
                className="min-h-0 flex-1 w-full resize-none rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-200"
                placeholder="在此输入提示词，将作为 system 消息注入到请求中..."
                value={systemPrompt}
                onChange={(e) => {
                  setSystemPrompt(e.target.value);
                  localStorage.setItem(STORAGE_KEYS.systemPrompt, e.target.value);
                }}
              />
            </div>
            <div className="px-3 pb-3">
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={isSending || !inputText.trim()}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
              >
                {isSending ? '处理中...' : '发送（Ctrl+Enter）'}
              </button>
            </div>
          </div>
        </div>

        {/* 列三：输出结果 */}
        <div className="flex min-h-0 flex-col rounded-xl border border-gray-200/60 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="text-sm font-semibold text-gray-800">输出结果</span>
            <button
              type="button"
              onClick={handleCopyOutput}
              disabled={!outputText}
              className="inline-flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Copy className="h-3 w-3" />
              复制
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-3">
            {errorMsg ? (
              <div className="flex-1 overflow-y-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600 whitespace-pre-wrap break-words">
                {errorMsg}
              </div>
            ) : (
              <textarea
                className="min-h-0 flex-1 w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-200"
                placeholder={isSending ? '正在生成...' : '处理结果将显示在这里...'}
                value={outputText}
                onChange={(e) => setOutputText(e.target.value)}
                readOnly={isSending}
              />
            )}
          </div>
        </div>

      </div>

      {/* ── API 配置弹窗 ── */}
      {isApiConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-200/60 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
                </svg>
                <p className="text-sm font-semibold text-gray-800">配置 API</p>
              </div>
              <button
                type="button"
                onClick={() => setIsApiConfigOpen(false)}
                className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex flex-col gap-3 px-5 py-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">API 地址</label>
                <input
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-200"
                  placeholder="例如：https://api.openai.com/v1"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  onBlur={() => persistConfig({ apiUrl })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">API 密钥</label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-200"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onBlur={() => persistConfig({ apiKey })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">模型</label>
                <select
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-200"
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    persistConfig({ model: e.target.value });
                  }}
                >
                  <option value="">选择模型...</option>
                  {models.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void fetchModels()}
                  disabled={isFetchingModels}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isFetchingModels ? '拉取中...' : '拉取模型'}
                </button>
                <button
                  type="button"
                  onClick={() => void testModel()}
                  disabled={isTestingModel}
                  className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isTestingModel ? '测试中...' : '测试模型'}
                </button>
                {status && <span className="shrink-0 text-xs text-gray-500">{status}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AiChatTab;
