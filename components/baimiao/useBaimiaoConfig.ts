import { useCallback, useEffect, useState } from 'react';
import { resolveBackendUrl } from '../../utils/runtimeConfig';
import { BaimiaoSummary, EMPTY_BAIMIAO_SUMMARY } from './types';

const BAIMIAO_CONFIG_SYNC_EVENT = 'baimiao-config-sync';

const normalizeSummary = (summary: Partial<BaimiaoSummary> | null | undefined): BaimiaoSummary => ({
  accounts: summary?.accounts ?? [],
  selectedAccountId: summary?.selectedAccountId ?? '',
  selectedAccount: summary?.selectedAccount ?? null,
});

const emitConfigSync = (summary: BaimiaoSummary) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<BaimiaoSummary>(BAIMIAO_CONFIG_SYNC_EVENT, { detail: summary }));
};

export const useBaimiaoConfig = (enabled = true) => {
  const [baimiao, setBaimiao] = useState<BaimiaoSummary>(EMPTY_BAIMIAO_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const requestJson = useCallback(async (url: string, options: RequestInit = {}) => {
    const response = await fetch(resolveBackendUrl(url), options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((payload as any).error || `Request failed: ${response.status}`);
    }
    return payload as any;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await requestJson('/api/baimiao/config');
      const next = normalizeSummary(payload.baimiao);
      setBaimiao(next);
      emitConfigSync(next);
      return next;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [requestJson]);

  const saveAccount = useCallback(
    async (username: string, password: string) => {
      setLoading(true);
      setError('');
      try {
        const payload = await requestJson('/api/baimiao/accounts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username: username.trim(),
            password,
          }),
        });
        const next = normalizeSummary(payload.baimiao);
        setBaimiao(next);
        emitConfigSync(next);
        return next;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [requestJson],
  );

  const deleteAccount = useCallback(
    async (accountId: string) => {
      setLoading(true);
      setError('');
      try {
        await requestJson(`/api/baimiao/accounts/${accountId}`, { method: 'DELETE' });
        const next = await refresh();
        return next;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [refresh, requestJson],
  );

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSync = (event: Event) => {
      const next = normalizeSummary((event as CustomEvent<BaimiaoSummary>).detail);
      setBaimiao(next);
      setError('');
    };

    window.addEventListener(BAIMIAO_CONFIG_SYNC_EVENT, handleSync);
    return () => window.removeEventListener(BAIMIAO_CONFIG_SYNC_EVENT, handleSync);
  }, []);

  return {
    baimiao,
    loading,
    error,
    setError,
    refresh,
    saveAccount,
    deleteAccount,
  };
};
