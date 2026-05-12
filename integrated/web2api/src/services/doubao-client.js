import { doubaoConfig, resolveBotId } from "./doubao-config.js";
import { DoubaoSseParser, streamParseSse } from "./doubao-sse-parser.js";
import { DoubaoSessionStore } from "./doubao-session-store.js";

export class DoubaoClient {
  constructor(engine, accountPool) {
    this.engine = engine;
    this.accountPool = accountPool;
    this.sessionStore = new DoubaoSessionStore();
  }

  async chat(text, { botId = "", conversationId = "", excludeAccounts = new Set() } = {}) {
    botId = botId || doubaoConfig.defaultBotId;
    const acc = await this.accountPool.acquireWait(60, excludeAccounts);
    if (!acc) return { text: "", imageUrls: [], error: "No available accounts", sessionId: "" };

    const session = this.sessionStore.createSession(botId, conversationId);
    try {
      const payload = this.sessionStore.buildFullPayload(session.sessionId, text);
      const bodyStr = JSON.stringify(payload);
      const result = await this.engine.fetchChat(acc.sessionid, bodyStr, conversationId);

      if (!result) {
        this.accountPool.release(acc);
        return { text: "", imageUrls: [], error: "Empty response from engine", sessionId: session.sessionId };
      }
      if ((result.status || 0) !== 200) {
        const errBody = result.body || "Unknown error";
        const errLower = String(errBody).toLowerCase();
        if (errLower.includes("session") && errLower.includes("expired"))
          this.accountPool.markInvalid(acc, "session_expired", errBody.slice(0, 200));
        else if (errLower.includes("rate") || errLower.includes("limit"))
          this.accountPool.markRateLimited(acc, null, errBody.slice(0, 200));
        this.accountPool.release(acc);
        return { text: "", imageUrls: [], error: `HTTP ${result.status}: ${errBody.slice(0, 500)}`, sessionId: session.sessionId };
      }

      const parser = new DoubaoSseParser();
      const parsed = parser.parseRawSse(result.body || "");

      if (parsed.error) {
        this.accountPool.release(acc);
        return { ...parsed, sessionId: session.sessionId };
      }

      const meta = parsed.sessionMeta;
      this.sessionStore.updateFromSse(session.sessionId, {
        conversationId: meta.conversationId || undefined,
        sectionId: meta.sectionId || undefined,
        messageIndex: meta.lastMessageIndex || undefined,
      });
      this.sessionStore.incrementTurn(session.sessionId);
      this.accountPool.markSuccess(acc);
      this.accountPool.release(acc);
      return { ...parsed, sessionId: session.sessionId };

    } catch (e) {
      this.accountPool.release(acc);
      return { text: "", imageUrls: [], error: e.message, sessionId: session.sessionId };
    }
  }

  async *chatStream(text, { botId = "", conversationId = "", excludeAccounts = new Set() } = {}) {
    botId = botId || doubaoConfig.defaultBotId;
    const acc = await this.accountPool.acquireWait(60, excludeAccounts);
    if (!acc) { yield { type: "error", message: "No available accounts" }; return; }

    const session = this.sessionStore.createSession(botId, conversationId);
    yield { type: "meta", sessionId: session.sessionId, acc };

    try {
      const payload = this.sessionStore.buildFullPayload(session.sessionId, text);
      const bodyStr = JSON.stringify(payload);
      const result = await this.engine.fetchChat(acc.sessionid, bodyStr, conversationId);

      if (!result) {
        this.accountPool.release(acc);
        yield { type: "error", message: "Empty response from engine" };
        return;
      }
      if ((result.status || 0) !== 200) {
        const errBody = result.body || "Unknown error";
        const errLower = String(errBody).toLowerCase();
        if (errLower.includes("session") && errLower.includes("expired"))
          this.accountPool.markInvalid(acc, "session_expired", errBody.slice(0, 200));
        else if (errLower.includes("rate") || errLower.includes("limit"))
          this.accountPool.markRateLimited(acc, null, errBody.slice(0, 200));
        this.accountPool.release(acc);
        yield { type: "error", message: `HTTP ${result.status}: ${errBody.slice(0, 500)}` };
        return;
      }

      for (const event of streamParseSse(result.body || "")) {
        if (event.type === "meta_update") {
          this.sessionStore.updateFromSse(session.sessionId, {
            conversationId: event.conversationId || undefined,
            sectionId: event.sectionId || undefined,
          });
        } else if (event.type === "index_update") {
          this.sessionStore.updateFromSse(session.sessionId, { messageIndex: event.messageIndex });
        } else if (event.type === "done") {
          this.sessionStore.incrementTurn(session.sessionId);
          this.accountPool.markSuccess(acc);
          this.accountPool.release(acc);
          yield { type: "done" };
          return;
        } else if (event.type === "error") {
          this.accountPool.markInvalid(acc, "upstream_error", event.message.slice(0, 200));
          this.accountPool.release(acc);
          yield event;
          return;
        } else {
          yield event;
        }
      }
      this.accountPool.markSuccess(acc);
      this.accountPool.release(acc);
      yield { type: "done" };

    } catch (e) {
      this.accountPool.release(acc);
      yield { type: "error", message: e.message };
    }
  }

  async chatWithRetry(text, { botId = "", conversationId = "" } = {}) {
    const exclude = new Set();
    let last = { text: "", imageUrls: [], error: "Max retries exceeded", sessionId: "" };
    for (let i = 0; i < doubaoConfig.maxRetries; i++) {
      last = await this.chat(text, { botId, conversationId, excludeAccounts: exclude });
      if (!last.error) return last;
      await new Promise(r => setTimeout(r, 500));
    }
    return last;
  }

  async *streamWithRetry(text, { botId = "", conversationId = "" } = {}) {
    const exclude = new Set();
    for (let attempt = 0; attempt < doubaoConfig.maxRetries; attempt++) {
      let gotData = false;
      for await (const event of this.chatStream(text, { botId, conversationId, excludeAccounts: exclude })) {
        if (event.type === "meta") {
          if (event.acc) exclude.add(event.acc.sessionid);
        } else if (event.type === "delta" || event.type === "image" || event.type === "suggestion") {
          gotData = true;
          yield event;
        } else if (event.type === "error") {
          if (!gotData && attempt < doubaoConfig.maxRetries - 1) {
            await new Promise(r => setTimeout(r, 500));
            break;
          }
          yield event;
          return;
        } else if (event.type === "done") {
          yield event;
          return;
        }
      }
      if (gotData) return;
    }
    yield { type: "error", message: "Max retries exceeded" };
  }
}
