import { RoiPreset } from '../types';

export const QUICK_PROCESS_PREFS_KEY = 'quick_process_prefs';
const QUICK_PROCESS_PREFS_EVENT = 'quick-process-prefs-change';

export interface QuickProcessPrefs {
  captureDialogue: boolean;
  captureLocation: boolean;
  selectedDialoguePreset: string;
  selectedLocationPreset: string;
  autoDeduplicationDialogue: boolean;
  autoDeduplicationLocation: boolean;
  skipSubtitleDialogue: boolean;
  skipSubtitleLocation: boolean;
  frameInterval: number;
}

export const getDefaultQuickProcessPrefs = (): QuickProcessPrefs => ({
  captureDialogue: true,
  captureLocation: true,
  selectedDialoguePreset: '',
  selectedLocationPreset: '',
  autoDeduplicationDialogue: false,
  autoDeduplicationLocation: true,
  skipSubtitleDialogue: false,
  skipSubtitleLocation: true,
  frameInterval: 15,
});

export const loadQuickProcessPrefs = (): Partial<QuickProcessPrefs> => {
  try {
    const saved = localStorage.getItem(QUICK_PROCESS_PREFS_KEY);
    if (saved) return JSON.parse(saved) as Partial<QuickProcessPrefs>;
  } catch { /* ignore */ }
  return {};
};

export const saveQuickProcessPrefs = (prefs: QuickProcessPrefs) => {
  try {
    localStorage.setItem(QUICK_PROCESS_PREFS_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent<QuickProcessPrefs>(QUICK_PROCESS_PREFS_EVENT, { detail: prefs }));
  } catch { /* ignore */ }
};

export const updateQuickProcessPrefs = (patch: Partial<QuickProcessPrefs>) => {
  const next = {
    ...getDefaultQuickProcessPrefs(),
    ...loadQuickProcessPrefs(),
    ...patch,
  };
  saveQuickProcessPrefs(next);
  return next;
};

export const subscribeQuickProcessPrefs = (listener: (prefs: Partial<QuickProcessPrefs>) => void) => {
  const handleCustomEvent = (event: Event) => {
    const customEvent = event as CustomEvent<QuickProcessPrefs>;
    listener(customEvent.detail);
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== QUICK_PROCESS_PREFS_KEY || !event.newValue) return;
    try {
      listener(JSON.parse(event.newValue) as Partial<QuickProcessPrefs>);
    } catch {
      listener({});
    }
  };

  window.addEventListener(QUICK_PROCESS_PREFS_EVENT, handleCustomEvent as EventListener);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(QUICK_PROCESS_PREFS_EVENT, handleCustomEvent as EventListener);
    window.removeEventListener('storage', handleStorage);
  };
};

export const getPresetCategory = (preset: RoiPreset, fallbackTab?: 'dialogue' | 'location'): 'dialogue' | 'location' => {
  if (preset.category === 'dialogue' || preset.name.includes('对话') || preset.name.includes('【对话】')) return 'dialogue';
  if (preset.category === 'location' || preset.name.includes('地点') || preset.name.includes('【地点】')) return 'location';
  return fallbackTab ?? 'dialogue';
};
