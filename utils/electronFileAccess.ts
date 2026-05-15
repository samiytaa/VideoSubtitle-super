type VideoSubtitleAppBridge = {
  getPathForFile?: (file: File) => string | undefined;
};

declare global {
  interface Window {
    videoSubtitleApp?: VideoSubtitleAppBridge;
  }
}

export async function resolveVideoLocalPath(file: File): Promise<string | undefined> {
  const bridgedPath = window.videoSubtitleApp?.getPathForFile?.(file);
  if (typeof bridgedPath === 'string' && bridgedPath.trim()) {
    return bridgedPath;
  }

  const fallbackPath = (file as File & { path?: string }).path;
  return typeof fallbackPath === 'string' && fallbackPath.trim() ? fallbackPath : undefined;
}
