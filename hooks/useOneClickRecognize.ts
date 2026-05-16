import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { ExtractedFrame, MergedImage } from '../types';
import { Notifier } from '../components/Notifications';
import { DEFAULT_MERGE_BATCH_SIZE } from '../config/constants';

interface UseOneClickRecognizeOptions {
  extractedFrames: ExtractedFrame[];
  mergedImages: MergedImage[];
  notifier: Notifier;
  onSetExtractedFrames: (frames: ExtractedFrame[]) => void;
  onSetMergedImages: Dispatch<SetStateAction<MergedImage[]>>;
  onMergeFramesToImages: (
    frames: ExtractedFrame[],
    batchSize: number,
    onProgress: (progress: { completed: number; total: number }) => void
  ) => Promise<MergedImage[]>;
}

export function useOneClickRecognize(options: UseOneClickRecognizeOptions) {
  const {
    extractedFrames,
    mergedImages,
    notifier,
    onSetExtractedFrames,
    onSetMergedImages,
    onMergeFramesToImages,
  } = options;

  const [oneClickProgress, setOneClickProgress] = useState<{
    isLoading: boolean;
    progress: number;
    message: string;
  }>({ isLoading: false, progress: 0, message: '' });

  const handleOneClickRecognize = useCallback(async () => {
    if (extractedFrames.length === 0) return;

    if (mergedImages.length > 0) {
      const choice = await notifier.showChoice({
        title: '已存在拼接图片',
        message: `当前已有 ${mergedImages.length} 张拼接图片，请选择操作方式。`,
        buttons: [
          { label: '移除后拼接', value: 'remove', variant: 'danger' },
          { label: '取消拼接', value: 'cancel', variant: 'default' },
        ],
      });
      if (choice === 'cancel') return;
      if (choice === 'remove') onSetMergedImages([]);
    }

    setOneClickProgress({ isLoading: true, progress: 0, message: '正在合并分组...' });

    const mergedFrames = extractedFrames.map((frame) =>
      frame.group === 'group2' ? { ...frame, group: 'group1' as const } : frame
    );

    onSetExtractedFrames(mergedFrames);
    setOneClickProgress({ isLoading: true, progress: 0, message: '正在拼接图片 0/0...' });

    const newMergedImages = await onMergeFramesToImages(
      mergedFrames,
      DEFAULT_MERGE_BATCH_SIZE,
      ({ completed, total }) => {
        const progress = total > 0 ? Math.floor((completed / total) * 100) : 0;
        setOneClickProgress({
          isLoading: true,
          progress,
          message: `正在拼接图片 ${completed}/${total}...`,
        });
      }
    );

    if (newMergedImages.length === 0) {
      setOneClickProgress({ isLoading: false, progress: 0, message: '' });
      return;
    }

    onSetMergedImages((prev) => [...prev, ...newMergedImages]);
    setOneClickProgress({ isLoading: true, progress: 100, message: '完成！' });

    setTimeout(() => {
      setOneClickProgress({ isLoading: false, progress: 0, message: '' });
    }, 500);

    notifier.addToast('已完成一键拼接：先合并分组，再按默认参数完成图片拼接', 'success');
  }, [extractedFrames, mergedImages, notifier, onSetExtractedFrames, onSetMergedImages, onMergeFramesToImages]);

  return {
    oneClickProgress,
    handleOneClickRecognize,
  };
}
