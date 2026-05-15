import { extractFramesWithFfmpeg } from "../services/ffmpeg-extraction-service.js";
import { resolveCachedUpload, saveUploadedVideo } from "../services/video-upload-service.js";
import { parseJsonBody, readRequestBody, sendError, sendJson } from "../utils/http.js";

async function readJsonRequest(request) {
  return parseJsonBody(await readRequestBody(request)) ?? {};
}

export async function handleVideoExtractionRequest(request, response, url) {
  if (request.method === "POST" && url.pathname === "/api/video/upload") {
    try {
      const payload = await saveUploadedVideo(request);
      sendJson(response, 200, { ok: true, ...payload });
    } catch (error) {
      console.error("[video-upload]", error);
      sendError(response, 400, error instanceof Error ? error.message : String(error));
    }

    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/video/upload") {
    try {
      const fileName = url.searchParams.get("fileName") ?? "";
      const fileSize = Number(url.searchParams.get("fileSize") ?? 0);
      const lastModified = Number(url.searchParams.get("lastModified") ?? 0);
      const payload = resolveCachedUpload({ fileName, fileSize, lastModified });
      sendJson(response, 200, {
        ok: true,
        cacheKey: payload.cacheKey,
        filePath: payload.filePath,
        exists: Boolean(payload.filePath)
      });
    } catch (error) {
      console.error("[video-upload-check]", error);
      sendError(response, 400, error instanceof Error ? error.message : String(error));
    }

    return true;
  }

  if (request.method !== "POST" || url.pathname !== "/api/video/extract-frames") {
    return false;
  }

  try {
    const body = await readJsonRequest(request);
    const payload = await extractFramesWithFfmpeg(body);
    sendJson(response, 200, payload);
  } catch (error) {
    console.error("[video-extraction]", error);
    sendError(response, 400, error instanceof Error ? error.message : String(error));
  }

  return true;
}
