import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Copy, ImageUp, Loader2, Trash2, X, CheckCircle2, ScanText, Settings } from 'lucide-react';
import { MergedImage } from '../types';
import OcrDebugRunsPanel, { OcrDebugRun } from './baimiao/OcrDebugRunsPanel';
import OcrResultPanel from './baimiao/OcrResultPanel';
import BaimiaoConfigModal from './baimiao/BaimiaoConfigModal';
import { useBaimiaoConfig } from './baimiao/useBaimiaoConfig';
import { resolveBackendUrl } from '../utils/runtimeConfig';

const BaimiaoOcrTab: React.FC<{ mergedImages?: MergedImage[]; onOneClickRecognize?: () => void }> = () => {
  const RESULT_STORAGE_KEY = 'baimiao_debug_result';
  const { baimiao } = useBaimiaoConfig(true);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [debug, setDebug] = useState({
    accountId: '',
    imagePreview: '',
    imageBase64: '',
    images: [] as { name: string; preview: string; base64: string }[],
    previewIndex: 0,
    result: '',
    status: '',
    loading: false
  });
  const [debugRuns, setDebugRuns] = useState<OcrDebugRun[]>([]);
  const [expandedRuns, setExpandedRuns] = useState<Record<number, boolean>>({});
  const [showConfigModal, setShowConfigModal] = useState(false);

  const requestJson = useCallback(async (url: string, options: RequestInit = {}) => {
    const response = await fetch(resolveBackendUrl(url), options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((payload as any).error || `Request failed: ${response.status}`);
    }
    return payload as any;
  }, []);

  const postJson = useCallback(
    async (url: string, body: unknown) =>
      requestJson(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      }),
    [requestJson]
  );

  useEffect(() => {
    const cachedResult = localStorage.getItem(RESULT_STORAGE_KEY);
    if (cachedResult) {
      setDebug((prev) => ({ ...prev, result: cachedResult }));
    }
  }, []);

  const copyText = async (text: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setStatus('已复制');
  };

  const onImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? ([] as File[]));
    if (!files.length) return;
    const marker = 'base64,';
    Promise.all(
      files.map(
        (file: File) =>
          new Promise<{ name: string; preview: string; base64: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const dataUrl = String(e.target?.result ?? '');
              resolve({
                name: file.name,
                preview: dataUrl,
                base64: dataUrl.includes(marker) ? dataUrl.split(marker)[1] : dataUrl
              });
            };
            reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'));
            reader.readAsDataURL(file);
          })
      )
    )
      .then((images) => {
        setDebug((prev) => ({
          ...prev,
          images,
          previewIndex: 0,
          imagePreview: images[0]?.preview ?? '',
          imageBase64: images[0]?.base64 ?? ''
        }));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  };

  const runDebugOcr = async () => {
    setDebug((prev) => ({ ...prev, loading: true, status: '', result: '' }));
    setError('');
    const steps: string[] = [];
    const pushStep = (text: string) => {
      const time = new Date().toLocaleTimeString();
      steps.push(`[${time}] ${text}`);
    };
    const resolvedAccountId = debug.accountId || baimiao.selectedAccountId || '';
    const resolvedAccount =
      baimiao.accounts.find((account) => account.id === resolvedAccountId)?.username ||
      (resolvedAccountId ? resolvedAccountId : '默认当前账号');
    const imageCount = Math.max(1, debug.images?.length || (debug.imageBase64 ? 1 : 0));
    const mode: 'single' | 'batch' = (debug.images?.length ?? 0) > 1 ? 'batch' : 'single';
    pushStep(`开始识别，模式=${mode === 'batch' ? '批量' : '单张'}，图片数=${imageCount}`);
    pushStep(`账号策略=${debug.accountId ? `指定账号(${resolvedAccount})` : mode === 'batch' ? '自动多账号分发' : `默认当前账号(${resolvedAccount})`}`);
    try {
      if ((debug.images?.length ?? 0) > 1) {
        const validImages = debug.images.filter((item) => typeof item.base64 === 'string' && item.base64.trim());
        pushStep(`批量参数检查完成：有效图片=${validImages.length}`);
        if (!validImages.length) {
          throw new Error('没有可用图片：image_base64 为空');
        }
        pushStep('提交 /api/baimiao/debug-ocr 批量请求');
        const payload = await postJson('/api/baimiao/debug-ocr', {
          accountId: debug.accountId || undefined,
          images: validImages.map((item) => ({ image_base64: item.base64 }))
        });
        pushStep('服务端批量请求返回，开始整理结果');
        const lines = (payload.results ?? []).map((item: any, index: number) => {
          const imageName = debug.images[index]?.name || `image_${index + 1}`;
          const accountLabel =
            baimiao.accounts.find((account) => account.id === item.accountId)?.username ||
            item.accountId ||
            '默认账号';
          return item.ok
            ? `#${index + 1} ${imageName} [账号: ${accountLabel}]\n${item.text || ''}`
            : `#${index + 1} ${imageName} [账号: ${accountLabel}]\n[识别失败] ${item.error || '未知错误'}`;
        });
        const mergedText = lines.join('\n\n');
        const accountCount = payload.accountCount || (debug.accountId ? 1 : baimiao.accounts.length || 1);
        const maxBatchSize = payload.maxBatchSizePerAccount || 50;

        // 统计每个账号的分发明细：账号 → 图片数量
        const accountDistMap: Record<string, number> = {};
        for (const item of (payload.results ?? [])) {
          const acctId = (item.accountId != null && item.accountId !== '') ? item.accountId : '__default__';
          accountDistMap[acctId] = (accountDistMap[acctId] || 0) + 1;
        }
        // 生成每账号的分发 step，格式：账号X 识别XX张图（第X批）
        const accountEntries = Object.entries(accountDistMap);
        const actualAccountCount = accountEntries.length;
        pushStep(`分发账号数：服务端=${accountCount}，实际参与=${actualAccountCount}`);
        accountEntries.forEach(([acctId, count], acctIdx) => {
          const acctName =
            baimiao.accounts.find((a) => a.id === acctId)?.username ||
            (acctId === '__default__' ? '默认账号' : `未知(${acctId.slice(0, 8)})`);
          const batchCount = Math.ceil(count / maxBatchSize);
          for (let b = 1; b <= batchCount; b++) {
            const batchImgCount = b < batchCount ? maxBatchSize : count - (batchCount - 1) * maxBatchSize;
            pushStep(`账号${acctIdx + 1}(${acctName}) 识别${batchImgCount}张图（第${b}批）`);
          }
        });

        pushStep(`结果汇总完成：成功=${payload.successCount || 0}，总数=${payload.total || debug.images.length}`);
        setDebug((prev) => ({
          ...prev,
          result: mergedText,
          status: `批量识别完成：成功 ${payload.successCount || 0}/${payload.total || debug.images.length}（账号数 ${accountCount}，单账号单批最多 ${maxBatchSize} 张）`,
          loading: false
        }));
        localStorage.setItem(RESULT_STORAGE_KEY, mergedText);
        setDebugRuns([
          {
            at: new Date().toLocaleString(),
            account: debug.accountId
              ? resolvedAccount
              : `自动分发(${accountCount}账号)`,
            imageCount,
            mode,
            ok: true,
            message: `成功 ${payload.successCount || 0}/${payload.total || imageCount}，单账号单批≤${maxBatchSize}`,
            steps
          }
        ]);
      } else {
        pushStep('提交 /api/baimiao/debug-ocr 单图请求');
        const payload = await postJson('/api/baimiao/debug-ocr', {
          accountId: debug.accountId || undefined,
          image_base64: debug.imageBase64
        });
        pushStep(`服务端返回成功，source=${payload.source || 'unknown'}`);
        setDebug((prev) => ({
          ...prev,
          result: payload.text || '',
          status: `识别成功（${payload.source}）`,
          loading: false
        }));
        localStorage.setItem(RESULT_STORAGE_KEY, payload.text || '');
        setDebugRuns([
          {
            at: new Date().toLocaleString(),
            account: resolvedAccount,
            imageCount,
            mode,
            ok: true,
            message: '识别成功',
            steps
          }
        ]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      pushStep(`识别失败：${message}`);
      setError(message);
      setDebug((prev) => ({ ...prev, loading: false }));
      setDebugRuns([
        {
          at: new Date().toLocaleString(),
          account: resolvedAccount,
          imageCount,
          mode,
          ok: false,
          message,
          steps
        }
      ]);
    }
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* 状态提示 */}
      {(status || error) && (
        <div
          className={`rounded-xl px-4 py-2.5 text-sm border ${
            error
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          {error || status}
        </div>
      )}

      <BaimiaoConfigModal open={showConfigModal} onClose={() => setShowConfigModal(false)} />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 p-5">
        <div className="flex items-center gap-2 mb-4">
          <ScanText className="w-4 h-4 text-indigo-600" />
          <h2 className="text-sm font-semibold text-gray-800">OCR 识别调试</h2>
          <button
            onClick={() => setShowConfigModal(true)}
            className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm"
          >
            <Settings className="w-3.5 h-3.5" />
            白描配置
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            {/* 账号模式切换 */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDebug((prev) => ({ ...prev, accountId: '' }))}
                className={`flex-1 h-9 rounded-lg text-sm font-medium transition-colors border ${
                  !debug.accountId
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                自动分发
              </button>
              <div className={`flex-2 relative`}>
                <select
                  value={debug.accountId}
                  onChange={(e) => setDebug((prev) => ({ ...prev, accountId: e.target.value }))}
                  onFocus={() => {
                    if (!debug.accountId && baimiao.accounts.length > 0) {
                      setDebug((prev) => ({ ...prev, accountId: baimiao.accounts[0].id }));
                    }
                  }}
                  className={`h-9 w-full rounded-lg border text-sm text-gray-800 outline-none transition-all px-3 pr-8 appearance-none cursor-pointer ${
                    debug.accountId
                      ? 'border-indigo-500 bg-white ring-2 ring-indigo-200 font-medium'
                      : 'border-gray-300 bg-gray-50 text-gray-400 hover:border-gray-400'
                  }`}
                >
                  {!debug.accountId && <option value="">指定账号 ▾</option>}
                  {baimiao.accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.username}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                  <ChevronDown className={`w-3.5 h-3.5 ${debug.accountId ? 'text-indigo-400' : 'text-gray-400'}`} />
                </div>
              </div>
            </div>
            {debug.images.length > 1 ? (
              /* 多图轮播预览 */
              <div className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden h-56 flex flex-col">
                {/* 图片展示区 */}
                <div className="relative flex-1 overflow-hidden">
                  <img
                    src={debug.images[debug.previewIndex]?.preview}
                    alt={`preview-${debug.previewIndex}`}
                    className="w-full h-full object-contain"
                  />
                  {/* 左箭头 */}
                  <button
                    type="button"
                    onClick={() =>
                      setDebug((prev) => ({
                        ...prev,
                        previewIndex: (prev.previewIndex - 1 + prev.images.length) % prev.images.length
                      }))
                    }
                    className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {/* 右箭头 */}
                  <button
                    type="button"
                    onClick={() =>
                      setDebug((prev) => ({
                        ...prev,
                        previewIndex: (prev.previewIndex + 1) % prev.images.length
                      }))
                    }
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  {/* 删除当前图片 */}
                  <button
                    type="button"
                    onClick={() =>
                      setDebug((prev) => {
                        const next = prev.images.filter((_, i) => i !== prev.previewIndex);
                        const nextIndex = Math.min(prev.previewIndex, next.length - 1);
                        return {
                          ...prev,
                          images: next,
                          previewIndex: nextIndex,
                          imagePreview: next[nextIndex]?.preview ?? '',
                          imageBase64: next[nextIndex]?.base64 ?? ''
                        };
                      })
                    }
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
                    title="删除此图片"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {/* 计数角标 */}
                  <div className="absolute bottom-1.5 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                    {debug.previewIndex + 1} / {debug.images.length}
                  </div>
                  {/* 文件名 */}
                  <div className="absolute bottom-1.5 left-2 max-w-[60%] truncate bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                    {debug.images[debug.previewIndex]?.name}
                  </div>
                </div>
                {/* 缩略图条 */}
                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-100 border-t border-gray-200 overflow-x-auto">
                  {debug.images.map((img, idx) => (
                    <div key={idx} className="relative shrink-0 group">
                      <button
                        type="button"
                        onClick={() => setDebug((prev) => ({ ...prev, previewIndex: idx }))}
                        className={`w-10 h-10 rounded overflow-hidden border-2 transition-colors block ${
                          idx === debug.previewIndex ? 'border-indigo-500' : 'border-transparent hover:border-gray-400'
                        }`}
                      >
                        <img src={img.preview} alt={img.name} className="w-full h-full object-cover" />
                      </button>
                      {/* 缩略图删除按钮 */}
                      <button
                        type="button"
                        onClick={() =>
                          setDebug((prev) => {
                            const next = prev.images.filter((_, i) => i !== idx);
                            const nextIndex = idx < prev.previewIndex
                              ? prev.previewIndex - 1
                              : Math.min(prev.previewIndex, next.length - 1);
                            return {
                              ...prev,
                              images: next,
                              previewIndex: nextIndex,
                              imagePreview: next[nextIndex]?.preview ?? '',
                              imageBase64: next[nextIndex]?.base64 ?? ''
                            };
                          })
                        }
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white items-center justify-center hidden group-hover:flex transition-colors"
                        title="删除"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                  {/* 重新上传按钮 */}
                  <label className="shrink-0 w-10 h-10 rounded border-2 border-dashed border-gray-300 hover:border-indigo-400 cursor-pointer flex items-center justify-center bg-white transition-colors" title="追加图片">
                    <input type="file" accept="image/*" multiple className="hidden" onChange={onImageChange} />
                    <ImageUp className="w-4 h-4 text-gray-400" />
                  </label>
                  {/* 清空全部 */}
                  <button
                    type="button"
                    onClick={() =>
                      setDebug((prev) => ({
                        ...prev,
                        images: [],
                        previewIndex: 0,
                        imagePreview: '',
                        imageBase64: ''
                      }))
                    }
                    className="shrink-0 w-10 h-10 rounded border-2 border-dashed border-red-200 hover:border-red-400 cursor-pointer flex items-center justify-center bg-white transition-colors"
                    title="清空全部图片"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            ) : (
              /* 单图 / 空状态 */
              <div className="relative rounded-lg border border-dashed border-gray-300 bg-gray-50 overflow-hidden h-56">
                <label className="block w-full h-full cursor-pointer hover:border-indigo-400">
                  <input type="file" accept="image/*" multiple className="hidden" onChange={onImageChange} />
                  {debug.imagePreview ? (
                    <img src={debug.imagePreview} alt="preview" className="w-full h-full object-contain" />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                      <ImageUp className="w-7 h-7 mb-2" />
                      <span className="text-sm">上传图片进行识别（会自动按账号分发）</span>
                    </div>
                  )}
                </label>
                {/* 单图删除按钮 */}
                {debug.imagePreview && (
                  <button
                    type="button"
                    onClick={() =>
                      setDebug((prev) => ({
                        ...prev,
                        images: [],
                        previewIndex: 0,
                        imagePreview: '',
                        imageBase64: ''
                      }))
                    }
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
                    title="删除图片"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            {debug.images.length === 1 && (
              <div className="text-xs text-gray-600">已选择 1 张</div>
            )}

            <OcrDebugRunsPanel
              runs={debugRuns}
              expandedRuns={expandedRuns}
              setExpandedRuns={setExpandedRuns}
              onClear={() => setDebugRuns([])}
              accountLabel={
                (debug.images?.length ?? 0) > 1 && !debug.accountId
                  ? `自动分发（${baimiao.accounts.length || 0} 个）`
                  : baimiao.accounts.find((account) => account.id === (debug.accountId || baimiao.selectedAccountId))
                      ?.username || '默认当前账号'
              }
              imageCount={Math.max(1, debug.images?.length || (debug.imageBase64 ? 1 : 0))}
              isBatch={(debug.images?.length ?? 0) > 1}
            />

            {/* 操作按钮区 */}
            <div className="flex items-center gap-2">
              <button
                onClick={runDebugOcr}
                disabled={!debug.imageBase64 || debug.loading}
                className="h-9 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 shadow-sm shadow-indigo-200"
              >
                {debug.loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <ScanText className="w-4 h-4" />
                }
                {debug.loading ? '识别中…' : debug.images.length > 1 ? '开始批量识别' : '开始识别'}
              </button>
              <div className="flex-1" />
              <button
                onClick={() => copyText(debug.result)}
                disabled={!debug.result}
                className="h-9 rounded-lg bg-gray-100 px-3 text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                复制
              </button>
              <button
                onClick={() => {
                  setDebug((prev) => ({ ...prev, result: '', status: '' }));
                  localStorage.removeItem(RESULT_STORAGE_KEY);
                }}
                disabled={!debug.result}
                className="h-9 rounded-lg bg-red-50 px-3 text-sm font-medium text-red-500 hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 border border-red-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
                清除
              </button>
            </div>

            {/* 状态提示 */}
            {debug.status && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="text-xs text-emerald-700">{debug.status}</span>
              </div>
            )}
          </div>
          <OcrResultPanel text={debug.result} />
        </div>
      </div>

    </div>
  );
};

export default BaimiaoOcrTab;
