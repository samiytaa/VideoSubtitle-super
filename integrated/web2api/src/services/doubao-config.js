import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const dataDir = join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

export const doubaoConfig = {
  adminKey: process.env.DOUBAO_ADMIN_KEY || "admin",
  browserPoolSize: parseInt(process.env.DOUBAO_BROWSER_POOL_SIZE || "2", 10),
  maxInflightPerAccount: parseInt(process.env.DOUBAO_MAX_INFLIGHT || "1", 10),
  accountMinIntervalMs: parseInt(process.env.DOUBAO_ACCOUNT_MIN_INTERVAL_MS || "1200", 10),
  requestJitterMinMs: parseInt(process.env.DOUBAO_REQUEST_JITTER_MIN_MS || "120", 10),
  requestJitterMaxMs: parseInt(process.env.DOUBAO_REQUEST_JITTER_MAX_MS || "360", 10),
  rateLimitBaseCooldown: parseInt(process.env.DOUBAO_RATE_LIMIT_BASE_COOLDOWN || "600", 10),
  rateLimitMaxCooldown: parseInt(process.env.DOUBAO_RATE_LIMIT_MAX_COOLDOWN || "3600", 10),
  maxRetries: 2,
  baseUrl: process.env.DOUBAO_BASE_URL || "https://www.doubao.com",
  defaultBotId: process.env.DOUBAO_DEFAULT_BOT_ID || "7338286299411103781",
  defaultFp: process.env.DOUBAO_DEFAULT_FP || "doubao2api_default_fp",
  accountsFile: join(dataDir, "doubao-accounts.json"),
  apiKeysFile: join(dataDir, "doubao-api-keys.json"),
};

export const BOT_MAP = {
  "doubao": "7338286299411103781",
  "doubao-pro": "7338286299411103781",
  "doubao-lite": "7338286299411103781",
  "gpt-4o": "7338286299411103781",
  "gpt-4o-mini": "7338286299411103781",
  "gpt-4-turbo": "7338286299411103781",
  "gpt-4": "7338286299411103781",
  "gpt-4.1": "7338286299411103781",
  "gpt-4.1-mini": "7338286299411103781",
  "gpt-3.5-turbo": "7338286299411103781",
  "gpt-5": "7338286299411103781",
  "o1": "7338286299411103781",
  "o1-mini": "7338286299411103781",
  "o3": "7338286299411103781",
  "o3-mini": "7338286299411103781",
  "claude-opus-4-6": "7338286299411103781",
  "claude-sonnet-4-6": "7338286299411103781",
  "claude-3-5-sonnet": "7338286299411103781",
  "claude-3-opus": "7338286299411103781",
  "claude-3-haiku": "7338286299411103781",
  "gemini-2.5-pro": "7338286299411103781",
  "gemini-1.5-pro": "7338286299411103781",
  "deepseek-chat": "7338286299411103781",
  "deepseek-reasoner": "7338286299411103781",
};

export function resolveBotId(name) {
  if (BOT_MAP[name]) return BOT_MAP[name];
  if (/^\d+$/.test(name)) return name;
  return doubaoConfig.defaultBotId;
}

// ── JSON 文件存储 ──────────────────────────────────────────

export function readJsonFile(filePath, defaultData = []) {
  if (!existsSync(filePath)) {
    writeFileSync(filePath, JSON.stringify(defaultData, null, 2), "utf8");
    return defaultData;
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return defaultData;
  }
}

export function writeJsonFile(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

// ── API Keys ──────────────────────────────────────────────

let _apiKeys = null;

export function loadApiKeys() {
  const data = readJsonFile(doubaoConfig.apiKeysFile, { keys: [] });
  _apiKeys = new Set((data.keys || []).map(k => typeof k === "string" ? k : k.key).filter(Boolean));
  return _apiKeys;
}

export function getApiKeys() {
  if (!_apiKeys) loadApiKeys();
  return _apiKeys;
}

export function saveApiKeys() {
  writeJsonFile(doubaoConfig.apiKeysFile, { keys: [...getApiKeys()] });
}
