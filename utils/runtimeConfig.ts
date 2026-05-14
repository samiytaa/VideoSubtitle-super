const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const resolveBackendUrl = (path: string) => {
  if (!path.startsWith('/')) return path;

  const configuredBase = import.meta.env.VITE_BACKEND_URL?.trim();
  if (configuredBase) {
    return `${trimTrailingSlash(configuredBase)}${path}`;
  }

  if (window.location.protocol === 'file:') {
    return `http://127.0.0.1:3000${path}`;
  }

  return path;
};

const normalizeRoutePath = (value: string) => {
  if (!value) return '/';
  const normalized = value.startsWith('/') ? value : `/${value}`;
  return normalized.replace(/\/+$/, '') || '/';
};

export const getCurrentRoutePath = (knownPaths: readonly string[]) => {
  const hashPath = normalizeRoutePath(window.location.hash.replace(/^#/, ''));
  if (knownPaths.includes(hashPath)) return hashPath;

  const pathname = normalizeRoutePath(window.location.pathname);
  if (knownPaths.includes(pathname)) return pathname;

  return '/';
};

export const syncHashRoute = (path: string) => {
  const normalizedPath = normalizeRoutePath(path);
  const targetHash = `#${normalizedPath}`;
  if (window.location.hash !== targetHash) {
    window.location.hash = normalizedPath;
  }
};
