import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Settings, Trash2, User } from 'lucide-react';
import { useBaimiaoConfig } from './useBaimiaoConfig';
import CenteredModal from '../common/CenteredModal';

type BaimiaoConfigModalProps = {
  open: boolean;
  onClose: () => void;
  inline?: boolean;
};

const BaimiaoConfigModal: React.FC<BaimiaoConfigModalProps> = ({ open, onClose, inline = false }) => {
  const {
    baimiao,
    loading,
    error,
    setError,
    saveAccount: persistAccount,
    deleteAccount: removeAccount,
  } = useBaimiaoConfig(open);
  const [status, setStatus] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    username: '',
    password: '',
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      username: baimiao.selectedAccount?.username ?? '',
      password: baimiao.selectedAccount?.password ?? '',
    });
  }, [baimiao.selectedAccount, open]);

  const handleSaveAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setStatus('');
    try {
      await persistAccount(form.username, form.password);
      setStatus('账号已绑定');
      setForm({ username: '', password: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    setError('');
    setStatus('');
    try {
      await removeAccount(accountId);
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
          <form className="flex flex-col gap-3" onSubmit={handleSaveAccount}>
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
                  onClick={() => void handleDeleteAccount(account.id)}
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
    <CenteredModal
      open={open}
      onClose={onClose}
      title="白描配置"
      headerIcon={<Settings className="w-4 h-4 text-indigo-600" />}
    >
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
        <form className="flex flex-col gap-3" onSubmit={handleSaveAccount}>
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
                onClick={() => void handleDeleteAccount(account.id)}
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
    </CenteredModal>
  );
};

export default BaimiaoConfigModal;
