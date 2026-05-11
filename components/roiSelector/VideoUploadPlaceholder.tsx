import { UploadCloud } from 'lucide-react';
import React from 'react';
import { VideoFile } from '../../types';
import { useNotifier } from '../Notifications';

interface VideoUploadPlaceholderProps {
  onUpload?: (video: VideoFile) => void;
  className?: string;
}

const getVideoMetadata = (file: File): Promise<VideoFile> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    const onDurationChange = () => {
      if (isFinite(video.duration) && video.duration > 0) {
        cleanup();
        resolve({
          id: Math.random().toString(36).substr(2, 9),
          file,
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
      reject(new Error('Failed to load video'));
      URL.revokeObjectURL(url);
    };
    const cleanup = () => {
      video.removeEventListener('loadeddata', onDurationChange);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('loadeddata', onDurationChange);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('error', onError);
    video.src = url;
    video.load();
  });
};

const VideoUploadPlaceholder: React.FC<VideoUploadPlaceholderProps> = ({ onUpload, className }) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const notifier = useNotifier();

  const processFile = async (file: File) => {
    if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|avi|mov|webm|mkv|m4v)$/i)) {
      notifier.addToast('请选择有效的视频文件', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      const videoData = await getVideoMetadata(file);
      onUpload?.(videoData);
    } catch {
      notifier.addToast('无法读取视频文件，请确保文件格式正确。', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className={`relative rounded-xl overflow-hidden z-10 h-[calc(100vh-400px)] min-h-[400px]${className ? ` ${className}` : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={e => {
          if (e.target.files?.[0]) processFile(e.target.files[0]);
          e.target.value = '';
        }}
      />
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
        onDrop={e => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) processFile(f);
        }}
        className={`
          w-full h-full flex flex-col items-center justify-center gap-4 cursor-pointer
          border-2 border-dashed rounded-xl transition-all duration-150
          ${isDragging
            ? 'border-indigo-400 bg-indigo-50/80'
            : 'border-gray-300 bg-gray-900/5 hover:border-indigo-300 hover:bg-indigo-50/20'
          }
        `}
      >
        {isProcessing ? (
          <>
            <div className="w-16 h-16 rounded-full bg-white/80 flex items-center justify-center shadow-sm">
              <svg className="w-8 h-8 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">正在解析视频...</p>
          </>
        ) : (
          <>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-150 ${isDragging ? 'bg-indigo-100' : 'bg-white/80 shadow-sm'}`}>
              <UploadCloud className={`w-8 h-8 transition-colors duration-150 ${isDragging ? 'text-indigo-500' : 'text-gray-400'}`} />
            </div>
            <div className="text-center">
              <p className="text-base font-medium text-gray-600">
                {isDragging ? '松开以上传视频' : '拖拽视频到此处，或'}
                {!isDragging && (
                  <span className="text-indigo-600 hover:text-indigo-700 ml-1">点击选择文件</span>
                )}
              </p>
              <p className="text-sm text-gray-400 mt-1">支持 MP4、AVI、MOV、MKV、WebM 等格式</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VideoUploadPlaceholder;
