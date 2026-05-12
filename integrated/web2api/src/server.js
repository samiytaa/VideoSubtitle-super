import { createServer } from "node:http";

import { config } from "./config.js";
import { handlePrivateBaimiaoRequest, handleBaimiaoOcrRequest } from "./routes/baimiao-routes.js";
import { sendError, serveStaticFile } from "./utils/http.js";

const isViteDev = process.env.VITE_DEV === "1";

// ── HTTP 服务器 ────────────────────────────────────────────
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-headers", "content-type, authorization");
  response.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    if (url.pathname.startsWith("/api/")) {
      const handled = await handlePrivateBaimiaoRequest({ request, response, url });
      if (!handled) sendError(response, 404, "API route not found");
      return;
    }

    if (url.pathname.startsWith("/v1/")) {
      const handled = await handleBaimiaoOcrRequest(request, response, url);
      if (!handled) sendError(response, 404, "Baimiao route not found");
      return;
    }

    if (url.pathname === "/ocr" || url.pathname === "/healthz") {
      const handled = await handleBaimiaoOcrRequest(request, response, url);
      if (!handled) sendError(response, 404, "Baimiao route not found");
      return;
    }

    if (isViteDev) {
      sendError(response, 404, "Page not found (use Vite dev server for frontend)");
      return;
    }

    if (!serveStaticFile(request, response, url.pathname)) {
      serveStaticFile(request, response, "/index.html");
    }
  } catch (error) {
    if (response.headersSent || response.writableEnded) {
      response.destroy(error);
      return;
    }
    sendError(response, 500, error.message);
  }
});

server.listen(config.port, () => {
  console.log(`Server listening on http://127.0.0.1:${config.port}`);
});
