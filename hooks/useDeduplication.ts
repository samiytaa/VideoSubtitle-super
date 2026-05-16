import { useCallback } from 'react';
import { ExtractedFrame } from '../types';
import { Notifier } from '../components/Notifications';
import { handleError } from '../utils/errorHandler';
import { logger } from '../utils/logger';

interface ProcessingProgress {
  current: number;
  total: number;
  message: string;
  stage?: 'extracting' | 'deduplicating';
}

interface UseDeduplicationProps {
  extractedFramesRef: { current: ExtractedFrame[] };
  setExtractedFrames: (value: ExtractedFrame[] | ((prev: ExtractedFrame[]) => ExtractedFrame[])) => void;
  setProcessingProgress: (progress: ProcessingProgress) => void;
  notifier: Notifier;
}

export const useDeduplication = ({
  extractedFramesRef,
  setExtractedFrames,
  setProcessingProgress,
  notifier,
}: UseDeduplicationProps) => {
  const performDeduplication = useCallback(
    async (targetGroup: 'group1' | 'group2', groupLabel: string) => {
      // 等待下一个事件循环，避免在渲染期间更新状态
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 使用 ref 获取最新的 extractedFrames
      const currentFrames = extractedFramesRef.current;
      const targetFrames = currentFrames.filter((f) => f.group === targetGroup);

      logger.log(`去重${groupLabel}:`, targetFrames.length, '张图片');

      if (targetFrames.length <= 1) {
        logger.log(`${groupLabel}图片数量不足，跳过去重`);
        return;
      }

      notifier.addToast(`开始自动去重${groupLabel}分组...`, 'info');
      setProcessingProgress({
        current: 0,
        total: 100,
        message: `正在去重${groupLabel}分组...`,
        stage: 'deduplicating',
      });

      try {
        const { removeDuplicatesLoop } = await import('../utils/imageComparisonUtils');

        const imageUrls = targetFrames.map((f) => f.url);
        let totalRemoved = 0;

        // 循环去重，直到移除的重复图片小于1张（去重到无法再去重）
        const keepIndices = await removeDuplicatesLoop(
          imageUrls,
          0.95,
          1,
          (current, total, iteration, removed) => {
            totalRemoved = removed;
            const percent = Math.round((current / total) * 100);
            setProcessingProgress({
              current: percent,
              total: 100,
              message: `去重${groupLabel} - 第${iteration}轮 (${current}/${total}) - 已移除${removed}张`,
              stage: 'deduplicating',
            });
          }
        );

        // 计算要删除的图片
        const allIndices = new Set(targetFrames.map((_, i) => i));
        const keepIndicesSet = new Set(keepIndices);
        const deleteIndices = Array.from(allIndices).filter(
          (i: number) => !keepIndicesSet.has(i)
        );

        if (deleteIndices.length > 0) {
          const idsToDelete = deleteIndices.map((i) => targetFrames[i].id);
          setExtractedFrames((prev) =>
            prev.filter((frame) => !idsToDelete.includes(frame.id))
          );
          setProcessingProgress({
            current: 100,
            total: 100,
            message: `去重${groupLabel}完成！已删除 ${deleteIndices.length} 张`,
            stage: 'deduplicating',
          });
          await new Promise((resolve) => setTimeout(resolve, 1000));
          notifier.addToast(
            `${groupLabel}自动去重完成！已删除 ${deleteIndices.length} 张重复图片，保留 ${keepIndices.length} 张`,
            'success'
          );
        } else {
          setProcessingProgress({
            current: 100,
            total: 100,
            message: `去重${groupLabel}完成 - 未发现重复`,
            stage: 'deduplicating',
          });
          await new Promise((resolve) => setTimeout(resolve, 1000));
          notifier.addToast(`${groupLabel}未发现重复图片`, 'info');
        }
      } catch (error) {
        handleError(error, notifier, {
          context: '自动去重失败',
          userMessage: `${groupLabel}自动去重失败，请手动去重`,
        });
      }
    },
    [extractedFramesRef, setExtractedFrames, setProcessingProgress, notifier]
  );

  return {
    performDeduplication,
  };
};
