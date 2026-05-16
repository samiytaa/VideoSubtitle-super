import { useCallback } from 'react';
import { Notifier } from '../components/Notifications';

interface UseClearAllDataOptions {
  extractedFramesCount: number;
  mergedImagesCount: number;
  notifier: Notifier;
  onClearFrames: () => void;
  onClearMerged: () => void;
}

export function useClearAllData(options: UseClearAllDataOptions) {
  const { extractedFramesCount, mergedImagesCount, notifier, onClearFrames, onClearMerged } =
    options;

  const handleClearAllData = useCallback(async () => {
    const totalCount = extractedFramesCount + mergedImagesCount;
    if (totalCount === 0) return;

    const confirmed = await notifier.showConfirm({
      title: '⚠️ 清空所有数据',
      message: `确定要清空所有数据吗？\n\n这将删除：\n• ${extractedFramesCount} 张截取的图片\n• ${mergedImagesCount} 张拼接的图片\n\n此操作不可恢复！`,
    });

    if (confirmed) {
      onClearFrames();
      onClearMerged();
      notifier.addToast('已清空所有数据', 'success');
    }
  }, [extractedFramesCount, mergedImagesCount, notifier, onClearFrames, onClearMerged]);

  return { handleClearAllData };
}
