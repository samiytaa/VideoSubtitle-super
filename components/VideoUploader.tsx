import React, { useState, useRef, useCallback } from 'react';
import { Film, Loader2, UploadCloud, X } from 'lucide-react';
import { VideoFile } from '../types';
import { useNotifier } from './Notifications';
import { handleError } from '../utils/errorHandler';
import { resolveVideoLocalPath } from '../utils/electronFileAccess';

interface VideoUploaderProps {
  onUpload: (video: VideoFile) => void;
  currentVideo?: VideoFile | null;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

const VideoUploader: React.FC<VideoUploaderProps> = ({ onUpload, currentVideo }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedVideo, setUploadedVideo] = useState<VideoFile | null>(currentVideo ?? null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentUrlRef = useRef<string | null>(null);
  const notifier = useNotifier();

  // 当外部 currentVideo 变化时同步内部状态（例如 tab 切换后组件重新挂载）
  React.useEffect(() => {
    if (currentVideo && !uploadedVideo) {
      setUploadedVideo(currentVideo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideo]);

  React.useEffect(() => {
    return () => {
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
        currentUrlRef.current = null;
      }
    };
  }, []);

  const getVideoMetadata = async (file: File): Promise<VideoFile> => {
    const localPath = await resolveVideoLocalPath(file);

    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;

      const onLoadedData = () => {
        if (!isFinite(video.duration) || video.duration === 0) return;
        cleanup();
        resolve({
          id: Math.random().toString(36).substr(2, 9),
          file,
          localPath,
          name: file.name,
          size: file.size,
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          previewUrl: url,
        });
      };

      const onDurationChange = () => {
        if (isFinite(video.duration) && video.duration > 0) {
          cleanup();
          resolve({
            id: Math.random().toString(36).substr(2, 9),
            file,
            localPath,
            name: file.name,
            size: file.size,
            duration: video.duration,
            width: video.videoWidth,
            height: video.videoHeight,
            previewUrl: url,
          });
        }
      };

      const onError = () => {
        cleanup();
        reject(new Error(`Failed to load video metadata for ${file.name}`));
        URL.revokeObjectURL(url);
      };

      const cleanup = () => {
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('durationchange', onDurationChange);
        video.removeEventListener('error', onError);
      };

      video.addEventListener('loadeddata', onLoadedData);
      video.addEventListener('durationchange', onDurationChange);
      video.addEventListener('error', onError);
      video.src = url;
      video.load();
    });
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|avi|mov|webm|mkv|m4v)$/i)) {
      notifier.addToast('请选择有效的视频文件', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const videoData = await getVideoMetadata(file);
      if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = videoData.previewUrl;
      setUploadedVideo(videoData);
      onUpload(videoData);
    } catch (error) {
      handleError(error, notifier, {
        context: 'Error processing video',
        userMessage: '无法读取视频文件，请确保文件格式正确。',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0]);
    // 重置 input，允许重复选同一文件
    e.target.value = '';
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, []);

  const handleReplace = (e: React.MouseEvent) => {
    e.stopPropagation();
    inputRef.current?.click();
  };

  // 已上传状态
  if (uploadedVideo && !isProcessing) {
    return (
      <div className="w-full">
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
          {/* 图标 */}
          <div className="shrink-0 w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Film className="w-5 h-5 text-indigo-600" />
          </div>

          {/* 文件信息 */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{uploadedVideo.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-500">{formatSize(uploadedVideo.size)}</span>
              <span className="text-xs text-gray-300">·</span>
              <span className="text-xs text-gray-500">{formatDuration(uploadedVideo.duration)}</span>
              {uploadedVideo.width > 0 && (
                <>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-500">{uploadedVideo.width}×{uploadedVideo.height}</span>
                </>
              )}
            </div>
          </div>

          {/* 替换按钮 */}
          <button
            onClick={handleReplace}
            className="shrink-0 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors duration-150"
          >
            替换
          </button>
        </div>
      </div>
    );
  }

  // 上传中状态
  if (isProcessing) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-center gap-3 px-4 py-5 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
          <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
          <span className="text-sm text-gray-500">正在解析视频...</span>
        </div>
      </div>
    );
  }

  // 默认：拖拽上传区域
  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center gap-2 px-6 py-8
          border-2 border-dashed rounded-xl cursor-pointer
          transition-all duration-150
          ${isDragging
            ? 'border-indigo-400 bg-indigo-50/60 scale-[1.01]'
            : 'border-gray-200 bg-gray-50/50 hover:border-indigo-300 hover:bg-indigo-50/30'
          }
        `}
      >
        {/* 图标 */}
        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-150 ${isDragging ? 'bg-indigo-100' : 'bg-white shadow-sm'}`}>
          <UploadCloud className={`w-6 h-6 transition-colors duration-150 ${isDragging ? 'text-indigo-500' : 'text-gray-400'}`} />
        </div>

        {/* 文字 */}
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">
            {isDragging ? '松开以上传视频' : '拖拽视频到此处，或'}
            {!isDragging && (
              <span className="text-indigo-600 hover:text-indigo-700 ml-1">点击选择文件</span>
            )}
          </p>
          <p className="text-xs text-gray-400 mt-1">支持 MP4、AVI、MOV、MKV、WebM 等格式</p>
        </div>
      </div>
    </div>
  );
};

export default VideoUploader;
