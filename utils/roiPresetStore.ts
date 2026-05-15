import { RoiPreset } from '../types';

export const ROI_PRESETS_STORAGE_KEY = 'roi_presets';
const ROI_PRESETS_CHANGE_EVENT = 'roi-presets-change';

const DEFAULT_PRESETS: Record<string, RoiPreset> = {
  '【对话】': { name: '【对话】', x_ratio: 0, y_ratio: 0.8275, w_ratio: 0.54, h_ratio: 0.160625, description: 'X=0, Y=1324, 宽度=864, 高度=257', isDefault: true, category: 'dialogue' },
  '【地点】': { name: '【地点】', x_ratio: 0.446875, y_ratio: 0.23625, w_ratio: 0.06125, h_ratio: 0.345625, description: 'X=715, Y=378, 宽度=98, 高度=553', isDefault: false, category: 'location' },
};

export const loadRoiPresets = (): Record<string, RoiPreset> => {
  try {
    const saved = localStorage.getItem(ROI_PRESETS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, RoiPreset>;
      return { ...DEFAULT_PRESETS, ...parsed };
    }
  } catch { /* ignore */ }
  return DEFAULT_PRESETS;
};

export const saveRoiPresets = (presets: Record<string, RoiPreset>) => {
  try {
    localStorage.setItem(ROI_PRESETS_STORAGE_KEY, JSON.stringify(presets));
    window.dispatchEvent(new CustomEvent<Record<string, RoiPreset>>(ROI_PRESETS_CHANGE_EVENT, { detail: presets }));
  } catch { /* ignore */ }
};

export const subscribeRoiPresets = (listener: (presets: Record<string, RoiPreset>) => void) => {
  const handleCustomEvent = (event: Event) => {
    const customEvent = event as CustomEvent<Record<string, RoiPreset>>;
    listener(customEvent.detail);
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== ROI_PRESETS_STORAGE_KEY) return;
    listener(loadRoiPresets());
  };

  window.addEventListener(ROI_PRESETS_CHANGE_EVENT, handleCustomEvent as EventListener);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(ROI_PRESETS_CHANGE_EVENT, handleCustomEvent as EventListener);
    window.removeEventListener('storage', handleStorage);
  };
};
