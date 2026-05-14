import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Copy, Loader2, RotateCcw, ScanText, Settings, Sparkles, StopCircle, Trash2 } from 'lucide-react';
import { MergedImage } from '../types';
import BaimiaoConfigModal from './baimiao/BaimiaoConfigModal';
import OcrResultPanel from './baimiao/OcrResultPanel';
import OcrDebugRunsPanel, { OcrDebugRun } from './baimiao/OcrDebugRunsPanel';
import { resolveBackendUrl } from '../utils/runtimeConfig';

type ModelItem = {
  id?: string;
};

type BaimiaoSummary = {
  accounts?: Array<{ id: string }>;
  selectedAccountId?: string;
};

const STORAGE_KEYS = {
  apiUrl: 'apiUrl',
  apiKey: 'apiKey',
  model: 'model',
  systemPrompt: 'aiChat_systemPrompt',
  defaultSystemPrompt: 'aiChat_defaultSystemPrompt',
};

const BUILTIN_DEFAULT_SYSTEM_PROMPT = `将以上剧本转为简体中文，
对代号鸢的人物名字进行校对
使用正确的剧本格式

剧本格式如下：
场景标记：【==场景名==】
对话格式：角色名：对话内容 //角色名包含“我”，也就是广陵王
心理活动：（内容）
旁白：【旁白】

示例：
输入：
隐鸢阁
我
没事，我们就去半山腰看看，看看就回来。
他只能点头，被我们带着登上山阶。北山通往古蜀山脉，群山起伏，终年冰封。
好冷…
我称衡！
我你眞
我你眞看
我你眞看见龙了？
你衡那当然呦，老子还能耍你们？

输出：
【==隐鸢阁==】
我：没事，我们就去半山腰看看，看看就回来。
【他只能点头，被我们带着登上山阶。北山通往古蜀山脉，群山起伏，终年冰封。】
（好冷……）
我：祢衡！
我：你真看见龙了？
祢衡：那当然喽，老子还能耍你们？

注意使用中文标点符号
注意同一个人物台词不要合并到一行，按照原本的
不能更改原本输入的顺序
要求只返回符合要求的剧本
！！！禁止在回复的开头和结尾增加不是剧本的内容！！！`;

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
  const upstreamSignal = options.signal;
  const signal =
    upstreamSignal && typeof AbortSignal.any === 'function'
      ? AbortSignal.any([controller.signal, upstreamSignal])
      : controller.signal;
  try {
    const response = await fetch(url, { ...options, signal });
    return response;
  } finally {
    window.clearTimeout(id);
  }
};

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const getMergedImageOrder = (filename: string) => {
  const batchMatch = filename.match(/merged_batch(\d+)_/i);
  if (batchMatch) return Number(batchMatch[1]);
  const anyNumberMatch = filename.match(/(\d+)/);
  if (anyNumberMatch) return Number(anyNumberMatch[1]);
  return Number.MAX_SAFE_INTEGER;
};

const getTaskTimeCode = (timestamp: number) => {
  const date = new Date(timestamp);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}${mm}${ss}`;
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
  const { timeout = 120000, ...rest } = options;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeout);
  console.log(`${DEBUG_TAG} requestStream:start`, { url, timeout });
  const response = await request(url, { ...rest, signal: controller.signal, timeout });
  console.log(`${DEBUG_TAG} requestStream:response`, {
    status: response.status,
    contentType: response.headers.get('content-type') || '',
  });
  if (!response.body) throw new Error('流式响应不可用');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';
  let hasFirstChunk = false;
  let inactivityTimer = window.setTimeout(() => controller.abort(), 30000);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      hasFirstChunk = true;
      window.clearTimeout(inactivityTimer);
      inactivityTimer = window.setTimeout(() => controller.abort(), 45000);
      console.log(`${DEBUG_TAG} requestStream:chunk`, { bytes: value?.byteLength ?? 0 });
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
          console.log(`${DEBUG_TAG} requestStream:delta`, {
            deltaLength: delta.length,
            fullLength: fullContent.length,
          });
          onChunk(delta, fullContent);
        } catch {
          continue;
        }
      }
    }
    console.log(`${DEBUG_TAG} requestStream:done`, { fullLength: fullContent.length });
  } catch (error) {
    const isAbort = (error as Error).name === 'AbortError';
    if (isAbort) {
      const reason = hasFirstChunk ? '流式数据长时间无更新' : '等待响应超时/首包超时';
      console.warn(`${DEBUG_TAG} requestStream:timeout`, { timeout });
      throw new Error(`${reason}（>${Math.floor(timeout / 1000)}秒）`);
    }
    console.error(`${DEBUG_TAG} requestStream:error`, error);
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    window.clearTimeout(inactivityTimer);
    try {
      reader.releaseLock();
    } catch {
      // noop
    }
  }

  return fullContent;
};

type AiChatTabProps = {
  mergedImages?: MergedImage[];
  onOneClickRecognize?: () => void;
  oneClickProgress?: {
    isLoading: boolean;
    progress: number;
    message: string;
  };
};

type ChatTaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'canceled';

type ChatTask = {
  id: string;
  input: string;
  systemPrompt: string;
  status: ChatTaskStatus;
  output: string;
  error: string;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
};

const MAX_CONCURRENT_TASKS = 3;
const DEBUG_TAG = '[AiChatTab]';

const AiChatTab: React.FC<AiChatTabProps> = ({ 
  mergedImages = [], 
  onOneClickRecognize,
  oneClickProgress = { isLoading: false, progress: 0, message: '' }
}) => {
  const [apiUrl, setApiUrl] = useState(localStorage.getItem(STORAGE_KEYS.apiUrl) || '');
  const [apiKey, setApiKey] = useState(localStorage.getItem(STORAGE_KEYS.apiKey) || '');
  const [model, setModel] = useState(localStorage.getItem(STORAGE_KEYS.model) || '');
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isTestingModel, setIsTestingModel] = useState(false);

  const [inputText, setInputText] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(
    localStorage.getItem(STORAGE_KEYS.systemPrompt) || '',
  );
  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState(
    localStorage.getItem(STORAGE_KEYS.defaultSystemPrompt) || BUILTIN_DEFAULT_SYSTEM_PROMPT,
  );
  const [isDefaultPromptOpen, setIsDefaultPromptOpen] = useState(false);

  const [inputTasks, setInputTasks] = useState<ChatTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const startingTaskIdsRef = useRef<Set<string>>(new Set());
  const taskAbortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const tasksRef = useRef<ChatTask[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _abortRef = useRef<AbortController | null>(null);

  const hasConfig = useMemo(() => !!apiUrl && !!apiKey && !!model, [apiKey, apiUrl, model]);

  const persistConfig = (next: { apiUrl?: string; apiKey?: string; model?: string }) => {
    if (next.apiUrl !== undefined) localStorage.setItem(STORAGE_KEYS.apiUrl, next.apiUrl);
    if (next.apiKey !== undefined) localStorage.setItem(STORAGE_KEYS.apiKey, next.apiKey);
    if (next.model !== undefined) localStorage.setItem(STORAGE_KEYS.model, next.model);
  };

  const fetchModels = useCallback(async () => {
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
  }, [apiKey, apiUrl, model]);

  useEffect(() => {
    if (!apiUrl || !apiKey) return;
    void fetchModels();
  }, [apiKey, apiUrl, fetchModels]);

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

  const runningCount = useMemo(
    () => inputTasks.filter((task) => task.status === 'running').length,
    [inputTasks],
  );
  const pendingCount = useMemo(
    () => inputTasks.filter((task) => task.status === 'pending').length,
    [inputTasks],
  );
  const isSending = runningCount > 0;
  const activeTask = useMemo(
    () => inputTasks.find((task) => task.id === activeTaskId) || null,
    [inputTasks, activeTaskId],
  );
  useEffect(() => {
    tasksRef.current = inputTasks;
  }, [inputTasks]);

  const runTask = useCallback(
    async (taskId: string) => {
      const currentTask = tasksRef.current.find((task) => task.id === taskId);
      if (!currentTask || currentTask.status !== 'pending') {
        console.log(`${DEBUG_TAG} task:skip`, { taskId, reason: 'not-pending-or-not-found' });
        startingTaskIdsRef.current.delete(taskId);
        return;
      }
      const taskSnapshot: ChatTask = {
        ...currentTask,
        status: 'running',
        startedAt: Date.now(),
        error: '',
      };
      setInputTasks((prev) =>
        prev.map((task) => {
          if (task.id !== taskId || task.status !== 'pending') return task;
          return taskSnapshot;
        }),
      );
      console.log(`${DEBUG_TAG} task:start`, {
        taskId,
        inputLength: taskSnapshot.input.length,
        hasSystemPrompt: !!taskSnapshot.systemPrompt.trim(),
      });

      const messages: Array<{ role: string; content: string }> = [];
      if (taskSnapshot.systemPrompt.trim()) {
        messages.push({ role: 'system', content: taskSnapshot.systemPrompt.trim() });
      }
      messages.push({ role: 'user', content: taskSnapshot.input.trim() });
      const taskController = new AbortController();
      taskAbortControllersRef.current.set(taskId, taskController);

      try {
        const endpoint = normalizeEndpoint(apiUrl);
        await requestStream(
          endpoint,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages, stream: true }),
            timeout: 120000,
            signal: taskController.signal,
          },
          (_, current) => {
            setInputTasks((prev) =>
              prev.map((task) => (task.id === taskId ? { ...task, output: current } : task)),
            );
          },
        );
        console.log(`${DEBUG_TAG} task:success`, { taskId });
        setInputTasks((prev) =>
          prev.map((task) =>
            task.id === taskId ? { ...task, status: 'success', endedAt: Date.now() } : task,
          ),
        );
      } catch (error) {
        const canceled = taskController.signal.aborted;
        console.error(`${DEBUG_TAG} task:failed`, { taskId, error });
        setInputTasks((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  status: canceled ? 'canceled' : 'failed',
                  error: canceled ? '已手动终止' : `错误: ${(error as Error).message}`,
                  endedAt: Date.now(),
                }
              : task,
          ),
        );
      } finally {
        console.log(`${DEBUG_TAG} task:finally`, { taskId });
        taskAbortControllersRef.current.delete(taskId);
        startingTaskIdsRef.current.delete(taskId);
      }
    },
    [apiKey, apiUrl, model],
  );

  useEffect(() => {
    const availableSlots = MAX_CONCURRENT_TASKS - runningCount;
    if (availableSlots <= 0) return;
    const pendingTasks = [...inputTasks]
      .filter((task) => task.status === 'pending')
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, availableSlots);
    if (pendingTasks.length > 0) {
      console.log(`${DEBUG_TAG} scheduler:dispatch`, {
        runningCount,
        pendingCount: inputTasks.filter((task) => task.status === 'pending').length,
        dispatchCount: pendingTasks.length,
        taskIds: pendingTasks.map((task) => task.id),
      });
    }

    pendingTasks.forEach((task) => {
      if (startingTaskIdsRef.current.has(task.id)) return;
      startingTaskIdsRef.current.add(task.id);
      void runTask(task.id);
    });
  }, [inputTasks, runTask, runningCount]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    if (!hasConfig) {
      setInputTasks((prev) => {
        if (!activeTaskId) return prev;
        return prev.map((task) =>
          task.id === activeTaskId ? { ...task, error: '请先配置API信息' } : task,
        );
      });
      return;
    }
    const task: ChatTask = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      input: inputText.trim(),
      systemPrompt,
      status: 'pending',
      output: '',
      error: '',
      createdAt: Date.now(),
    };
    console.log(`${DEBUG_TAG} task:enqueue`, {
      taskId: task.id,
      inputLength: task.input.length,
      runningCount,
      pendingCount,
    });
    setInputTasks((prev) => [task, ...prev]);
    setActiveTaskId(task.id);
    setInputText('');
  };

  const handleClear = () => {
    setInputText('');
    if (!activeTaskId) return;
    setInputTasks((prev) =>
      prev.map((task) =>
        task.id === activeTaskId ? { ...task, output: '', error: '' } : task,
      ),
    );
  };

  const handleCopyOutput = () => {
    if (activeTask?.output) void navigator.clipboard.writeText(activeTask.output);
  };

  const handleCancelTask = (taskId: string) => {
    const task = tasksRef.current.find((item) => item.id === taskId);
    if (!task) return;
    if (task.status === 'pending') {
      setInputTasks((prev) =>
        prev.map((item) =>
          item.id === taskId
            ? { ...item, status: 'canceled', error: '已手动终止', endedAt: Date.now() }
            : item,
        ),
      );
      startingTaskIdsRef.current.delete(taskId);
      return;
    }
    const controller = taskAbortControllersRef.current.get(taskId);
    if (controller) controller.abort();
  };

  const handleDeleteTask = (taskId: string) => {
    const task = tasksRef.current.find((item) => item.id === taskId);
    if (!task) return;
    if (task.status === 'running') return;
    setInputTasks((prev) => prev.filter((item) => item.id !== taskId));
    if (activeTaskId === taskId) {
      const next = tasksRef.current.find((item) => item.id !== taskId);
      setActiveTaskId(next?.id || null);
    }
  };

  const handleInjectDefaultPrompt = () => {
    setSystemPrompt(defaultSystemPrompt);
    localStorage.setItem(STORAGE_KEYS.systemPrompt, defaultSystemPrompt);
  };

  // ── 拼接图片 OCR ──────────────────────────────────────────────────────────
  const [mergedOcrLoading, setMergedOcrLoading] = useState(false);
  const [mergedOcrText, setMergedOcrText] = useState('');
  const [mergedOcrStatus, setMergedOcrStatus] = useState('');
  const [mergedOcrProgress, setMergedOcrProgress] = useState({ progress: 0, message: '', error: '' });
  const [ocrDebugRuns, setOcrDebugRuns] = useState<OcrDebugRun[]>([]);
  const [expandedRuns, setExpandedRuns] = useState<Record<number, boolean>>({});
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [settingsPanelSection, setSettingsPanelSection] = useState<'api' | 'baimiao'>('api');

  const requestJson = useCallback(async (url: string, options: RequestInit = {}) => {
    const response = await fetch(resolveBackendUrl(url), options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((payload as any).error || `Request failed: ${response.status}`);
    }
    return payload as any;
  }, []);

  const postJson = useCallback(async (url: string, body: unknown) => {
    const response = await fetch(resolveBackendUrl(url), {
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
    try {
      const payload = await requestJson('/api/baimiao/config');
      const summary = (payload.baimiao ?? {}) as BaimiaoSummary;
      const accounts = summary.accounts ?? [];
      if (accounts.length === 0) {
        const message = '请先配置白描账号，未配置账号时不能使用一键 OCR';
        setMergedOcrStatus(message);
        setMergedOcrProgress({ progress: 0, message: '', error: message });
        setSettingsPanelSection('baimiao');
        setIsSettingsPanelOpen(true);
        window.alert(message);
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '白描账号配置检查失败';
      setMergedOcrStatus(`错误：${message}`);
      setMergedOcrProgress({ progress: 0, message: '', error: message });
      return;
    }
    setMergedOcrLoading(true);
    setMergedOcrStatus('');
    setMergedOcrProgress({ progress: 0, message: '准备识别...', error: '' });
    
    const debugSteps: string[] = [];
    const startTime = new Date();
    const formatTime = (date: Date) => date.toLocaleTimeString('zh-CN', { hour12: false });
    
    const orderedMergedImages = [...mergedImages].sort((a, b) => {
      const orderA = getMergedImageOrder(a.filename);
      const orderB = getMergedImageOrder(b.filename);
      if (orderA !== orderB) return orderA - orderB;
      return a.filename.localeCompare(b.filename, 'zh-CN');
    });

    debugSteps.push(`[${formatTime(new Date())}] 开始OCR识别，共 ${orderedMergedImages.length} 张图片`);
    debugSteps.push(`[${formatTime(new Date())}] 已按文件名排序，确保识别顺序与拼接图顺序一致`);
    
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

      setMergedOcrProgress({ progress: 0, message: '正在准备识别图片 0/0...', error: '' });
      debugSteps.push(`[${formatTime(new Date())}] 正在转换 ${orderedMergedImages.length} 张图片为Base64格式`);
      
      const images = await Promise.all(
        orderedMergedImages.map(async (img, idx) => {
          const base64 = await toBase64(img.url);
          setMergedOcrProgress({
            progress: 0,
            message: `正在准备识别图片 ${idx + 1}/${orderedMergedImages.length}...`,
            error: '',
          });
          return {
            filename: img.filename,
            image_base64: base64,
          };
        })
      );
      
      debugSteps.push(`[${formatTime(new Date())}] 图片转换完成`);
      const batches = chunkArray(images, 20);
      const allResults: Array<{ ok?: boolean; text?: string; error?: string }> = [];
      let recognizedCount = 0;
      debugSteps.push(
        `[${formatTime(new Date())}] 发送OCR请求到服务器（分 ${batches.length} 批，每批最多 20 张）`,
      );

      for (let i = 0; i < batches.length; i += 1) {
        const batch = batches[i];
        setMergedOcrProgress({
          progress:
            images.length > 0 ? Math.floor((recognizedCount / images.length) * 100) : 0,
          message: `正在识别图片 ${recognizedCount}/${images.length}（第 ${i + 1}/${batches.length} 批）...`,
          error: '',
        });

        const payload = await postJson('/api/baimiao/debug-ocr', {
          images: batch.map((item) => ({ image_base64: item.image_base64 })),
        });
        const results = (payload.results ?? []) as Array<{ ok?: boolean; text?: string; error?: string }>;
        allResults.push(...results);
        recognizedCount += batch.length;
        setMergedOcrProgress({
          progress:
            images.length > 0 ? Math.floor((recognizedCount / images.length) * 100) : 0,
          message: `已识别图片 ${recognizedCount}/${images.length}`,
          error: '',
        });
        debugSteps.push(
          `[${formatTime(new Date())}] 第 ${i + 1}/${batches.length} 批完成（${results.length} 条结果）`,
        );
      }
      
      const results = allResults;
      const successCount = results.filter((item) => item.ok).length;
      const failCount = results.length - successCount;
      
      debugSteps.push(`[${formatTime(new Date())}] 识别完成：成功 ${successCount} 张，失败 ${failCount} 张`);
      
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
      
      debugSteps.push(`[${formatTime(new Date())}] 文本处理完成，共 ${mergedText.length} 字符`);
      
      setMergedOcrProgress({ progress: 100, message: '完成！', error: '' });
      setMergedOcrText(mergedText);
      setMergedOcrStatus(`拼接图 OCR 完成：成功 ${successCount}/${results.length}`);
      
      // 添加调试记录
      const debugRun: OcrDebugRun = {
        at: formatTime(startTime),
        account: '拼接图OCR',
        imageCount: orderedMergedImages.length,
        mode: 'batch',
        ok: true,
        message: `成功 ${successCount}/${results.length}`,
        steps: debugSteps,
      };
      setOcrDebugRuns((prev) => [debugRun, ...prev]);
      
      setTimeout(() => {
        setMergedOcrProgress({ progress: 0, message: '', error: '' });
        setMergedOcrLoading(false);
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      let userFriendlyMessage = errorMessage;
      
      // 处理常见错误
      if (errorMessage.includes('ERR_CONNECTION_RESET') || 
          errorMessage.includes('Failed to fetch') || 
          errorMessage.includes('NetworkError') ||
          errorMessage.includes('fetch')) {
        userFriendlyMessage = 'OCR服务连接失败，请检查后端服务是否正常运行';
      } else if (errorMessage.includes('Request failed')) {
        userFriendlyMessage = 'OCR请求失败，服务器返回错误';
      } else if (errorMessage.includes('读取图片失败')) {
        userFriendlyMessage = '读取图片失败，请检查图片格式';
      }
      
      debugSteps.push(`[${formatTime(new Date())}] 错误：${errorMessage}`);
      
      setMergedOcrStatus(`错误：${userFriendlyMessage}`);
      setMergedOcrProgress({ progress: 0, message: '', error: userFriendlyMessage });
      
      // 添加失败的调试记录
      const debugRun: OcrDebugRun = {
        at: formatTime(startTime),
        account: '拼接图OCR',
        imageCount: orderedMergedImages.length,
        mode: 'batch',
        ok: false,
        message: '识别失败',
        steps: debugSteps,
      };
      setOcrDebugRuns((prev) => [debugRun, ...prev]);
      
      // 不自动关闭，等待用户手动关闭
    }
  };

  const copyMergedOcrText = async () => {
    if (!mergedOcrText) return;
    await navigator.clipboard.writeText(mergedOcrText);
    setMergedOcrStatus('已复制');
  };
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col gap-3">
      
      {/* ── 进度条覆盖层 ── */}
      {(oneClickProgress.isLoading || mergedOcrLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-gray-200/60 bg-white shadow-2xl overflow-hidden">
            {/* 头部 */}
            <div className="px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">
                  {oneClickProgress.isLoading ? '一键拼接进行中' : '一键OCR进行中'}
                </h3>
                <div className="flex items-center gap-3">
                  {!mergedOcrProgress.error && (
                    <span className="text-sm font-medium text-indigo-600">
                      {oneClickProgress.isLoading ? oneClickProgress.progress : mergedOcrProgress.progress}%
                    </span>
                  )}
                  {/* 关闭按钮 - 只在出错时显示 */}
                  {mergedOcrProgress.error && (
                    <button
                      type="button"
                      onClick={() => {
                        setMergedOcrProgress({ progress: 0, message: '', error: '' });
                        setMergedOcrLoading(false);
                      }}
                      className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* 错误显示 */}
              {mergedOcrProgress.error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <svg className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span className="font-medium text-red-800">操作失败</span>
                  </div>
                  <p className="text-sm text-red-700 mb-3">{mergedOcrProgress.error}</p>
                  
                  {/* 显示调试信息 */}
                  {ocrDebugRuns.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-red-200">
                      <OcrDebugRunsPanel
                        runs={ocrDebugRuns}
                        expandedRuns={expandedRuns}
                        setExpandedRuns={setExpandedRuns}
                        onClear={() => setOcrDebugRuns([])}
                        accountLabel="拼接图OCR"
                        imageCount={mergedImages.length}
                        isBatch={true}
                      />
                    </div>
                  )}
                  
                  {/* 关闭按钮 */}
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setMergedOcrProgress({ progress: 0, message: '', error: '' });
                        setMergedOcrLoading(false);
                      }}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700"
                    >
                      关闭
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* 进度条 */}
                  <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-300 ease-out"
                      style={{ 
                        width: `${oneClickProgress.isLoading ? oneClickProgress.progress : mergedOcrProgress.progress}%` 
                      }}
                    />
                  </div>
                  
                  {/* 状态消息 */}
                  <p className="text-sm text-gray-600 mb-4">
                    {oneClickProgress.isLoading ? oneClickProgress.message : mergedOcrProgress.message}
                  </p>
                  
                  {/* 加载动画 */}
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                    <span className="text-xs text-gray-500">请勿切换标签页...</span>
                  </div>

                  {/* OCR调试结果 - 只在OCR时显示 */}
                  {!oneClickProgress.isLoading && ocrDebugRuns.length > 0 && (
                    <div className="mt-4">
                      <OcrDebugRunsPanel
                        runs={ocrDebugRuns}
                        expandedRuns={expandedRuns}
                        setExpandedRuns={setExpandedRuns}
                        onClear={() => setOcrDebugRuns([])}
                        accountLabel="拼接图OCR"
                        imageCount={mergedImages.length}
                        isBatch={true}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 三栏主区域 ── */}
      <div className="grid min-h-[560px] shrink-0 grid-cols-3 gap-3">

        {/* 列一：拼接图片 OCR */}
        <div className="flex min-h-0 flex-col rounded-xl border border-gray-200/60 bg-white shadow-sm">
          {/* 卡片体 */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOneClickRecognize}
                disabled={!onOneClickRecognize || oneClickProgress.isLoading || mergedOcrLoading}
                title="先合并分组，再按默认参数拼接所有图片"
                className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {oneClickProgress.isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    拼接中...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    一键拼接
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => void runMergedImagesOcr()}
                disabled={mergedImages.length === 0 || mergedOcrLoading || oneClickProgress.isLoading}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mergedOcrLoading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <ScanText className="h-3.5 w-3.5" />}
                {mergedOcrLoading ? 'OCR 中…' : '一键 OCR'}
              </button>
              <button
                type="button"
                onClick={() => { setSettingsPanelSection('baimiao'); setIsSettingsPanelOpen(true); }}
                title="白描设置"
                aria-label="白描设置"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
              >
                <Settings className="h-3.5 w-3.5" />
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
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleInjectDefaultPrompt}
                  title="注入默认提示词"
                  aria-label="注入默认提示词"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-600 transition-colors hover:border-emerald-300 hover:bg-emerald-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsDefaultPromptOpen(true)}
                  title="调整默认提示词"
                  aria-label="调整默认提示词"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-600 transition-colors hover:border-amber-300 hover:bg-amber-100"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => { setSettingsPanelSection('api'); setIsSettingsPanelOpen(true); }}
                  title="配置 API"
                  aria-label="配置 API"
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 text-xs font-medium text-indigo-600 transition-colors hover:border-indigo-300 hover:bg-indigo-100"
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
                  API 配置
                </button>
              </div>
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
                disabled={!inputText.trim()}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
              >
                {pendingCount > 0 || isSending ? `加入任务（运行中 ${runningCount}/3）` : '发送（Ctrl+Enter）'}
              </button>
            </div>
          </div>
        </div>

        {/* 列三：输出结果 */}
        <div className="flex min-h-0 flex-col rounded-xl border border-gray-200/60 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="text-sm font-semibold text-gray-800">
              输出结果（运行中 {runningCount}/3，排队 {pendingCount}）
            </span>
            <button
              type="button"
              onClick={handleCopyOutput}
              disabled={!activeTask?.output}
              className="inline-flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Copy className="h-3 w-3" />
              复制
            </button>
          </div>
          <div className="border-b border-gray-100 px-3 py-2">
            <div className="max-h-28 overflow-y-auto space-y-1">
              {inputTasks.length === 0 ? (
                <p className="text-xs text-gray-400">暂无任务</p>
              ) : (
                inputTasks.map((task, index) => {
                  const statusText =
                    task.status === 'pending'
                      ? '排队中'
                      : task.status === 'running'
                        ? '运行中'
                        : task.status === 'success'
                          ? '完成'
                          : task.status === 'canceled'
                            ? '已终止'
                            : '失败';
                  const statusClass =
                    task.status === 'pending'
                      ? 'bg-amber-50 text-amber-600 border-amber-200'
                      : task.status === 'running'
                        ? 'bg-blue-50 text-blue-600 border-blue-200'
                      : task.status === 'success'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : task.status === 'canceled'
                            ? 'bg-gray-100 text-gray-600 border-gray-200'
                            : 'bg-red-50 text-red-600 border-red-200';
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setActiveTaskId(task.id)}
                      className={`flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left transition-colors ${
                        activeTaskId === task.id
                          ? 'border-indigo-300 bg-indigo-50/60'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span className="truncate pr-2 text-xs text-gray-700">
                        任务 {getTaskTimeCode(task.createdAt)}
                      </span>
                      <div className="flex items-center gap-1">
                        {task.status === 'running' || task.status === 'pending' ? (
                          <button
                            type="button"
                            title="终止任务"
                            aria-label="终止任务"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelTask(task.id);
                            }}
                            className="rounded border border-red-200 bg-red-50 p-1 text-red-500 hover:bg-red-100"
                          >
                            <StopCircle className="h-3 w-3" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="删除任务"
                            aria-label="删除任务"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTask(task.id);
                            }}
                            className="rounded border border-gray-200 bg-gray-50 p-1 text-gray-500 hover:bg-gray-100"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] ${statusClass}`}>
                          {statusText}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-3">
            {activeTask?.error ? (
              <div className="flex-1 overflow-y-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600 whitespace-pre-wrap break-words">
                {activeTask.error}
              </div>
            ) : (
              <textarea
                className="min-h-0 flex-1 w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-200"
                placeholder={
                  activeTask?.status === 'running'
                    ? '正在生成...'
                    : activeTask
                      ? '该任务处理结果将显示在这里...'
                      : '处理结果将显示在这里...'
                }
                value={activeTask?.output || ''}
                onChange={(e) => {
                  if (!activeTaskId) return;
                  const nextValue = e.target.value;
                  setInputTasks((prev) =>
                    prev.map((task) =>
                      task.id === activeTaskId ? { ...task, output: nextValue } : task,
                    ),
                  );
                }}
                readOnly={activeTask?.status === 'running'}
              />
            )}
          </div>
        </div>

      </div>
      {/* ── 设置侧边栏 ── */}
      {/* 遮罩层 */}
      {isSettingsPanelOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setIsSettingsPanelOpen(false)}
        />
      )}
      {/* 侧边栏主体 */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-96 bg-white shadow-2xl border-l border-gray-200 flex flex-col transition-transform duration-300 ease-in-out ${
          isSettingsPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* 侧边栏头部 */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-indigo-600" />
            <span className="text-sm font-semibold text-gray-800">设置</span>
          </div>
          <button
            type="button"
            onClick={() => setIsSettingsPanelOpen(false)}
            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-gray-100 shrink-0">
          <button
            type="button"
            onClick={() => setSettingsPanelSection('api')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              settingsPanelSection === 'api'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            API 配置
          </button>
          <button
            type="button"
            onClick={() => setSettingsPanelSection('baimiao')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              settingsPanelSection === 'baimiao'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            白描配置
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto">
          {/* API 配置区块 */}
          {settingsPanelSection === 'api' && (
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
                  {model && !models.includes(model) && (
                    <option value={model}>{model}（上次选择）</option>
                  )}
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
          )}

          {/* 白描配置区块 */}
          {settingsPanelSection === 'baimiao' && (
            <BaimiaoConfigModal
              open={true}
              onClose={() => setIsSettingsPanelOpen(false)}
              inline={true}
            />
          )}
        </div>
      </div>

      {/* ── 默认提示词弹窗 ── */}
      {isDefaultPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-2xl rounded-xl border border-gray-200/60 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <p className="text-sm font-semibold text-gray-800">默认提示词</p>
              <button
                type="button"
                onClick={() => setIsDefaultPromptOpen(false)}
                className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="px-5 py-4">
              <textarea
                className="min-h-[200px] w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-200"
                placeholder="在此编辑默认提示词..."
                value={defaultSystemPrompt}
                onChange={(e) => setDefaultSystemPrompt(e.target.value)}
              />
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem(STORAGE_KEYS.defaultSystemPrompt, defaultSystemPrompt);
                    setIsDefaultPromptOpen(false);
                  }}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDefaultSystemPrompt(BUILTIN_DEFAULT_SYSTEM_PROMPT);
                    localStorage.setItem(STORAGE_KEYS.defaultSystemPrompt, BUILTIN_DEFAULT_SYSTEM_PROMPT);
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  恢复内置默认
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AiChatTab;
