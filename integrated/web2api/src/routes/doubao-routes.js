import { randomUUID } from "node:crypto";
import { doubaoConfig, resolveBotId, getApiKeys, saveApiKeys } from "../services/doubao-config.js";
import { DoubaoAccount } from "../services/doubao-account-pool.js";
import { readRequestBody, sendError, sendJson } from "../utils/http.js";

function checkAdmin(request) {
  const auth = request.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return token === doubaoConfig.adminKey;
}

function checkAuth(request) {
  const auth = request.headers.authorization || "";
  let token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) token = request.headers["x-api-key"] || "";
  const apiKeys = getApiKeys();
  if (apiKeys.size > 0) {
    return token === doubaoConfig.adminKey || apiKeys.has(token);
  }
  return true;
}

function makeChunk(id, created, model, delta, finishReason = null) {
  return JSON.stringify({
    id, object: "chat.completion.chunk", created, model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  });
}

const T2I_PATTERN = /生成图片|画(一|个|张)?图|draw|generate\s+image|create\s+image|make\s+image|图片生成|文生图|生成一张|画一张/i;

function detectMediaIntent(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      const content = messages[i].content;
      const text = Array.isArray(content)
        ? content.filter(p => p.type === "text").map(p => p.text).join(" ")
        : String(content || "");
      return T2I_PATTERN.test(text) ? "t2i" : "t2t";
    }
  }
  return "t2t";
}

function extractLastUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      const content = messages[i].content;
      if (Array.isArray(content)) return content.filter(p => p.type === "text").map(p => p.text).join(" ");
      return String(content || "");
    }
  }
  return "";
}

export async function handleDoubaoAdminRequest(request, response, url, doubaoState) {
  const path = url.pathname;

  if (!checkAdmin(request)) {
    sendError(response, 403, "Admin key required");
    return true;
  }

  const { accountPool, browserEngine } = doubaoState;

  // GET /doubao/api/admin/accounts
  if (request.method === "GET" && path === "/doubao/api/admin/accounts") {
    const result = accountPool.accounts.map(acc => ({
      account_id: acc.sessionid,
      sessionid: acc.sessionid.length > 8 ? acc.sessionid.slice(0, 8) + "..." : acc.sessionid,
      name: acc.name,
      status: acc.getStatusCode(),
      status_text: acc.getStatusText(),
      inflight: acc.inflight,
      consecutive_failures: acc.consecutiveFailures,
      last_error: acc.lastError ? acc.lastError.slice(0, 100) : "",
    }));
    sendJson(response, 200, { accounts: result });
    return true;
  }

  // POST /doubao/api/admin/accounts/add
  if (request.method === "POST" && path === "/doubao/api/admin/accounts/add") {
    const body = JSON.parse((await readRequestBody(request)).toString());
    const acc = new DoubaoAccount({ sessionid: body.sessionid || "", name: body.name || "" });
    accountPool.add(acc);
    sendJson(response, 200, { status: "ok", name: acc.name });
    return true;
  }

  // POST /doubao/api/admin/accounts/remove
  if (request.method === "POST" && path === "/doubao/api/admin/accounts/remove") {
    const body = JSON.parse((await readRequestBody(request)).toString());
    accountPool.remove(body.sessionid || "");
    sendJson(response, 200, { status: "ok" });
    return true;
  }

  // GET /doubao/api/admin/apikeys
  if (request.method === "GET" && path === "/doubao/api/admin/apikeys") {
    sendJson(response, 200, { keys: [...getApiKeys()] });
    return true;
  }

  // POST /doubao/api/admin/apikeys/add
  if (request.method === "POST" && path === "/doubao/api/admin/apikeys/add") {
    const body = JSON.parse((await readRequestBody(request)).toString());
    getApiKeys().add(body.key || "");
    saveApiKeys();
    sendJson(response, 200, { status: "ok" });
    return true;
  }

  // POST /doubao/api/admin/apikeys/remove
  if (request.method === "POST" && path === "/doubao/api/admin/apikeys/remove") {
    const body = JSON.parse((await readRequestBody(request)).toString());
    getApiKeys().delete(body.key || "");
    saveApiKeys();
    sendJson(response, 200, { status: "ok" });
    return true;
  }

  // GET /doubao/api/admin/status
  if (request.method === "GET" && path === "/doubao/api/admin/status") {
    sendJson(response, 200, {
      account_pool: accountPool.status(),
      browser_engine: {
        started: browserEngine._started,
        pool_size: browserEngine.poolSize,
      },
      sessions: doubaoState.client.sessionStore.status(),
      config: {
        engine_mode: "browser",
        base_url: doubaoConfig.baseUrl,
        default_bot_id: doubaoConfig.defaultBotId,
        max_inflight: accountPool.maxInflight,
        browser_pool_size: browserEngine.poolSize,
      },
    });
    return true;
  }

  // POST /doubao/api/admin/max_inflight
  if (request.method === "POST" && path === "/doubao/api/admin/max_inflight") {
    const body = JSON.parse((await readRequestBody(request)).toString());
    accountPool.setMaxInflight(body.value || 1);
    sendJson(response, 200, { status: "ok", max_inflight: accountPool.maxInflight });
    return true;
  }

  return false;
}

export async function handleDoubaoChatRequest(request, response, url, doubaoState) {
  if (request.method !== "POST") return false;
  if (url.pathname !== "/doubao/v1/chat/completions") return false;

  if (!checkAuth(request)) {
    sendError(response, 401, "Invalid API Key");
    return true;
  }

  let reqData;
  try {
    reqData = JSON.parse((await readRequestBody(request)).toString());
  } catch {
    sendError(response, 400, "Invalid JSON body");
    return true;
  }

  const modelName = reqData.model || "doubao";
  const botId = resolveBotId(modelName);
  const stream = Boolean(reqData.stream);
  const messages = reqData.messages || [];
  const userText = extractLastUserText(messages);

  if (!userText) {
    sendError(response, 400, "No user message found");
    return true;
  }

  const mediaIntent = detectMediaIntent(messages);
  const completionId = `chatcmpl-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const created = Math.floor(Date.now() / 1000);
  const { client } = doubaoState;

  if (stream) {
    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    });

    response.write(`data: ${makeChunk(completionId, created, modelName, { role: "assistant" })}\n\n`);

    try {
      for await (const event of client.streamWithRetry(userText, { botId })) {
        if (event.type === "delta") {
          response.write(`data: ${makeChunk(completionId, created, modelName, { content: event.content })}\n\n`);
        } else if (event.type === "image") {
          const imgMd = `![generated](${event.url})`;
          response.write(`data: ${makeChunk(completionId, created, modelName, { content: imgMd })}\n\n`);
        } else if (event.type === "error") {
          response.write(`data: ${JSON.stringify({ error: { message: event.message, type: "upstream_error" } })}\n\n`);
          break;
        } else if (event.type === "done") {
          break;
        }
      }
    } catch (e) {
      response.write(`data: ${JSON.stringify({ error: { message: e.message, type: "internal_error" } })}\n\n`);
    }

    response.write(`data: ${makeChunk(completionId, created, modelName, {}, "stop")}\n\n`);
    response.end("data: [DONE]\n\n");
    return true;
  }

  // non-stream
  try {
    const result = await client.chatWithRetry(userText, { botId });
    if (result.error) {
      sendError(response, 500, result.error);
      return true;
    }
    let content = result.text;
    if (result.imageUrls && result.imageUrls.length) {
      const imgs = result.imageUrls.map(u => `![generated](${u})`).join("\n");
      content = content ? imgs + "\n" + content : imgs;
    }
    sendJson(response, 200, {
      id: completionId, object: "chat.completion", created, model: modelName,
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      images: result.imageUrls || [],
      usage: {
        prompt_tokens: userText.length,
        completion_tokens: content.length,
        total_tokens: userText.length + content.length,
      },
    });
  } catch (e) {
    sendError(response, 500, e.message);
  }
  return true;
}

export async function handleDoubaoRequest(request, response, url, doubaoState) {
  if (!url.pathname.startsWith("/doubao/")) return false;

  try {
    if (url.pathname.startsWith("/doubao/api/admin/")) {
      return await handleDoubaoAdminRequest(request, response, url, doubaoState);
    }
    if (url.pathname === "/doubao/v1/chat/completions") {
      return await handleDoubaoChatRequest(request, response, url, doubaoState);
    }
    if (url.pathname === "/doubao/healthz") {
      sendJson(response, 200, { status: "ok" });
      return true;
    }
    if (url.pathname === "/doubao/readyz") {
      const ready = doubaoState.browserEngine._started;
      sendJson(response, ready ? 200 : 503, { status: ready ? "ready" : "not_ready" });
      return true;
    }
  } catch (e) {
    sendError(response, 500, e.message);
    return true;
  }
  return false;
}
