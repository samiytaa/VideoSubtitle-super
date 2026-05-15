import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { config } from "../config.js";
import { runtimePaths } from "../runtime-paths.js";

const uploadsDirectory = join(runtimePaths.dataDirectory, "video-cache");

mkdirSync(uploadsDirectory, { recursive: true });

function sanitizeFileName(fileName) {
  const decoded = typeof fileName === "string" ? decodeURIComponent(fileName) : "";
  const baseName = decoded.trim();
  const normalized = baseName.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
  return normalized || "upload.bin";
}

function buildCacheKey({ fileName, fileSize, lastModified }) {
  return `${sanitizeFileName(fileName)}__${fileSize}__${lastModified || 0}`;
}

export function resolveCachedUpload({ fileName, fileSize, lastModified }) {
  const cacheKey = buildCacheKey({ fileName, fileSize, lastModified });
  const entries = existsSync(uploadsDirectory) ? readdirSync(uploadsDirectory) : [];

  for (const entry of entries) {
    if (!entry.startsWith(`${cacheKey}__`)) continue;
    const fullPath = join(uploadsDirectory, entry);
    try {
      if (statSync(fullPath).isFile() && statSync(fullPath).size === fileSize) {
        return { cacheKey, filePath: fullPath };
      }
    } catch {
      // ignore broken cache files
    }
  }

  return { cacheKey, filePath: null };
}

export async function saveUploadedVideo(request) {
  const fileName = sanitizeFileName(request.headers["x-file-name"]);
  const fileSize = Math.max(0, Number(request.headers["x-file-size"] || 0));
  const lastModified = Math.max(0, Number(request.headers["x-file-last-modified"] || 0));

  if (!fileSize) {
    throw new Error("x-file-size header is required");
  }

  const { cacheKey, filePath: cachedPath } = resolveCachedUpload({ fileName, fileSize, lastModified });
  if (cachedPath) {
    return { cacheKey, filePath: cachedPath, reused: true };
  }

  const targetPath = join(uploadsDirectory, `${cacheKey}__${randomUUID()}__${fileName}`);
  const output = createWriteStream(targetPath, { flags: "wx" });

  let bytesWritten = 0;

  try {
    for await (const chunk of request) {
      bytesWritten += chunk.byteLength;
      if (bytesWritten > config.requestBodyLimitBytes) {
        throw new Error("Request body too large");
      }
      if (!output.write(chunk)) {
        await new Promise((resolve) => output.once("drain", resolve));
      }
    }

    await new Promise((resolve, reject) => {
      output.end((error) => (error ? reject(error) : resolve()));
    });

    if (bytesWritten !== fileSize) {
      throw new Error(`Uploaded file size mismatch: expected ${fileSize}, received ${bytesWritten}`);
    }

    return { cacheKey, filePath: targetPath, reused: false };
  } catch (error) {
    output.destroy();
    try {
      unlinkSync(targetPath);
    } catch {
      // ignore cleanup errors
    }
    throw error;
  }
}
