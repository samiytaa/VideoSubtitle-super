import { useCallback } from 'react';
import { VideoFile } from '../types';
import { Notifier } from '../components/Notifications';
import { handleError } from '../utils/errorHandler';
import { resolveVideoLocalPath } from '../utils/electronFileAccess';
import { confirmDelete } from '../utils/confirmActions';

async function getVideoMetadata(sourceFile: File): Promise<VideoFile> {
  const localPath = await resolveVideoLocalPath(sourceFile);

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(sourceFile);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;

    const buildVideoFile = (): VideoFile => ({
      id: Math.random().toString(36).substr(2, 9),
      file: sourceFile,
      localPath,
      name: sourceFile.name,
      size: sourceFile.size,
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      previewUrl: url,
    });

    const cleanup = () => {
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('error', onError);
    };

    const onLoadedData = () => {
      if (!isFinite(video.duration) || video.duration === 0) return;
      cleanup();
      resolve(buildVideoFile());
    };

    const onDurationChange = () => {
      if (isFinite(video.duration) && video.duration > 0) {
        cleanup();
        resolve(buildVideoFile());
      }
    };

    const onError = () => {
      cleanup();
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load video metadata for ${sourceFile.name}`));
    };

    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('error', onError);
    video.src = url;
    video.load();
  });
}

interface UseVideoUploadOptions {
  notifier: Notifier;
  extractedFramesCount: number;
  onClearFrames: () => void;
  onVideoSet: (video: VideoFile) => void;
  onScrollToRoi: () => void;
}

export function useVideoUpload(options: UseVideoUploadOptions) {
  const { notifier, extractedFramesCount, onClearFrames, onVideoSet, onScrollToRoi } = options;

  const handleVideoUploaded = useCallback(
    async (video: VideoFile) => {
      if (extractedFramesCount > 0) {
        const shouldClear = await confirmDelete(extractedFramesCount, '截取', notifier);

        if (shouldClear) {
          onClearFrames();
        }
      }

      onVideoSet(video);
      onScrollToRoi();
    },
    [extractedFramesCount, notifier, onClearFrames, onVideoSet, onScrollToRoi]
  );

  const handleReplaceVideo = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const videoData = await getVideoMetadata(file);
        handleVideoUploaded(videoData);
      } catch (error) {
        handleError(error, notifier, {
          context: 'Error processing video',
          userMessage: '无法读取视频文件，请确保文件格式正确。',
        });
      }
    };
    input.click();
  }, [handleVideoUploaded, notifier]);

  return {
    handleVideoUploaded,
    handleReplaceVideo,
  };
}
