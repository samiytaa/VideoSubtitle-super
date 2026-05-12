import { randomUUID } from "node:crypto";
import { doubaoConfig } from "./doubao-config.js";

const JS_STREAM_DOUBAO = `async (args) => {
  const fetchStr = window.fetch.toString().substring(0, 80);
  const headers = {
    'Content-Type': 'application/json',
    'Agw-Js-Conv': 'str',
    'x-flow-trace': args.trace_id,
    'last-event-id': 'undefined'
  };
  const opts = {
    method: 'POST',
    headers: headers,
    body: args.body,
    credentials: 'include',
    signal: AbortSignal.timeout(1800000)
  };
  try {
    const res = await fetch(args.url, opts);
    if (!res.ok) {
      const t = await res.text();
      return { status: res.status, body: t.substring(0, 2000), fetch_hook: fetchStr };
    }
    const rdr = res.body.getReader();
    const dec = new TextDecoder();
    let body = '';
    while (true) {
      const { done, value } = await rdr.read();
      if (done) break;
      body += dec.decode(value, { stream: true });
    }
    return { status: res.status, body: body, fetch_hook: fetchStr, body_len: body.length };
  } catch (e) {
    return { status: 0, body: 'JS error: ' + e.message, fetch_hook: fetchStr };
  }
}`;

export class DoubaosBrowserEngine {
  constructor(poolSize = doubaoConfig.browserPoolSize, baseUrl = doubaoConfig.baseUrl) {
    this.poolSize = poolSize;
    this.baseUrl = baseUrl;
    this._browser = null;
    this._playwright = null;
    this._pages = [];
    this._pageQueue = [];
    this._started = false;
    this._contextSessionid = new Map();
  }

  async start() {
    if (this._started) return;
    try {
      await this._startPlaywright();
    } catch (e) {
      console.error("[Doubao Browser] Playwright Chromium 启动失败:", e.message);
      console.error("[Doubao Browser] 请运行: npx playwright install chromium");
    }
  }

  async _startPlaywright() {
    const { chromium } = await import("playwright");
    console.log("[Doubao Browser] Starting Playwright Chromium...");
    const launchArgs = [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-gpu",
      "--lang=zh-CN",
    ];
    try {
      this._browser = await chromium.launch({ headless: true, args: launchArgs });
    } catch (e) {
      if (!e.message.includes("chromium_headless_shell") && !e.message.includes("headless-shell")) throw e;
      console.warn("[Doubao Browser] Headless shell not available, retrying with channel='chromium'");
      this._browser = await chromium.launch({ channel: "chromium", headless: true, args: launchArgs });
    }
    await this._initPages();
    this._started = true;
    console.log(`[Doubao Browser] Started, pool_size=${this.poolSize}`);
  }

  async _initPages() {
    console.log(`[Doubao Browser] Initializing ${this.poolSize} pages...`);
    for (let i = 0; i < this.poolSize; i++) {
      const context = await this._browser.newContext({
        viewport: { width: 1920, height: 1080 },
        locale: "zh-CN",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      });
      const page = await context.newPage();
      this._pages.push({ page, context });
      this._pageQueue.push({ page, context });
      console.log(`  [Doubao Browser] Page ${i + 1}/${this.poolSize} ready`);
    }
  }

  async stop() {
    this._started = false;
    for (const { context } of this._pages) {
      try { await context.close(); } catch {}
    }
    if (this._browser) { try { await this._browser.close(); } catch {} }
  }

  async _injectSession(context, sessionid) {
    const cookies = ["sessionid", "sessionid_ss", "sid_tt", "sid_guard"].map(name => ({
      name, value: sessionid, domain: ".doubao.com", path: "/",
      httpOnly: true, secure: true, sameSite: "Lax",
    }));
    await context.addCookies(cookies);
  }

  _acquirePage() {
    if (this._pageQueue.length) return Promise.resolve(this._pageQueue.shift());
    return new Promise(resolve => {
      const check = () => {
        if (this._pageQueue.length) resolve(this._pageQueue.shift());
        else setTimeout(check, 50);
      };
      setTimeout(check, 50);
    });
  }

  _releasePage(entry, needsRefresh) {
    if (needsRefresh) {
      entry.page.goto(this.baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 })
        .catch(() => {})
        .finally(() => this._pageQueue.push(entry));
    } else {
      this._pageQueue.push(entry);
    }
  }

  async fetchChat(sessionid, requestBody, conversationId = "") {
    if (!this._started) {
      return { status: 0, body: "Browser engine not started. Run: npx playwright install chromium" };
    }

    let entry;
    try {
      entry = await Promise.race([
        this._acquirePage(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Queue timeout")), 60000)),
      ]);
    } catch {
      return { status: 429, body: "Too Many Requests (Queue full)" };
    }

    const { page, context } = entry;
    let needsRefresh = false;
    const traceId = randomUUID().replace(/-/g, "");
    const ctxId = context;

    try {
      const prevSessionid = this._contextSessionid.get(ctxId) || "";
      const needNavigate = prevSessionid !== sessionid;

      if (needNavigate) {
        await this._injectSession(context, sessionid);
        this._contextSessionid.set(ctxId, sessionid);
        try {
          await page.goto(this.baseUrl, { waitUntil: "networkidle", timeout: 30000 });
          await new Promise(r => setTimeout(r, 2000));
        } catch {
          try {
            await page.goto(this.baseUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
            await new Promise(r => setTimeout(r, 1500));
          } catch {}
        }
      }

      // jitter delay
      const jitterMs = Math.random() * (doubaoConfig.requestJitterMaxMs - doubaoConfig.requestJitterMinMs) + doubaoConfig.requestJitterMinMs;
      await new Promise(r => setTimeout(r, jitterMs));

      const url = `${this.baseUrl}/chat/completion`;
      const res = await Promise.race([
        page.evaluate(JS_STREAM_DOUBAO, { url, body: requestBody, trace_id: traceId }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1800000)),
      ]);

      if (res && res.status === 0) needsRefresh = true;
      return res && typeof res === "object" ? res : { status: 0, body: String(res) };

    } catch (e) {
      needsRefresh = true;
      return { status: 0, body: e.message };
    } finally {
      this._releasePage(entry, needsRefresh);
    }
  }
}
