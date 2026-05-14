import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Settings, Trash2, User, X } from 'lucide-react';
import { resolveBackendUrl } from '../../utils/runtimeConfig';

type BaimiaoAccount = {
  id: string;
  username: string;
  mobileMasked?: string;
  hasUuid?: boolean;
  hasLoginToken?: boolean;
};

type BaimiaoSummary = {
  accounts: BaimiaoAccount[];
  selectedAccountId: string;
  selectedAccount?: {
    username?: string;
    password?: string;
  } | null;
};

type BaimiaoConfigModalProps = {
  open: boolean;
  onClose: () => void;
  inline?: boolean;
};

const BaimiaoConfigModal: React.FC<BaimiaoConfigModalProps> = ({ open, onClose, inline = false }) => {
  const [baimiao, setBaimiao] = useState<BaimiaoSummary>({
    accounts: [],
    selectedAccountId: '',
  });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    username: '',
    password: '',
  });

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
        body: JSON.stringify(body),
      }),
    [requestJson],
  );

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await requestJson('/api/baimiao/config');
      const summary = (payload.baimiao ?? {}) as BaimiaoSummary;
      setBaimiao({
        accounts: summary.accounts ?? [],
        selectedAccountId: summary.selectedAccountId ?? '',
      });
      setForm((prev) => ({
        ...prev,
        username: summary.selectedAccount?.username ?? '',
        password: summary.selectedAccount?.password ?? '',
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [requestJson]);

  useEffect(() => {
    if (!open) return;
    void loadConfig();
  }, [loadConfig, open]);

  const saveAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setStatus('');
    try {
      const payload = await postJson('/api/baimiao/accounts', {
        username: form.username.trim(),
        password: form.password,
      });
      const next = payload.baimiao as BaimiaoSummary | undefined;
      if (next) {
        setBaimiao({
          accounts: next.accounts ?? [],
          selectedAccountId: next.selectedAccountId ?? '',
        });
      }
      setStatus('账号已绑定');
      setForm({ username: '', password: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const deleteAccount = async (accountId: string) => {
    setError('');
    setStatus('');
    try {
      await requestJson(`/api/baimiao/accounts/${accountId}`, { method: 'DELETE' });
      await loadConfig();
      setStatus('账号已删除');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const accountRows = useMemo(() => baimiao.accounts, [baimiao.accounts]);

  if (!open) return null;

  // inline 模式：直接渲染内容，不包裹弹窗遮罩
  if (inline) {
    return (
      <div className="flex flex-col gap-5 px-5 py-4">
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

        <div>
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-gray-800">绑定账号</h2>
          </div>
          <form className="flex flex-col gap-3" onSubmit={saveAccount}>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">账号</label>
                <input
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500"
                  placeholder="输入白描账号"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">密码</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 pr-10 text-sm text-gray-800 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500"
                    placeholder="输入白描密码"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="h-9 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                绑定账号
              </button>
            </div>
          </form>
        </div>

        <div className="border-t border-gray-100" />

        <div>
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-gray-800">账号列表</h2>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 divide-y divide-gray-200">
            {accountRows.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-400">暂无账号</div>
            )}
            {accountRows.map((account) => (
              <div key={account.id} className="flex items-center gap-2 px-4 py-3 min-w-0">
                <span className="text-sm text-gray-700 font-medium truncate shrink-0 max-w-[90px]">
                  {account.mobileMasked || account.username}
                </span>
                <span
                  className={`inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                    account.hasUuid
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-gray-50 text-gray-400 border-gray-200'
                  }`}
                >
                  UUID {account.hasUuid ? '已缓存' : '未缓存'}
                </span>
                <span
                  className={`inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                    account.hasLoginToken
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-gray-50 text-gray-400 border-gray-200'
                  }`}
                >
                  Token {account.hasLoginToken ? '已缓存' : '未缓存'}
                </span>
                <button
                  type="button"
                  onClick={() => void deleteAccount(account.id)}
                  title="删除账号"
                  aria-label="删除账号"
                  className="ml-auto shrink-0 p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors border border-red-200"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col"
        style={{
          animation: 'baimiaoModalIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-semibold text-gray-800">白描配置</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5 overflow-y-auto max-h-[70vh]">
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

          <div>
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-gray-800">绑定账号</h2>
            </div>
            <form className="flex flex-col gap-3" onSubmit={saveAccount}>
              <div className="flex items-end gap-3">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs font-medium text-gray-600">账号</label>
                  <input
                    value={form.username}
                    onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500"
                    placeholder="输入白描账号"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs font-medium text-gray-600">密码</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                      className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 pr-10 text-sm text-gray-800 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500"
                      placeholder="输入白描密码"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-9 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
                >
                  绑定账号
                </button>
              </div>
            </form>
          </div>

          <div className="border-t border-gray-100" />

          <div>
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-gray-800">账号列表</h2>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 divide-y divide-gray-200">
              {accountRows.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-400">暂无账号</div>
              )}
              {accountRows.map((account) => (
                <div key={account.id} className="flex items-center gap-2 px-4 py-3 min-w-0">
                  <span className="text-sm text-gray-700 font-medium truncate shrink-0 max-w-[90px]">
                    {account.mobileMasked || account.username}
                  </span>
                  <span
                    className={`inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                      account.hasUuid
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-gray-50 text-gray-400 border-gray-200'
                    }`}
                  >
                    UUID {account.hasUuid ? '已缓存' : '未缓存'}
                  </span>
                  <span
                    className={`inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                      account.hasLoginToken
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-gray-50 text-gray-400 border-gray-200'
                    }`}
                  >
                    Token {account.hasLoginToken ? '已缓存' : '未缓存'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void deleteAccount(account.id)}
                    title="删除账号"
                    aria-label="删除账号"
                    className="ml-auto shrink-0 p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors border border-red-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes baimiaoModalIn {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default BaimiaoConfigModal;
