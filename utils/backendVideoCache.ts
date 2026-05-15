import { resolveBackendUrl } from './runtimeConfig';

type CachedVideoPayload = {
  filePath: string | null;
  exists?: boolean;
};

const resolvedPaths = new Map<string, string>();
const pendingLookups = new Map<string, Promise<string | null>>();
const pendingUploads = new Map<string, Promise<string>>();

function buildVideoCacheKey(file: File): string {
  return `${file.name}__${file.size}__${file.lastModified || 0}`;
}

function createAbortError(): Error {
  try {
    return new DOMException('The operation was aborted.', 'AbortError');
  } catch {
    const error = new Error('The operation was aborted.');
    error.name = 'AbortError';
    return error;
  }
}

async function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    throw createAbortError();
  }

  return await new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(createAbortError());
    signal.addEventListener('abort', onAbort, { once: true });

    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

async function queryCachedVideo(file: File): Promise<string | null> {
  const search = new URLSearchParams({
    fileName: file.name,
    fileSize: String(file.size),
    lastModified: String(file.lastModified || 0),
  });

  const response = await fetch(`${resolveBackendUrl('/api/video/upload')}?${search.toString()}`, {
    method: 'GET',
  });

  const payload = await response.json().catch(() => ({})) as CachedVideoPayload & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `Video cache lookup failed: ${response.status}`);
  }

  return payload.exists ? payload.filePath : null;
}

async function uploadVideo(file: File): Promise<string> {
  const response = await fetch(resolveBackendUrl('/api/video/upload'), {
    method: 'POST',
    headers: {
      'content-type': file.type || 'application/octet-stream',
      'x-file-name': encodeURIComponent(file.name),
      'x-file-size': String(file.size),
      'x-file-last-modified': String(file.lastModified || 0),
    },
    body: file,
  });

  const payload = await response.json().catch(() => ({})) as { filePath?: string; error?: string };
  if (!response.ok || !payload.filePath) {
    throw new Error(payload.error || `Video upload failed: ${response.status}`);
  }

  return payload.filePath;
}

export async function resolveBackendVideoPath(file: File, signal: AbortSignal): Promise<string> {
  const cacheKey = buildVideoCacheKey(file);

  const resolvedPath = resolvedPaths.get(cacheKey);
  if (resolvedPath) {
    return resolvedPath;
  }

  const pendingLookup = pendingLookups.get(cacheKey) ?? queryCachedVideo(file).finally(() => {
    pendingLookups.delete(cacheKey);
  });
  pendingLookups.set(cacheKey, pendingLookup);

  const cachedPath = await withAbort(pendingLookup, signal);
  if (cachedPath) {
    resolvedPaths.set(cacheKey, cachedPath);
    return cachedPath;
  }

  const existing = pendingUploads.get(cacheKey);
  if (existing) {
    const uploadedPath = await withAbort(existing, signal);
    resolvedPaths.set(cacheKey, uploadedPath);
    return uploadedPath;
  }

  const pending = uploadVideo(file).finally(() => {
    pendingUploads.delete(cacheKey);
  });
  pendingUploads.set(cacheKey, pending);
  const uploadedPath = await withAbort(pending, signal);
  resolvedPaths.set(cacheKey, uploadedPath);
  return uploadedPath;
}
