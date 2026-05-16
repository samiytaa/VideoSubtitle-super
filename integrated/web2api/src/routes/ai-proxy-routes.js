/**
 * AI 代理路由
 * 将前端的 /api/ai-proxy 请求转发到用户配置的外部 AI API，
 * 绕过浏览器的 CORS 限制（请求从 Node.js 服务端发出）。
 *
 * 请求格式：
 *   POST/GET /api/ai-proxy
 *   Header: x-ai-target-url: https://zyraonline.org/v1/chat/completions
 *   Header: x-ai-api-key: sk-xxx  （可选，也可直接带 Authorization）
 *   Body: 原始请求体（透传）
 */

export async function handleAiProxyRequest(request, response, url) {
  if (!url.pathname.startsWith('/api/ai-proxy')) return false;

  // 从自定义 header 取目标 URL
  const targetUrl = request.headers['x-ai-target-url'];
  if (!targetUrl) {
    response.writeHead(400, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'Missing x-ai-target-url header' }));
    return true;
  }

  // 构造转发 headers：透传 content-type、accept、authorization
  const forwardHeaders = {};
  if (request.headers['content-type']) forwardHeaders['content-type'] = request.headers['content-type'];
  if (request.headers['accept']) forwardHeaders['accept'] = request.headers['accept'];

  // 优先用 x-ai-api-key，否则透传 authorization
  const apiKey = request.headers['x-ai-api-key'];
  if (apiKey) {
    forwardHeaders['authorization'] = `Bearer ${apiKey}`;
  } else if (request.headers['authorization']) {
    forwardHeaders['authorization'] = request.headers['authorization'];
  }

  // 读取请求体
  let body = undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await readBody(request);
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: body?.length ? body : undefined,
      // Node 18+ fetch 支持 duplex
      ...(body?.length ? { duplex: 'half' } : {}),
    });

    // 透传响应头（去掉会导致问题的 hop-by-hop 头）
    const skipHeaders = new Set([
      'content-encoding', 'content-length', 'connection',
      'keep-alive', 'transfer-encoding', 'upgrade',
    ]);
    const resHeaders = {};
    upstream.headers.forEach((value, key) => {
      if (!skipHeaders.has(key.toLowerCase())) resHeaders[key] = value;
    });

    response.writeHead(upstream.status, resHeaders);
    response.flushHeaders?.();

    if (upstream.body) {
      for await (const chunk of upstream.body) {
        response.write(chunk);
      }
    }
    response.end();
  } catch (err) {
    if (!response.headersSent) {
      response.writeHead(502, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: `代理转发失败: ${err.message}` }));
    }
  }

  return true;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}
