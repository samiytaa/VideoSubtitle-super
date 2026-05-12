import { useCallback, useEffect, useRef, useState } from 'react';
import { ExtractedFrame, MergedImage } from '../types';
import {
  loadExtractedFrames,
  loadMergedImages,
  saveExtractedFrames,
  saveMergedImages,
} from '../utils/storageUtils';
import { batchMergeImages } from '../utils/imageUtils';
import { parseTimestampFilename } from '../utils/filenameUtils';
import { Notifier } from '../components/Notifications';
import { handleError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { DEFAULT_MERGE_BATCH_SIZE } from '../config/constants';

export const useFrameManagement = (notifier: Notifier) => {
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([]);
  const [mergedImages, setMergedImages] = useState<MergedImage[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const extractedFramesRef = useRef<ExtractedFrame[]>([]);
  const saveFramesTokenRef = useRef(0);
  const saveMergedTokenRef = useRef(0);

  // 同步 state 到 ref
  useEffect(() => {
    extractedFramesRef.current = extractedFrames;
  }, [extractedFrames]);

  // 从 IndexedDB 加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        const [frames, images] = await Promise.all([
          loadExtractedFrames(),
          loadMergedImages(),
        ]);

        if (frames.length > 0 || images.length > 0) {
          logger.log(
            `从 IndexedDB 恢复数据: ${frames.length} 张截取图片, ${images.length} 张拼接图片`
          );
        }

        setExtractedFrames(frames);
        setMergedImages(images);
        setIsDataLoaded(true);
      } catch (error) {
        handleError(error, notifier, {
          context: 'Failed to load data from IndexedDB',
          userMessage: '加载本地数据失败，将使用空数据继续。',
        });
        setIsDataLoaded(true);
      }
    };
    loadData();
  }, []);

  // 保存 extractedFrames 到 IndexedDB
  useEffect(() => {
    if (!isDataLoaded) return;
    const token = ++saveFramesTokenRef.current;
    const snapshot = extractedFrames;
    const saveData = async () => {
      try {
        await saveExtractedFrames(snapshot);
        if (token !== saveFramesTokenRef.current) return;
      } catch (error) {
        handleError(error, notifier, {
          context: 'Failed to save extracted frames to IndexedDB',
        });
      }
    };
    saveData();
  }, [extractedFrames, isDataLoaded]);

  // 保存 mergedImages 到 IndexedDB
  useEffect(() => {
    if (!isDataLoaded) return;
    const token = ++saveMergedTokenRef.current;
    const snapshot = mergedImages;
    const saveData = async () => {
      try {
        await saveMergedImages(snapshot);
        if (token !== saveMergedTokenRef.current) return;
      } catch (error) {
        handleError(error, notifier, {
          context: 'Failed to save merged images to IndexedDB',
        });
      }
    };
    saveData();
  }, [mergedImages, isDataLoaded]);

  const handleFrameCaptured = useCallback((frame: ExtractedFrame) => {
    setExtractedFrames((prev) => [...prev, frame]);
  }, []);

  const handleDeleteFrames = useCallback((ids: string[]) => {
    setExtractedFrames((prev) => prev.filter((frame) => !ids.includes(frame.id)));
  }, []);

  const handleImportFrames = useCallback((frames: ExtractedFrame[]) => {
    setExtractedFrames((prev) => [...prev, ...frames]);
  }, []);

  const handleImportMerged = useCallback((images: MergedImage[]) => {
    setMergedImages((prev) => [...prev, ...images]);
  }, []);

  const handleMergeGroups = useCallback(
    (sourceGroup: 'group1' | 'group2', targetGroup: 'group1' | 'group2') => {
      if (sourceGroup === targetGroup) return;

      setExtractedFrames((prev) =>
        prev.map((frame) => {
          if (frame.group === sourceGroup) {
            return {
              ...frame,
              group: targetGroup,
            };
          }
          return frame;
        })
      );
    },
    []
  );

  const mergeFramesToImages = useCallback(
    async (selectedFrames: ExtractedFrame[], batchSize: number = DEFAULT_MERGE_BATCH_SIZE) => {
      if (selectedFrames.length === 0) return [] as MergedImage[];

      try {
        const sortedFrames = [...selectedFrames].sort((a, b) => {
          const timeA = parseTimestampFilename(a.filename) || 0;
          const timeB = parseTimestampFilename(b.filename) || 0;

          if (timeA !== timeB) {
            return timeA - timeB;
          }

          const hasG2PrefixA = a.filename.startsWith('g2_');
          const hasG2PrefixB = b.filename.startsWith('g2_');

          if (hasG2PrefixA && !hasG2PrefixB) return -1;
          if (!hasG2PrefixA && hasG2PrefixB) return 1;

          return 0;
        });

        const imageUrls = sortedFrames.map((frame) => frame.url);
        const mergedUrls = await batchMergeImages(imageUrls, batchSize, {
          alignment: 'center',
          backgroundColor: '#000000',
          gap: 0,
        });

        const timestamp = new Date().getTime();
        const newMergedImages: MergedImage[] = mergedUrls.map((url, index) => ({
          id: `merged_${timestamp}_${index}`,
          url,
          width: 0,
          height: 0,
          filename: `merged_batch${index + 1}_${timestamp}.png`,
        }));

        await Promise.all(
          newMergedImages.map((merged) => {
            return new Promise<void>((resolve) => {
              const img = new Image();
              img.onload = () => {
                merged.width = img.width;
                merged.height = img.height;
                resolve();
              };
              img.src = merged.url;
            });
          })
        );

        return newMergedImages;
      } catch (error) {
        handleError(error, notifier, {
          context: 'Merge failed',
          userMessage: '拼接失败，请重试。',
        });
        return [];
      }
    },
    [notifier]
  );

  const handleMergeImages = useCallback(
    async (selectedFrames: ExtractedFrame[], batchSize: number = DEFAULT_MERGE_BATCH_SIZE) => {
      const newMergedImages = await mergeFramesToImages(selectedFrames, batchSize);
      if (newMergedImages.length === 0) return;

      setMergedImages((prev) => [...prev, ...newMergedImages]);
    },
    [mergeFramesToImages]
  );

  return {
    // State
    extractedFrames,
    mergedImages,
    isDataLoaded,
    extractedFramesRef,

    // Setters
    setExtractedFrames,
    setMergedImages,

    // Handlers
    handleFrameCaptured,
    handleDeleteFrames,
    handleImportFrames,
    handleImportMerged,
    handleMergeGroups,
    mergeFramesToImages,
    handleMergeImages,
  };
};
