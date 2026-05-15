import React, { useEffect, useState } from 'react';
import { RoiPreset } from '../../types';
import { useNotifier } from '../Notifications';
import { DEFAULT_PRESETS, STORAGE_KEY } from './roiSelectorUtils';
import { handleError } from '../../utils/errorHandler';
import { saveRoiPresets } from '../../utils/roiPresetStore';

export function usePresets() {
  const notifier = useNotifier();

  const [presets, setPresets] = useState<Record<string, RoiPreset>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, RoiPreset>;
        return { ...DEFAULT_PRESETS, ...parsed };
      }
    } catch (e) {
      handleError(e, notifier, {
        context: 'Failed to parse presets',
        userMessage: '预设解析失败，已回退默认预设。',
      });
    }
    return DEFAULT_PRESETS;
  });

  // 自动同步到 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    saveRoiPresets(presets);
  }, [presets]);

  const deletePreset = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    const confirmed = await notifier.showConfirm({
      title: '删除预设',
      message: `确定要删除预设 "${name}" 吗？`,
    });
    if (!confirmed) return;
    setPresets(prev => {
      const next = { ...prev } as Record<string, RoiPreset>;
      delete next[name];
      return next;
    });
    notifier.addToast(`预设 "${name}" 已删除`, 'info');
  };

  const renamePreset = async (e: React.MouseEvent, oldName: string) => {
    e.stopPropagation();
    const newName = await notifier.showPrompt({
      title: '重命名预设',
      message: '请输入新的预设名称:',
      defaultValue: oldName,
    });
    if (!newName || newName.trim() === '' || newName.trim() === oldName) return;
    const trimmedName = newName.trim();
    if ((presets as Record<string, RoiPreset>)[trimmedName]) {
      notifier.addToast('该预设名称已存在', 'error');
      return;
    }
    setPresets(prev => {
      const next: Record<string, RoiPreset> = {};
      Object.entries(prev as Record<string, RoiPreset>).forEach(([key, preset]) => {
        if (key === oldName) {
          next[trimmedName] = { ...preset, name: trimmedName };
        } else {
          next[key] = preset;
        }
      });
      return next;
    });
    notifier.addToast(`预设已重命名为 "${trimmedName}"`, 'success');
  };

  const setAsDefaultPreset = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    setPresets(prev => {
      const next: Record<string, RoiPreset> = {};
      Object.entries(prev as Record<string, RoiPreset>).forEach(([key, preset]) => {
        next[key] = { ...preset, isDefault: key === name };
      });
      return next;
    });
  };

  const addPreset = (preset: RoiPreset) => {
    setPresets(prev => ({ ...prev, [preset.name]: preset }));
  };

  return { presets, deletePreset, renamePreset, setAsDefaultPreset, addPreset };
}
