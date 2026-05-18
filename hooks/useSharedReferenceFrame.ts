import { useEffect, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'shared_reference_frame_id';

let sharedReferenceFrameId: string | null = null;
const listeners = new Set<() => void>();

const notifyListeners = () => {
  listeners.forEach((listener) => listener());
};

const readStoredReferenceFrameId = () => {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && stored.length > 0 ? stored : null;
};

const ensureInitialized = () => {
  if (typeof window === 'undefined') return;
  if (sharedReferenceFrameId !== null) return;
  sharedReferenceFrameId = readStoredReferenceFrameId();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => {
  ensureInitialized();
  return sharedReferenceFrameId;
};

export const setSharedReferenceFrameId = (nextValue: string | null) => {
  ensureInitialized();
  if (sharedReferenceFrameId === nextValue) return;
  sharedReferenceFrameId = nextValue;
  if (typeof window !== 'undefined') {
    if (nextValue) {
      localStorage.setItem(STORAGE_KEY, nextValue);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  notifyListeners();
};

export const getSharedReferenceFrameId = () => getSnapshot();

export const useSharedReferenceFrame = () => {
  const selectedReferenceFrameId = useSyncExternalStore(subscribe, getSnapshot, () => null);

  useEffect(() => {
    ensureInitialized();
  }, []);

  return {
    selectedReferenceFrameId,
    setSelectedReferenceFrameId: setSharedReferenceFrameId,
  };
};
