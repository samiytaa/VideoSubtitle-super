import { readJsonFile, writeJsonFile, doubaoConfig } from "./doubao-config.js";

function jitterSeconds() {
  const low = Math.max(0, doubaoConfig.requestJitterMinMs);
  const high = Math.max(low, doubaoConfig.requestJitterMaxMs);
  return (Math.random() * (high - low) + low) / 1000;
}

export class DoubaoAccount {
  constructor({ sessionid = "", name = "", status_code = "", last_error = "",
    last_request_started = 0, last_request_finished = 0,
    consecutive_failures = 0, rate_limit_strikes = 0 } = {}) {
    this.sessionid = sessionid;
    this.name = name || (sessionid ? sessionid.slice(0, 8) + "..." : "unknown");
    this.valid = Boolean(sessionid);
    this.lastUsed = 0;
    this.inflight = 0;
    this.rateLimitedUntil = 0;
    this.statusCode = status_code || (this.valid ? "valid" : "invalid");
    this.lastError = last_error || "";
    this.lastRequestStarted = Number(last_request_started) || 0;
    this.lastRequestFinished = Number(last_request_finished) || 0;
    this.consecutiveFailures = Number(consecutive_failures) || 0;
    this.rateLimitStrikes = Number(rate_limit_strikes) || 0;
  }

  isRateLimited() { return this.rateLimitedUntil > Date.now() / 1000; }
  isAvailable() { return this.valid && !this.isRateLimited(); }

  nextAvailableAt() {
    const minInterval = Math.max(0, doubaoConfig.accountMinIntervalMs) / 1000;
    return Math.max(this.rateLimitedUntil, this.lastRequestStarted + minInterval);
  }

  getStatusCode() {
    if (this.isRateLimited()) return "rate_limited";
    if (this.valid) return "valid";
    return this.statusCode || "invalid";
  }

  getStatusText() {
    const map = { valid: "正常", rate_limited: "限流", banned: "封禁",
      auth_error: "鉴权失败", invalid: "失效", session_expired: "Session 过期" };
    return map[this.getStatusCode()] || "未知";
  }

  toDict() {
    return {
      sessionid: this.sessionid, name: this.name, status_code: this.statusCode,
      last_error: this.lastError, last_request_started: this.lastRequestStarted,
      last_request_finished: this.lastRequestFinished,
      consecutive_failures: this.consecutiveFailures,
      rate_limit_strikes: this.rateLimitStrikes,
    };
  }
}

export class DoubaoAccountPool {
  constructor(maxInflight = doubaoConfig.maxInflightPerAccount) {
    this.maxInflight = maxInflight;
    this.accounts = [];
    this._waiters = [];
    this._stickySessionid = null;
  }

  load() {
    const data = readJsonFile(doubaoConfig.accountsFile, []);
    this.accounts = Array.isArray(data) ? data.map(d => new DoubaoAccount(d)) : [];
    console.log(`[Doubao] Loaded ${this.accounts.length} account(s)`);
  }

  save() {
    writeJsonFile(doubaoConfig.accountsFile, this.accounts.map(a => a.toDict()));
  }

  add(account) {
    this.accounts = this.accounts.filter(a => a.sessionid !== account.sessionid);
    this.accounts.push(account);
    this.save();
  }

  remove(sessionid) {
    this.accounts = this.accounts.filter(a => a.sessionid !== sessionid);
    this.save();
  }

  setMaxInflight(value) {
    this.maxInflight = Math.max(1, parseInt(value, 10));
  }

  acquire(exclude = new Set()) {
    const now = Date.now() / 1000;
    const available = this.accounts.filter(a => a.isAvailable() && !exclude.has(a.sessionid));
    if (!available.length) return null;
    const ready = available.filter(a => a.inflight < this.maxInflight && a.nextAvailableAt() <= now);
    if (!ready.length) return null;
    ready.sort((a, b) => a.inflight - b.inflight || (a.lastRequestStarted || 0) - (b.lastRequestStarted || 0));
    const best = ready[0];
    best.inflight++;
    best.lastUsed = now;
    best.lastRequestStarted = now + jitterSeconds();
    this._stickySessionid = ready.length === 1 ? best.sessionid : null;
    return best;
  }

  async acquireWait(timeout = 60, exclude = new Set()) {
    const deadline = Date.now() + timeout * 1000;
    while (true) {
      const acc = this.acquire(exclude);
      if (acc) return acc;
      const candidates = this.accounts.filter(a => a.valid && !exclude.has(a.sessionid));
      if (!candidates.length) return null;
      const remaining = deadline - Date.now();
      if (remaining <= 0) return null;
      const nextReadyAt = Math.min(...candidates.map(a => a.nextAvailableAt())) * 1000;
      const waitMs = Math.min(remaining, Math.max(50, nextReadyAt - Date.now() + 50));
      await new Promise(resolve => {
        const timer = setTimeout(resolve, waitMs);
        this._waiters.push({ resolve, timer });
      });
    }
  }

  release(acc) {
    acc.inflight = Math.max(0, acc.inflight - 1);
    acc.lastRequestFinished = Date.now() / 1000;
    if (this._waiters.length) {
      const { resolve, timer } = this._waiters.shift();
      clearTimeout(timer);
      resolve();
    }
  }

  markInvalid(acc, reason = "invalid", errorMessage = "") {
    acc.valid = false;
    acc.statusCode = reason || "invalid";
    acc.lastError = errorMessage || acc.lastError;
    acc.consecutiveFailures++;
    if (this._stickySessionid === acc.sessionid) this._stickySessionid = null;
  }

  markSuccess(acc) {
    acc.consecutiveFailures = 0;
    acc.rateLimitStrikes = 0;
    if (acc.statusCode === "rate_limited") acc.statusCode = "valid";
    acc.valid = true;
  }

  markRateLimited(acc, cooldown = null, errorMessage = "") {
    acc.rateLimitStrikes++;
    const base = cooldown !== null ? cooldown : doubaoConfig.rateLimitBaseCooldown;
    let dynamic = Math.min(doubaoConfig.rateLimitMaxCooldown,
      Math.floor(base * Math.pow(2, Math.max(0, acc.rateLimitStrikes - 1))));
    dynamic += Math.floor(jitterSeconds());
    acc.rateLimitedUntil = Date.now() / 1000 + dynamic;
    acc.statusCode = "rate_limited";
    acc.lastError = errorMessage || acc.lastError;
    if (this._stickySessionid === acc.sessionid) this._stickySessionid = null;
  }

  status() {
    const available = this.accounts.filter(a => a.isAvailable());
    const rateLimited = this.accounts.filter(a => a.getStatusCode() === "rate_limited");
    const invalid = this.accounts.filter(a => !["valid", "rate_limited"].includes(a.getStatusCode()));
    const inUse = this.accounts.reduce((s, a) => s + a.inflight, 0);
    return {
      total: this.accounts.length, valid: available.length,
      rate_limited: rateLimited.length, invalid: invalid.length,
      banned: this.accounts.filter(a => a.getStatusCode() === "banned").length,
      session_expired: this.accounts.filter(a => a.getStatusCode() === "session_expired").length,
      in_use: inUse, max_inflight: this.maxInflight,
      waiting: this._waiters.length,
      account_min_interval_ms: doubaoConfig.accountMinIntervalMs,
    };
  }
}
