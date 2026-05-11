import { RoiPreset } from '../../types';

export const STORAGE_KEY = 'roi_presets';

export const DEFAULT_PRESETS: Record<string, RoiPreset> = {
  '【对话】': {
    name: '【对话】',
    x_ratio: 0,
    y_ratio: 0.8275,
    w_ratio: 0.54,
    h_ratio: 0.160625,
    description: 'X=0, Y=1324, 宽度=864, 高度=257',
    isDefault: true,
    category: 'dialogue',
  },
  '【地点】': {
    name: '【地点】',
    x_ratio: 0.446875,
    y_ratio: 0.23625,
    w_ratio: 0.06125,
    h_ratio: 0.345625,
    description: 'X=715, Y=378, 宽度=98, 高度=553',
    isDefault: false,
    category: 'location',
  },
};

/** 根据预设名称/分类推断是否跳过字幕区域 */
export const getSkipSubtitleRegionsFromPreset = (preset: RoiPreset): boolean | undefined => {
  if (preset.name.includes('【对话】') || preset.name.includes('对话')) return false;
  if (preset.name.includes('【地点】') || preset.name.includes('地点')) return true;
  if (preset.category === 'dialogue') return false;
  if (preset.category === 'location') return true;
  return undefined;
};

export const formatTimeHms = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};
