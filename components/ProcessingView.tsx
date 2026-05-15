import React, { useEffect, useRef, useState } from 'react';
import { ExtractedFrame, ExtractionMode, ExtractionParams, ProgressData, ROI, VideoFile } from '../types';
import { generateFilename, formatTimestampDisplay } from '../utils/filenameUtils';
import { seekVideoToTime, preloadVideo, waitForVideoFrame } from '../utils/videoProcessingUtils';
import { handleError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { resolveBackendVideoPath } from '../utils/backendVideoCache';
import { resolveBackendUrl } from '../utils/runtimeConfig';
import {
  PROCESSING_WEBP_QUALITY,
  PROGRESS_UPDATE_FRAME_INTERVAL,
  PROGRESS_UPDATE_INTERVAL_MS,
} from '../config/constants';

// ─── SRT Parser ───────────────────────────────────────────────────────────────

interface SrtSegment {
  start: number;
  end: number;
  duration: number;
}

const parseSrtToSegments = (content: string): SrtSegment[] => {
  const segments: SrtSegment[] = [];
  const timecodeRegex = /(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/;
  const timeToSeconds = (h: string, m: string, s: string, ms: string) =>
    parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10) + parseInt(ms, 10) / 1000;
  for (const block of content.replace(/\r/g, '').split('\n\n')) {
    if (!block.trim()) continue;
    const match = block.split('\n')[1]?.match(timecodeRegex);
    if (match) {
      const start = timeToSeconds(match[1], match[2], match[3], match[4]);
      const end   = timeToSeconds(match[5], match[6], match[7], match[8]);
      segments.push({ start, end, duration: end - start });
    }
  }
  return segments;
};

const calculateNonSubtitleSegments = (subs: SrtSegment[], duration: number): SrtSegment[] => {
  const result: SrtSegment[] = [];
  let last = 0;
  for (const seg of subs) {
    if (seg.start > last) result.push({ start: last, end: seg.start, duration: seg.start - last });
    last = Math.max(last, seg.end);
  }
  if (last < duration) result.push({ start: last, end: duration, duration: duration - last });
  return result;
};

// ─── WebCodecs ────────────────────────────────────────────────────────────────

const supportsWebCodecs = (): boolean =>
  typeof (window as any).VideoDecoder !== 'undefined' &&
  typeof (window as any).VideoFrame !== 'undefined';

const estimateVideoFps = async (video: HTMLVideoElement): Promise<number> => {
  const fallback = ASSUMED_VIDEO_FPS;
  const rvfc = (video as HTMLVideoElement & {
    requestVideoFrameCallback?: (
      callback: (now: DOMHighResTimeStamp, metadata: { mediaTime: number; presentedFrames?: number }) => void
    ) => number;
    cancelVideoFrameCallback?: (handle: number) => void;
  }).requestVideoFrameCallback;

  if (typeof rvfc !== 'function') return fallback;

  return new Promise<number>((resolve) => {
    let firstTime: number | null = null;
    let firstFrames: number | null = null;
    let done = false;
    let timeoutId: number | null = null;
    let frameHandle: number | null = null;

    const finish = (value: number) => {
      if (done) return;
      done = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (frameHandle !== null) {
        (video as HTMLVideoElement & { cancelVideoFrameCallback?: (handle: number) => void })
          .cancelVideoFrameCallback?.(frameHandle);
      }
      resolve(Number.isFinite(value) && value > 0 ? value : fallback);
    };

    const sample = (_now: DOMHighResTimeStamp, metadata: { mediaTime: number; presentedFrames?: number }) => {
      const mt = metadata.mediaTime;
      const pf = metadata.presentedFrames;
      if (typeof pf === 'number') {
        if (firstTime === null || firstFrames === null) {
          firstTime = mt;
          firstFrames = pf;
          frameHandle = rvfc(sample);
          return;
        }
        const dt = mt - firstTime;
        const df = pf - firstFrames;
        if (dt > 0 && df > 0) {
          finish(df / dt);
          return;
        }
      }
      frameHandle = rvfc(sample);
    };

    frameHandle = rvfc(sample);
    timeoutId = window.setTimeout(() => finish(fallback), 600);
  });
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProcessingViewProps {
  video: VideoFile;
  videoSrc?: string | null;
  roi: ROI;
  params: ExtractionParams;
  /** 每次新任务递增，触发处理逻辑，不再靠销毁/重建组件 */
  taskId: number;
  onComplete: (frames: ExtractedFrame[]) => void;
  onProgress?: (progress: { current: number; total: number; message: string }) => void;
}

type CaptureTask = {
  taskId: number;
  requestedTime: number;
  hasSubtitle: boolean;
};

const ASSUMED_VIDEO_FPS = 30;
const FFMPEG_BATCH_SIZE = 32;
const FFMPEG_CONCURRENCY = Math.min(16, Math.max(6, navigator.hardwareConcurrency || 8));
const sessionVideoBackendPathCache = new Map<string, string>();

const extractFramesWithBackend = async (
  videoPath: string,
  crop: { x: number; y: number; width: number; height: number },
  tasks: CaptureTask[],
  signal: AbortSignal
) => {
  const response = await fetch(resolveBackendUrl('/api/video/extract-frames'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      videoPath,
      crop,
      format: 'webp',
      quality: Math.round(PROCESSING_WEBP_QUALITY * 100),
      concurrency: FFMPEG_CONCURRENCY,
      tasks: tasks.map((task) => ({
        taskId: task.taskId,
        requestedTime: task.requestedTime,
      })),
    }),
    signal,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error || `FFmpeg request failed: ${response.status}`);
  }
  return payload as {
    results: Array<{ taskId: number; requestedTime: number; capturedTime?: number; url: string }>;
  };
};

// ─── Component ────────────────────────────────────────────────────────────────

const ProcessingView: React.FC<ProcessingViewProps> = ({
  video, videoSrc, roi, params, taskId, onComplete, onProgress,
}) => {
  const [_progress, setProgress] = useState<ProgressData>({
    current: 0, total: 100, status: 'idle',
    message: '准备开始处理...',
    currentVideo: video.name, videoIndex: 0, videoTotal: 1,
  });

  // 使用单个video元素，避免多线程seek冲突
  const videoRef  = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── 缓存：避免同一视频/SRT 重复加载 ──────────────────────────────────────────
  const cachedVideoSrcRef    = useRef<string | null>(null);
  const cachedSrtFileRef     = useRef<File | null>(null);
  const cachedSrtSegmentsRef = useRef<SrtSegment[] | null>(null);
  const videoLoadedRef       = useRef(false);

  // ── taskId 变化时触发新任务 ───────────────────────────────────────────────────
  useEffect(() => {
    if (taskId === 0) return; // 初始值，不处理

    // 取消上一个任务
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const run = async () => {
      if (!videoRef.current || !canvasRef.current) return;

        const useWebCodecs = supportsWebCodecs() && typeof OffscreenCanvas !== 'undefined';
        const allExtractedFrames: ExtractedFrame[] = [];
        let measuredFps = ASSUMED_VIDEO_FPS;

      setProgress(p => ({ ...p, status: 'processing', message: '正在初始化...' }));
      onProgress?.({ current: 0, total: 100, message: '正在初始化...' });

      try {
        if (signal.aborted) return;

        // ── 视频加载（缓存复用）──────────────────────────────────────────────────
        const currentSrc = videoSrc ?? video.previewUrl;
        const needReloadVideo = !videoLoadedRef.current || cachedVideoSrcRef.current !== currentSrc;

        if (needReloadVideo) {
          setProgress(p => ({ ...p, current: 0, message: `正在加载视频: ${video.name}` }));
          onProgress?.({ current: 0, total: 100, message: `正在加载视频: ${video.name}` });

          await new Promise<void>((resolve, reject) => {
            const vRef = videoRef.current!;
            if (vRef.src === currentSrc && vRef.readyState >= 1) { resolve(); return; }
            vRef.onloadedmetadata = () => resolve();
            vRef.onerror = () => reject(new Error('视频加载失败'));
            vRef.src = currentSrc;
            vRef.preload = 'auto';
            if (vRef.readyState >= 1) resolve();
          });

          try {
            await preloadVideo(videoRef.current);
          } catch (e) {
            logger.warn('视频预加载失败，继续处理:', e);
          }

          cachedVideoSrcRef.current = currentSrc;
          videoLoadedRef.current    = true;
        }

        try {
          measuredFps = await estimateVideoFps(videoRef.current);
        } catch (e) {
          logger.warn('读取视频帧率失败，回退默认帧率:', e);
          measuredFps = ASSUMED_VIDEO_FPS;
        }

        // ── SRT 解析（缓存复用）──────────────────────────────────────────────────
        let srtSegments: SrtSegment[] = [];
        if (params.srtFile) {
          if (cachedSrtFileRef.current === params.srtFile && cachedSrtSegmentsRef.current) {
            // 同一个 File 对象，直接复用解析结果
            srtSegments = cachedSrtSegmentsRef.current;
          } else {
            setProgress(p => ({ ...p, message: '正在解析 SRT 字幕文件...' }));
            onProgress?.({ current: 0, total: 100, message: '正在解析 SRT 字幕文件...' });
            srtSegments = parseSrtToSegments(await params.srtFile.text());
            cachedSrtFileRef.current     = params.srtFile;
            cachedSrtSegmentsRef.current = srtSegments;
          }
        }

        if (signal.aborted) return;

        // ── 计算时间戳 ────────────────────────────────────────────────────────────
        let captureTasks: CaptureTask[] = [];
        const start = Math.max(0, params.startTime);
        const end   = params.endTime > 0
          ? Math.min(params.endTime, videoRef.current.duration)
          : videoRef.current.duration;

        if (params.mode === ExtractionMode.SRT) {
          const non_subtitle_segments = srtSegments.length > 0
            ? calculateNonSubtitleSegments(srtSegments, video.duration)
            : [{ start: 0, end: video.duration, duration: video.duration }];

          const clip = (segs: SrtSegment[]) => segs
            .filter(s => s.end > start && s.start < end)
            .map(s => ({
              start: Math.max(s.start, start),
              end:   Math.min(s.end, end),
              duration: Math.min(s.end, end) - Math.max(s.start, start),
            }));

          const validSubs    = clip(srtSegments);
          const validNonSubs = clip(non_subtitle_segments);

          const frameDuration = 1 / ASSUMED_VIDEO_FPS;
          const gapInterval =
            (params.srtNonSubtitleFrameInterval && params.srtNonSubtitleFrameInterval > 0
              ? params.srtNonSubtitleFrameInterval * frameDuration : undefined) ||
            (params.srtNonSubtitleInterval && params.srtNonSubtitleInterval > 0
              ? params.srtNonSubtitleInterval : undefined);

          interface TWType { time: number; hasSubtitle: boolean; }
          const twt: TWType[] = [];

          if (!params.skipSubtitleRegions) {
            validSubs.forEach(seg => {
              const t = Math.max(seg.start, Math.min(seg.end - (params.framesBeforeEnd || 5) * frameDuration, seg.end));
              if (t >= start && t <= end) twt.push({ time: t, hasSubtitle: true });
            });
          }
          if (gapInterval && gapInterval > 0) {
            for (const gap of validNonSubs) {
              if (gap.duration >= (params.minSrtGapDuration || 0)) {
                for (let t = gap.start; t < gap.end; t += gapInterval) twt.push({ time: t, hasSubtitle: false });
              }
            }
          }

          twt.sort((a, b) => a.time - b.time);
          const seen = new Set<number>();
          const unique: TWType[] = [];
          twt.forEach(item => {
            const r = Math.round(item.time * 1000) / 1000;
            if (!seen.has(r)) { seen.add(r); unique.push({ time: r, hasSubtitle: item.hasSubtitle }); }
          });
          captureTasks = unique.map((i, idx) => ({
            taskId: idx,
            requestedTime: i.time,
            hasSubtitle: i.hasSubtitle,
          }));

        } else if (params.mode === ExtractionMode.FRAME) {
          const frameStep = Math.max(1, Math.round(params.interval || 1));
          const fps = measuredFps > 0 ? measuredFps : ASSUMED_VIDEO_FPS;
          const step = frameStep / fps;
          let i = 0;
          if (step > 0) {
            for (let t = start; t < end; t += step) {
              captureTasks.push({ taskId: i++, requestedTime: t, hasSubtitle: false });
            }
          }
        } else {
          const interval = Math.max(0.1, params.interval);
          let i = 0;
          for (let t = start; t < end; t += interval) {
            captureTasks.push({ taskId: i++, requestedTime: t, hasSubtitle: false });
          }
        }

        if (captureTasks.length === 0) throw new Error('在指定范围内没有可截取的帧');

        // 按时间排序，顺序处理
        captureTasks.sort((a, b) => a.requestedTime - b.requestedTime);
        let totalFrames = captureTasks.length;
        const prepareMessage = params.mode === ExtractionMode.SRT
          ? `已解析 SRT，准备截取 ${totalFrames} 帧...`
          : `已生成截图时间点，准备截取 ${totalFrames} 帧...`;
        setProgress(p => ({ ...p, current: 0, message: prepareMessage }));
        onProgress?.({ current: 0, total: 100, message: prepareMessage });

        // ── 预配置 canvas 尺寸 ────────────────────────────────────────────────────
        const vRef = videoRef.current;
        const cRef = canvasRef.current;
        const cropX = Math.round((roi.x / 100) * vRef.videoWidth);
        const cropY = Math.round((roi.y / 100) * vRef.videoHeight);
        const cropW = Math.max(1, Math.round((roi.width / 100) * vRef.videoWidth));
        const cropH = Math.max(1, Math.round((roi.height / 100) * vRef.videoHeight));

        cRef.width = cropW;
        cRef.height = cropH;
        const canvasCtx = cRef.getContext('2d', {
          alpha: false,
          willReadFrequently: false,
          desynchronized: true,
        }) as CanvasRenderingContext2D | null;

        if (!canvasCtx) {
          throw new Error('无法创建 Canvas 上下文');
        }

        // WebCodecs：创建 OffscreenCanvas
        let offscreen: OffscreenCanvas | null = null;
        let offCtx: OffscreenCanvasRenderingContext2D | null = null;
        if (useWebCodecs) {
          offscreen = new OffscreenCanvas(cropW, cropH);
          offCtx = offscreen.getContext('2d', { alpha: false }) as OffscreenCanvasRenderingContext2D | null;
        }

        const t0 = Date.now();
        let processedCount = 0;
        let lastProgressUpdate = 0;
        const WEBP_QUALITY = PROCESSING_WEBP_QUALITY;
        const browserModeLabel = useWebCodecs ? 'WebCodecs' : 'Canvas';
        const currentGroup = params.selectedGroup || 'group1';
        const ffmpegCrop = { x: cropX, y: cropY, width: cropW, height: cropH };

        const updateProgress = (processed: number, now: number, mode: 'ffmpeg' | 'browser') => {
          const percent   = Math.round((processed / totalFrames) * 100);
          const elapsed   = (now - t0) / 1000;
          const speed     = elapsed > 0 ? processed / elapsed : 0;
          const remaining = speed > 0 ? (totalFrames - processed) / speed : 0;
          const speedText = speed <= 0 ? '计算中' : speed >= 1 ? `${speed.toFixed(1)} 帧/秒` : `${(60 / speed).toFixed(1)} 秒/帧`;
          const remText   = remaining < 60 ? `剩余 ${Math.ceil(remaining)} 秒` : `剩余 ${Math.ceil(remaining / 60)} 分钟`;
          const prefix = mode === 'ffmpeg' ? 'FFmpeg截取' : `单线程${browserModeLabel}截取`;
          const msg = `${prefix} (${processed}/${totalFrames}) - ${speedText} - ${remText}`;
          setProgress(p => ({ ...p, current: percent, message: msg }));
          onProgress?.({ current: percent, total: 100, message: msg });
        };

        let backendVideoPath = sessionVideoBackendPathCache.get(video.id) ?? video.localPath;
        if (!backendVideoPath && video.file) {
          try {
            setProgress(p => ({ ...p, message: '正在上传视频到本地处理服务...' }));
            onProgress?.({ current: 0, total: 100, message: '正在上传视频到本地处理服务...' });
            backendVideoPath = await resolveBackendVideoPath(video.file, signal);
            if (backendVideoPath) {
              sessionVideoBackendPathCache.set(video.id, backendVideoPath);
            }
          } catch (error) {
            logger.warn('上传视频到后端缓存失败，回退到浏览器截图流程:', error);
          }
        } else if (backendVideoPath) {
          sessionVideoBackendPathCache.set(video.id, backendVideoPath);
        }

        if (backendVideoPath) {
          try {
            const ffmpegFrames: ExtractedFrame[] = [];
            const completedTaskIds = new Set<number>();
            for (let startIndex = 0; startIndex < captureTasks.length; startIndex += FFMPEG_BATCH_SIZE) {
              if (signal.aborted) break;

              const batch = captureTasks.slice(startIndex, startIndex + FFMPEG_BATCH_SIZE);
              const payload = await extractFramesWithBackend(backendVideoPath, ffmpegCrop, batch, signal);
              const resultMap = new Map(payload.results.map((item) => [item.taskId, item]));

              for (const task of batch) {
                const result = resultMap.get(task.taskId);
                if (!result?.url) continue;
                completedTaskIds.add(task.taskId);
                const capturedTime = result.capturedTime ?? task.requestedTime;
                const driftMs = Math.round((capturedTime - task.requestedTime) * 1000);
                ffmpegFrames.push({
                  id: `${video.id}_${currentGroup}_${runId}_${task.taskId}`,
                  url: result.url,
                  timestamp: formatTimestampDisplay(capturedTime),
                  filename: generateFilename(capturedTime, task.hasSubtitle ? 'sub' : 'nosub', 'webp', currentGroup),
                  videoName: video.name,
                  group: currentGroup,
                  requestedTime: task.requestedTime,
                  capturedTime,
                  driftMs,
                });
              }

              processedCount = ffmpegFrames.length;
              updateProgress(processedCount, Date.now(), 'ffmpeg');
            }

            if (!signal.aborted) {
              allExtractedFrames.push(...ffmpegFrames);
              const missingTasks = captureTasks.filter((task) => !completedTaskIds.has(task.taskId));
              if (missingTasks.length === 0) {
                setProgress(p => ({ ...p, status: 'done', current: 100, message: 'FFmpeg 截取完成！' }));
                onProgress?.({ current: 100, total: 100, message: 'FFmpeg 截取完成！' });
                onComplete(allExtractedFrames);
                return;
              }

              logger.warn(`FFmpeg 漏返回 ${missingTasks.length} 帧，回退浏览器补截缺失帧`);
              captureTasks = missingTasks;
              totalFrames = captureTasks.length;
              processedCount = 0;
              lastProgressUpdate = 0;
              setProgress(p => ({ ...p, current: 0, message: `FFmpeg 漏返回 ${missingTasks.length} 帧，正在补截...` }));
              onProgress?.({ current: 0, total: 100, message: `FFmpeg 漏返回 ${missingTasks.length} 帧，正在补截...` });
            }
          } catch (error) {
            logger.warn('FFmpeg 截取失败，回退到浏览器截图流程:', error);
            setProgress(p => ({ ...p, current: 0, message: 'FFmpeg 截取失败，回退到浏览器截图...' }));
            onProgress?.({ current: 0, total: 100, message: 'FFmpeg 截取失败，回退到浏览器截图...' });
          }
        } else {
          logger.warn('未获取到视频本地路径，回退到浏览器截图流程');
        }

        // ── 顺序处理所有帧 ────────────────────────────────────────────────────────
        for (const task of captureTasks) {
          if (signal.aborted) break;

          let dataUrl: string;
          let capturedTime = task.requestedTime;

          try {
            // 精确seek到目标时间
            capturedTime = await seekVideoToTime(vRef, task.requestedTime, 1000);
            
            // 等待视频帧真正完成渲染，避免固定双 rAF 带来的额外延迟
            await waitForVideoFrame(vRef);

            if (useWebCodecs && offscreen && offCtx) {
              // WebCodecs路径
              try {
                const frame = new (window as any).VideoFrame(vRef);
                offCtx.drawImage(frame, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
                frame.close();
                const blob = await offscreen.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY });
                dataUrl = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });
              } catch {
                // 降级到Canvas
                canvasCtx.drawImage(vRef, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
                dataUrl = cRef.toDataURL('image/webp', WEBP_QUALITY);
              }
            } else {
              // 普通Canvas路径
              canvasCtx.drawImage(vRef, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
              dataUrl = cRef.toDataURL('image/webp', WEBP_QUALITY);
            }
          } catch (err) {
            logger.error('截图失败:', err);
            continue;
          }

          const driftMs = Math.round((capturedTime - task.requestedTime) * 1000);
          allExtractedFrames.push({
            id: `${video.id}_${currentGroup}_${runId}_${task.taskId}`,
            url: dataUrl,
            timestamp: formatTimestampDisplay(capturedTime),
            filename: generateFilename(capturedTime, task.hasSubtitle ? 'sub' : 'nosub', 'webp', currentGroup),
            videoName: video.name,
            group: currentGroup,
            requestedTime: task.requestedTime,
            capturedTime,
            driftMs,
          });

          processedCount++;
          const now = Date.now();
          if (
            processedCount % PROGRESS_UPDATE_FRAME_INTERVAL === 0 ||
            processedCount === totalFrames ||
            now - lastProgressUpdate > PROGRESS_UPDATE_INTERVAL_MS
          ) {
            lastProgressUpdate = now;
            updateProgress(processedCount, now, 'browser');
          }
        }

        if (!signal.aborted) {
          setProgress(p => ({ ...p, status: 'done', current: 100, message: '处理完成！' }));
          onProgress?.({ current: 100, total: 100, message: '处理完成！' });
          onComplete(allExtractedFrames);
        }

      } catch (err: any) {
        if (signal.aborted) return;
        handleError(err, undefined, { context: 'ProcessingView failed' });
        setProgress(p => ({ ...p, status: 'error', message: err.message || '未知错误' }));
      }
    };

    run();

    return () => { abortControllerRef.current?.abort(); };
  }, [taskId]); // 只监听 taskId，视频/SRT 变化由内部缓存判断

  // 视频源变化时清除视频缓存标记（但不销毁组件）
  useEffect(() => {
    videoLoadedRef.current    = false;
    cachedVideoSrcRef.current = null;
  }, [videoSrc, video.id]);

  // SRT 文件变化时清除 SRT 缓存
  useEffect(() => {
    if (params.srtFile !== cachedSrtFileRef.current) {
      cachedSrtFileRef.current     = null;
      cachedSrtSegmentsRef.current = null;
    }
  }, [params.srtFile]);

  return (
    <div className="hidden">
      <video ref={videoRef} muted crossOrigin="anonymous" />
      <canvas ref={canvasRef} />
    </div>
  );
};

export default ProcessingView;
