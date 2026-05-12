import { createHash, randomUUID } from "node:crypto";
import { readStore, updateStore } from "../storage/store.js";
import { createApiKey, createId, hashValue } from "../utils/id.js";

function trimValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function maskUsername(username) {
  const value = trimValue(username);
  if (!value) {
    return "";
  }

  if (/^\d{7,}$/.test(value)) {
    return `${value.slice(0, 3)}******${value.slice(-2)}`;
  }

  if (value.length <= 4) {
    return `${value[0]}***`;
  }

  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function sanitizeApiKeyRecord(record) {
  const { keyHash, ...rest } = record;
  return rest;
}

function deterministicUuidFromSeed(seed) {
  const hash = createHash("sha1").update(String(seed)).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32)
  ].join("-");
}

function getStoredBaimiaoState() {
  return readStore().baimiao ?? {
    accounts: [],
    apiKeys: [],
    selectedAccountId: ""
  };
}

export function listBaimiaoAccounts() {
  return getStoredBaimiaoState().accounts;
}

export function listAvailableBaimiaoAccounts() {
  return listBaimiaoAccounts().filter(
    (account) => trimValue(account.username) && trimValue(account.password)
  );
}

export function listBaimiaoApiKeys() {
  return getStoredBaimiaoState().apiKeys.map(sanitizeApiKeyRecord);
}

export function getBaimiaoAccountById(accountId) {
  return listBaimiaoAccounts().find((account) => account.id === accountId) ?? null;
}

export function getSelectedBaimiaoAccountId() {
  const state = getStoredBaimiaoState();
  const accountIds = new Set(state.accounts.map((account) => account.id));
  return accountIds.has(state.selectedAccountId) ? state.selectedAccountId : (state.accounts[0]?.id || "");
}

export function saveBaimiaoAccount({ username, password }) {
  const normalizedUsername = trimValue(username);
  const normalizedPassword = trimValue(password);

  if (!normalizedUsername) {
    throw new Error("Baimiao username is required");
  }

  if (!normalizedPassword) {
    throw new Error("Baimiao password is required");
  }

  let savedAccount = null;

  updateStore((state) => {
    const current = state.baimiao ?? { accounts: [], apiKeys: [], selectedAccountId: "" };
    const existing = current.accounts.find((account) => account.username === normalizedUsername) ?? null;
    const nextAccount = existing
      ? {
          ...existing,
          username: normalizedUsername,
          password: normalizedPassword,
          uuid: trimValue(existing.uuid) || randomUUID(),
          displayName: normalizedUsername,
          mobileMasked: maskUsername(normalizedUsername),
          updatedAt: new Date().toISOString()
        }
      : {
          id: createId(),
          username: normalizedUsername,
          password: normalizedPassword,
          displayName: normalizedUsername,
          mobileMasked: maskUsername(normalizedUsername),
          loginToken: "",
          uuid: randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

    savedAccount = nextAccount;
    return {
      ...state,
      baimiao: {
        accounts: existing
          ? current.accounts.map((account) => (account.id === nextAccount.id ? nextAccount : account))
          : [...current.accounts, nextAccount],
        apiKeys: current.apiKeys,
        selectedAccountId: nextAccount.id
      }
    };
  });

  return savedAccount;
}

export function deleteBaimiaoAccount(accountId) {
  let deleted = null;

  updateStore((state) => {
    const current = state.baimiao ?? { accounts: [], apiKeys: [], selectedAccountId: "" };
    deleted = current.accounts.find((account) => account.id === accountId) ?? null;
    if (!deleted) {
      return state;
    }

    const accounts = current.accounts.filter((account) => account.id !== accountId);
    const apiKeys = current.apiKeys.filter((record) => record.accountId !== accountId);
    const selectedAccountId = current.selectedAccountId === accountId
      ? (accounts[0]?.id || "")
      : current.selectedAccountId;

    return {
      ...state,
      baimiao: {
        accounts,
        apiKeys,
        selectedAccountId
      }
    };
  });

  return deleted;
}

export function setSelectedBaimiaoAccount(accountId) {
  const account = getBaimiaoAccountById(accountId);
  if (!account) {
    throw new Error("Baimiao account not found");
  }

  updateStore((state) => ({
    ...state,
    baimiao: {
      ...(state.baimiao ?? { accounts: [], apiKeys: [] }),
      selectedAccountId: account.id
    }
  }));

  return account;
}

// 每个 API Key 独立维护轮换游标（内存，重启归零）
const baimiaoRotationCursorByKeyId = new Map();

export function takeBaimiaoRoundRobinAccount(apiKeyRecord) {
  const accounts = listAvailableBaimiaoAccounts();
  if (!accounts.length) {
    return null;
  }

  const cursor = baimiaoRotationCursorByKeyId.get(apiKeyRecord.id) ?? 0;
  const index = cursor % accounts.length;
  baimiaoRotationCursorByKeyId.set(apiKeyRecord.id, (index + 1) % accounts.length);

  return accounts[index];
}

export function createBaimiaoApiKeyRecord({ label, plainKey }) {
  const accounts = listBaimiaoAccounts();
  if (!accounts.length) {
    throw new Error("No Baimiao accounts configured");
  }

  const selectedAccountId = getSelectedBaimiaoAccountId();
  const accountId = selectedAccountId || accounts[0].id;
  const key = trimValue(plainKey) || createApiKey();
  const record = {
    id: createId(),
    accountId,
    label: trimValue(label) || "baimiao-key",
    key,
    keyHash: hashValue(key),
    preview: `${key.slice(0, 8)}...${key.slice(-4)}`,
    createdAt: new Date().toISOString()
  };

  updateStore((state) => ({
    ...state,
    baimiao: {
      ...(state.baimiao ?? { accounts: [], apiKeys: [], selectedAccountId: "" }),
      apiKeys: [...(state.baimiao?.apiKeys ?? []), record]
    }
  }));

  return {
    key,
    record: sanitizeApiKeyRecord(record)
  };
}

export function deleteBaimiaoApiKeyRecord(keyId) {
  updateStore((state) => ({
    ...state,
    baimiao: {
      ...(state.baimiao ?? { accounts: [], apiKeys: [], selectedAccountId: "" }),
      apiKeys: (state.baimiao?.apiKeys ?? []).filter((record) => record.id !== keyId)
    }
  }));
}

export function getBaimiaoApiKeyRecord(key) {
  const keyHash = hashValue(trimValue(key));
  return getStoredBaimiaoState().apiKeys.find((record) => record.keyHash === keyHash) ?? null;
}

export function getBaimiaoConfig(accountId = getSelectedBaimiaoAccountId()) {
  const account = getBaimiaoAccountById(accountId);
  if (!account) {
    return null;
  }

  // Keep a stable device id per account, including old records with empty uuid.
  const stableUuid = trimValue(account.uuid) || deterministicUuidFromSeed(account.id || account.username);
  if (!trimValue(account.uuid)) {
    persistBaimiaoSession(account.id, { uuid: stableUuid });
  }

  return {
    accountId: account.id,
    username: trimValue(account.username),
    password: trimValue(account.password),
    uuid: stableUuid,
    loginToken: trimValue(account.loginToken)
  };
}

export function persistBaimiaoSession(accountId, { loginToken, uuid }) {
  updateStore((state) => {
    const current = state.baimiao ?? { accounts: [], apiKeys: [], selectedAccountId: "" };
    return {
      ...state,
      baimiao: {
        ...current,
        accounts: current.accounts.map((account) => {
          if (account.id !== accountId) {
            return account;
          }

          return {
            ...account,
            ...(typeof loginToken === "string" ? { loginToken } : {}),
            ...(typeof uuid === "string" ? { uuid } : {}),
            updatedAt: new Date().toISOString()
          };
        })
      }
    };
  });
}

export function getBaimiaoConfigSummary() {
  const selectedAccountId = getSelectedBaimiaoAccountId();
  const selectedAccount = getBaimiaoAccountById(selectedAccountId);

  return {
    accounts: listBaimiaoAccounts().map((account) => ({
      id: account.id,
      username: account.username,
      displayName: account.displayName || account.username,
      mobileMasked: account.mobileMasked || maskUsername(account.username),
      hasPassword: Boolean(account.password),
      hasLoginToken: Boolean(account.loginToken),
      hasUuid: Boolean(account.uuid),
      loginToken: account.loginToken,
      uuid: account.uuid,
      configured: Boolean(account.username && account.password),
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    })),
    apiKeys: listBaimiaoApiKeys(),
    selectedAccountId,
    selectedAccount: selectedAccount
      ? {
          id: selectedAccount.id,
          username: selectedAccount.username,
          password: selectedAccount.password,
          hasPassword: Boolean(selectedAccount.password),
          hasLoginToken: Boolean(selectedAccount.loginToken),
          hasUuid: Boolean(selectedAccount.uuid),
          loginToken: selectedAccount.loginToken,
          uuid: selectedAccount.uuid,
          configured: Boolean(selectedAccount.username && selectedAccount.password)
        }
      : null
  };
}
