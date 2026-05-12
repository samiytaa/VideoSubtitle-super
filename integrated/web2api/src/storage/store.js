import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { config } from "../config.js";
import { SINGLE_OWNER_ID } from "../services/owner-service.js";

function defaultState() {
  return {
    accounts: [],
    apiKeys: [],
    baimiao: {
      accounts: [],
      apiKeys: [],
      selectedAccountId: ""
    },
    incognito: {
      globalEnabled: false,
      owners: {}
    },
    invites: [],
    registration: {
      inviteRequired: false
    },
    sessions: [],
    sharedAccountMode: {
      enabled: false
    },
    users: []
  };
}

function normalizeIncognito(value) {
  const owners = value?.owners;

  return {
    globalEnabled: Boolean(value?.globalEnabled),
    owners: owners && typeof owners === "object" ? owners : {}
  };
}

function normalizeInvites(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeRegistration(value) {
  return {
    inviteRequired: Boolean(value?.inviteRequired)
  };
}

function normalizeSharedAccountMode(value, incognito, accounts) {
  const hasUsableAccount = accounts.some((account) => account?.id && account?.token);

  return {
    enabled: Boolean(value?.enabled && incognito.globalEnabled && hasUsableAccount)
  };
}

function normalizeUsers(value) {
  const normalizeLimit = (limit) => {
    const parsed = Number(limit);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  };

  return Array.isArray(value) ? value.map((user) => ({
    ...user,
    disabled: Boolean(user?.disabled),
    requestLimits: {
      maxConcurrency: normalizeLimit(user?.requestLimits?.maxConcurrency),
      maxRequestsPerMinute: normalizeLimit(user?.requestLimits?.maxRequestsPerMinute)
    }
  })) : [];
}

function normalizeBaimiao(value) {
  const legacyUsername = typeof value?.username === "string" ? value.username : "";
  const legacyPassword = typeof value?.password === "string" ? value.password : "";
  const legacyApiKey = typeof value?.apiKey === "string" ? value.apiKey : "";
  const legacyLoginToken = typeof value?.loginToken === "string" ? value.loginToken : "";
  const legacyUuid = typeof value?.uuid === "string" ? value.uuid : "";
  const normalizedAccounts = Array.isArray(value?.accounts)
    ? value.accounts
        .filter((account) => account && typeof account === "object")
        .map((account) => ({
          id: typeof account.id === "string" ? account.id : "",
          username: typeof account.username === "string" ? account.username : "",
          password: typeof account.password === "string" ? account.password : "",
          displayName: typeof account.displayName === "string" ? account.displayName : "",
          mobileMasked: typeof account.mobileMasked === "string" ? account.mobileMasked : "",
          loginToken: typeof account.loginToken === "string" ? account.loginToken : "",
          uuid: typeof account.uuid === "string" ? account.uuid : "",
          createdAt: typeof account.createdAt === "string" ? account.createdAt : "",
          updatedAt: typeof account.updatedAt === "string" ? account.updatedAt : ""
        }))
        .filter((account) => account.id && account.username)
    : [];
  const normalizedApiKeys = Array.isArray(value?.apiKeys)
    ? value.apiKeys
        .filter((record) => record && typeof record === "object")
        .map((record) => ({
          id: typeof record.id === "string" ? record.id : "",
          accountId: typeof record.accountId === "string" ? record.accountId : "",
          label: typeof record.label === "string" ? record.label : "",
          key: typeof record.key === "string" ? record.key : "",
          keyHash: typeof record.keyHash === "string" ? record.keyHash : "",
          preview: typeof record.preview === "string" ? record.preview : "",
          createdAt: typeof record.createdAt === "string" ? record.createdAt : ""
        }))
        .filter((record) => record.id && record.accountId && record.key && record.keyHash)
    : [];

  if (!normalizedAccounts.length && (legacyUsername || legacyPassword || legacyApiKey)) {
    const legacyAccountId = "legacy-baimiao-account";
    normalizedAccounts.push({
      id: legacyAccountId,
      username: legacyUsername,
      password: legacyPassword,
      displayName: legacyUsername,
      mobileMasked: "",
      loginToken: legacyLoginToken,
      uuid: legacyUuid,
      createdAt: "",
      updatedAt: ""
    });

    if (legacyApiKey) {
      normalizedApiKeys.push({
        id: "legacy-baimiao-key",
        accountId: legacyAccountId,
        label: legacyUsername || "Baimiao",
        key: legacyApiKey,
        keyHash: "",
        preview: legacyApiKey ? `${legacyApiKey.slice(0, 8)}...${legacyApiKey.slice(-4)}` : "",
        createdAt: ""
      });
    }
  }

  const validAccountIds = new Set(normalizedAccounts.map((account) => account.id));
  const apiKeys = normalizedApiKeys.filter((record) => validAccountIds.has(record.accountId));
  const selectedAccountId = typeof value?.selectedAccountId === "string" ? value.selectedAccountId : "";

  return {
    accounts: normalizedAccounts,
    apiKeys,
    selectedAccountId: validAccountIds.has(selectedAccountId)
      ? selectedAccountId
      : (normalizedAccounts[0]?.id || "")
  };
}

function normalizeApiKeys(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((record) => ({
    ...record,
    ownerId: SINGLE_OWNER_ID,
    toolCallsEnabled: Boolean(record?.toolCallsEnabled)
  }));
}

function normalizeAccounts(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((account) => ({
    ...account,
    ownerId: SINGLE_OWNER_ID
  }));
}

function normalizeState(value) {
  const incognito = normalizeIncognito(value?.incognito);
  const accounts = normalizeAccounts(value?.accounts);

  return {
    accounts,
    apiKeys: normalizeApiKeys(value?.apiKeys),
    baimiao: normalizeBaimiao(value?.baimiao),
    incognito,
    invites: [],
    registration: normalizeRegistration({ inviteRequired: false }),
    sessions: [],
    sharedAccountMode: normalizeSharedAccountMode(value?.sharedAccountMode, incognito, accounts),
    users: []
  };
}

export function readStore() {
  if (!existsSync(config.dataFile)) {
    const state = defaultState();
    writeStore(state);
    return state;
  }

  const raw = readFileSync(config.dataFile, "utf8");
  return normalizeState(JSON.parse(raw));
}

export function writeStore(state) {
  writeFileSync(config.dataFile, JSON.stringify(normalizeState(state), null, 2));
}

export function updateStore(updater) {
  const current = readStore();
  const next = updater(current);
  writeStore(next);
  return next;
}
