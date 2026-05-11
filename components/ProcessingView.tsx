import React, { useEffect, useRef, useState } from 'react';
import { ExtractedFrame, ExtractionMode, ExtractionParams, ProgressData, ROI, VideoFile } from '../types';
import { generateFilename, formatTimestampDisplay } from '../utils/filenameUtils';
import { seekVideoToTime, preloadVideo } from '../utils/videoProcessingUtils';

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

const captureFrameWithWebCodecs = async (
  video: HTMLVideoElement,
  time: number,
  cropX: number, cropY: number, cropW: number, cropH: number,
  offscreen: OffscreenCanvas,
  ctx: OffscreenCanvasRenderingContext2D,
  quality: number
): Promise<string> => {
  await seekVideoToTime(video, time, 500);
  const frame = new (window as any).VideoFrame(video);
  ctx.drawImage(frame, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  frame.close();
  const blob = await offscreen.convertToBlob({ type: 'image/webp', quality });
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
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

// ─── Component ────────────────────────────────────────────────────────────────

const ProcessingView: React.FC<ProcessingViewProps> = ({
  video, videoSrc, roi, params, taskId, onComplete, onProgress,
}) => {
  const [_progress, setProgress] = useState<ProgressData>({
    current: 0, total: 100, status: 'idle',
    message: '准备开始处理...',
    currentVideo: video.name, videoIndex: 0, videoTotal: 1,
  });

  // 动态并行数
  const PARALLEL = Math.min(16, Math.max(8, (navigator.hardwareConcurrency ?? 4) * 2));

  const videoRefs  = useRef<(HTMLVideoElement | null)[]>(Array(PARALLEL).fill(null));
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>(Array(PARALLEL).fill(null));
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── 缓存：避免同一视频/SRT 重复加载 ──────────────────────────────────────────
  const cachedVideoSrcRef    = useRef<string | null>(null);
  const cachedSrtFileRef     = useRef<File | null>(null);
  const cachedSrtSegmentsRef = useRef<SrtSegment[] | null>(null);
  const videosLoadedRef      = useRef(false);

  // ── taskId 变化时触发新任务 ───────────────────────────────────────────────────
  useEffect(() => {
    if (taskId === 0) return; // 初始值，不处理

    // 取消上一个任务
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const run = async () => {
      const allRefsValid = videoRefs.current.slice(0, PARALLEL).every(v => v !== null) &&
                           canvasRefs.current.slice(0, PARALLEL).every(c => c !== null);
      if (!allRefsValid) return;

      const useWebCodecs = supportsWebCodecs() && typeof OffscreenCanvas !== 'undefined';
      const allExtractedFrames: ExtractedFrame[] = [];

      setProgress(p => ({ ...p, status: 'processing', message: '正在初始化...' }));
      onProgress?.({ current: 0, total: 100, message: '正在初始化...' });

      try {
        if (signal.aborted) return;

        // ── 视频加载（缓存复用）──────────────────────────────────────────────────
        const currentSrc = videoSrc ?? video.previewUrl;
        const needReloadVideo = !videosLoadedRef.current || cachedVideoSrcRef.current !== currentSrc;

        if (needReloadVideo) {
          setProgress(p => ({ ...p, current: 0, message: `正在加载视频: ${video.name}` }));
          onProgress?.({ current: 0, total: 100, message: `正在加载视频: ${video.name}` });

          await Promise.all(
            videoRefs.current.slice(0, PARALLEL).map((videoRef, index) =>
              new Promise<void>((resolve, reject) => {
                if (!videoRef) return reject(new Error(`视频引用 ${index} 不存在`));
                if (videoRef.src === currentSrc && videoRef.readyState >= 1) { resolve(); return; }
                videoRef.onloadedmetadata = () => resolve();
                videoRef.onerror = () => reject(new Error(`视频 ${index} 加载失败`));
                videoRef.src = currentSrc;
                videoRef.preload = 'auto';
                if (videoRef.readyState >= 1) resolve();
              })
            )
          );

          try {
            await Promise.all(
              videoRefs.current.slice(0, PARALLEL).map(v => v ? preloadVideo(v) : Promise.resolve())
            );
          } catch (e) {
            console.warn('视频预加载失败，继续处理:', e);
          }

          cachedVideoSrcRef.current = currentSrc;
          videosLoadedRef.current   = true;
        }
        // 视频已缓存，直接跳过加载，无需任何等待

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
        let timestamps: number[] = [];
        let timestampTypes = new Map<number, boolean>();
        const start = Math.max(0, params.startTime);
        const end   = params.endTime > 0
          ? Math.min(params.endTime, videoRefs.current[0]!.duration)
          : videoRefs.current[0]!.duration;

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

          const VIDEO_FPS    = 30;
          const frameDuration = 1 / VIDEO_FPS;
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
          timestamps = unique.map(i => i.time);
          unique.forEach(i => timestampTypes.set(i.time, i.hasSubtitle));

        } else if (params.mode === ExtractionMode.FRAME) {
          const count = Math.max(1, params.maxFrames);
          const step  = (end - start) / count;
          if (step > 0) for (let i = 0; i < count; i++) timestamps.push(start + i * step);
        } else {
          const interval = Math.max(0.1, params.interval);
          for (let t = start; t < end; t += interval) timestamps.push(t);
        }

        if (timestamps.length === 0) throw new Error('在指定范围内没有可截取的帧');

        // ── 分配任务：按时间排序后均分，减少 seek 跨度 ───────────────────────────
        const sorted = timestamps
          .map((time, index) => ({ time, originalIndex: index }))
          .sort((a, b) => a.time - b.time);

        const totalFrames = sorted.length;
        const chunkSize   = Math.ceil(totalFrames / PARALLEL);
        const chunks: Array<{ time: number; originalIndex: number }[]> = [];
        for (let c = 0; c < PARALLEL; c++) {
          chunks.push(sorted.slice(c * chunkSize, (c + 1) * chunkSize));
        }

        // ── 预配置 canvas 尺寸 ────────────────────────────────────────────────────
        const vid   = videoRefs.current[0]!;
        const cropX = (roi.x      / 100) * vid.videoWidth;
        const cropY = (roi.y      / 100) * vid.videoHeight;
        const cropW = (roi.width  / 100) * vid.videoWidth;
        const cropH = (roi.height / 100) * vid.videoHeight;

        canvasRefs.current.slice(0, PARALLEL).forEach(canvas => {
          if (canvas) { canvas.width = cropW; canvas.height = cropH; }
        });

        // WebCodecs：为每个线程创建 OffscreenCanvas
        const offscreens: (OffscreenCanvas | null)[] = Array(PARALLEL).fill(null);
        const offCtxs: (OffscreenCanvasRenderingContext2D | null)[] = Array(PARALLEL).fill(null);
        if (useWebCodecs) {
          for (let i = 0; i < PARALLEL; i++) {
            const oc   = new OffscreenCanvas(cropW, cropH);
            const octx = oc.getContext('2d', { alpha: false }) as OffscreenCanvasRenderingContext2D | null;
            offscreens[i] = oc;
            offCtxs[i]    = octx;
          }
        }

        const t0 = Date.now();
        let processedCount     = 0;
        let lastProgressUpdate = 0;
        const WEBP_QUALITY     = 0.82;
        const modeLabel        = useWebCodecs ? 'WebCodecs' : 'Canvas';

        const updateProgress = (processed: number, now: number) => {
          const percent   = Math.round((processed / totalFrames) * 100);
          const elapsed   = (now - t0) / 1000;
          const speed     = elapsed > 0 ? processed / elapsed : 0;
          const remaining = speed > 0 ? (totalFrames - processed) / speed : 0;
          const speedText = speed >= 1 ? `${speed.toFixed(1)} 帧/秒` : `${(60 / speed).toFixed(1)} 秒/帧`;
          const remText   = remaining < 60 ? `剩余 ${Math.ceil(remaining)} 秒` : `剩余 ${Math.ceil(remaining / 60)} 分钟`;
          const msg = `${PARALLEL}线程${modeLabel}截取 (${processed}/${totalFrames}) - ${speedText} - ${remText}`;
          setProgress(p => ({ ...p, current: percent, message: msg }));
          onProgress?.({ current: percent, total: 100, message: msg });
        };

        // ── 单线程处理函数 ────────────────────────────────────────────────────────
        const processChunk = async (
          chunkIndex: number,
          chunk: { time: number; originalIndex: number }[]
        ) => {
          const videoRef  = videoRefs.current[chunkIndex];
          const canvasRef = canvasRefs.current[chunkIndex];
          if (!videoRef || !canvasRef) return;

          const currentGroup = params.selectedGroup || 'group1';
          const chunkFrames: ExtractedFrame[] = [];

          // WebCodecs 路径
          if (useWebCodecs && offscreens[chunkIndex] && offCtxs[chunkIndex]) {
            const oc   = offscreens[chunkIndex]!;
            const octx = offCtxs[chunkIndex]!;
            for (const { time, originalIndex } of chunk) {
              if (signal.aborted) return;
              let dataUrl: string;
              try {
                dataUrl = await captureFrameWithWebCodecs(videoRef, time, cropX, cropY, cropW, cropH, oc, octx, WEBP_QUALITY);
              } catch {
                await seekVideoToTime(videoRef, time, 500);
                const ctx2d = canvasRef.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
                ctx2d.drawImage(videoRef, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
                dataUrl = canvasRef.toDataURL('image/webp', WEBP_QUALITY);
              }
              const hasSubtitle = timestampTypes.get(time) ?? false;
              chunkFrames.push({
                id: `${video.id}_${currentGroup}_${originalIndex}`,
                url: dataUrl,
                timestamp: formatTimestampDisplay(time),
                filename: generateFilename(time, hasSubtitle ? 'sub' : 'nosub', 'webp', currentGroup),
                videoName: video.name,
                group: currentGroup,
              });
              processedCount++;
              const now = Date.now();
              if (processedCount % 50 === 0 || processedCount === totalFrames || now - lastProgressUpdate > 500) {
                lastProgressUpdate = now;
                updateProgress(processedCount, now);
              }
            }
            return chunkFrames;
          }

          // 普通 Canvas 路径
          const ctx = canvasRef.getContext('2d', { alpha: false, willReadFrequently: false, desynchronized: true } as any);
          if (!ctx) return;
          for (const { time, originalIndex } of chunk) {
            if (signal.aborted) return;
            await seekVideoToTime(videoRef, time, 500);
            ctx.drawImage(videoRef, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            const dataUrl = canvasRef.toDataURL('image/webp', WEBP_QUALITY);
            const hasSubtitle = timestampTypes.get(time) ?? false;
            chunkFrames.push({
              id: `${video.id}_${currentGroup}_${originalIndex}`,
              url: dataUrl,
              timestamp: formatTimestampDisplay(time),
              filename: generateFilename(time, hasSubtitle ? 'sub' : 'nosub', 'webp', currentGroup),
              videoName: video.name,
              group: currentGroup,
            });
            processedCount++;
            const now = Date.now();
            if (processedCount % 50 === 0 || processedCount === totalFrames || now - lastProgressUpdate > 500) {
              lastProgressUpdate = now;
              updateProgress(processedCount, now);
            }
          }
          return chunkFrames;
        };

        // ── 并行执行 ──────────────────────────────────────────────────────────────
        const results = await Promise.all(chunks.map((chunk, i) => processChunk(i, chunk)));
        results.forEach(chunkFrames => { if (chunkFrames) allExtractedFrames.push(...chunkFrames); });

        if (!signal.aborted) {
          setProgress(p => ({ ...p, status: 'done', current: 100, message: '处理完成！' }));
          onProgress?.({ current: 100, total: 100, message: '处理完成！' });
          onComplete(allExtractedFrames);
        }

      } catch (err: any) {
        if (signal.aborted) return;
        console.error(err);
        setProgress(p => ({ ...p, status: 'error', message: err.message || '未知错误' }));
      }
    };

    run();

    return () => { abortControllerRef.current?.abort(); };
  }, [taskId]); // 只监听 taskId，视频/SRT 变化由内部缓存判断

  // 视频源变化时清除视频缓存标记（但不销毁组件）
  useEffect(() => {
    videosLoadedRef.current   = false;
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
      {Array.from({ length: PARALLEL }, (_, index) => (
        <React.Fragment key={index}>
          <video ref={el => { videoRefs.current[index] = el; }} muted crossOrigin="anonymous" />
          <canvas ref={el => { canvasRefs.current[index] = el; }} />
        </React.Fragment>
      ))}
    </div>
  );
};

export default ProcessingView;
