import React, { useEffect, useRef, useState } from 'react';
import { ExtractedFrame, ExtractionMode, ExtractionParams, ProgressData, ROI, VideoFile } from '../types';
import { extractFramesWithWebCodecs } from '../utils/webCodecsFrameExtractor';
import { handleError } from '../utils/errorHandler';
import {
  PROCESSING_WEBP_QUALITY,
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

// ─── Component ────────────────────────────────────────────────────────────────

const ProcessingView: React.FC<ProcessingViewProps> = ({
  video, roi, params, taskId, onComplete, onProgress,
}) => {
  const [_progress, setProgress] = useState<ProgressData>({
    current: 0, total: 100, status: 'idle',
    message: '准备开始处理...',
    currentVideo: video.name, videoIndex: 0, videoTotal: 1,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const cachedSrtFileRef     = useRef<File | null>(null);
  const cachedSrtSegmentsRef = useRef<SrtSegment[] | null>(null);

  // ── taskId 变化时触发新任务 ───────────────────────────────────────────────────
  useEffect(() => {
    if (taskId === 0) return; // 初始值，不处理

    // 取消上一个任务
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const run = async () => {
      const allExtractedFrames: ExtractedFrame[] = [];
      let measuredFps = ASSUMED_VIDEO_FPS;

      setProgress(p => ({ ...p, status: 'processing', message: '正在初始化...' }));
      onProgress?.({ current: 0, total: 100, message: '正在初始化...' });

      try {
        if (signal.aborted) return;

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
          ? Math.min(params.endTime, video.duration)
          : video.duration;

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

        const currentGroup = params.selectedGroup || 'group1';
        const cropX = Math.round((roi.x / 100) * video.width);
        const cropY = Math.round((roi.y / 100) * video.height);
        const cropW = Math.max(1, Math.round((roi.width / 100) * video.width));
        const cropH = Math.max(1, Math.round((roi.height / 100) * video.height));
        const t0 = Date.now();
        const updateProgress = (processed: number, total: number, currentTime: number, targetTime: number) => {
          const now = Date.now();
          const percent   = Math.round((processed / totalFrames) * 100);
          const elapsed   = (now - t0) / 1000;
          const speed     = elapsed > 0 ? processed / elapsed : 0;
          const remaining = speed > 0 ? (totalFrames - processed) / speed : 0;
          const speedText = speed <= 0 ? '计算中' : speed >= 1 ? `${speed.toFixed(1)} 帧/秒` : `${(60 / speed).toFixed(1)} 秒/帧`;
          const remText   = remaining < 60 ? `剩余 ${Math.ceil(remaining)} 秒` : `剩余 ${Math.ceil(remaining / 60)} 分钟`;
          const scanText = targetTime > 0 ? `已解码到 ${currentTime.toFixed(2)}s / ${targetTime.toFixed(2)}s` : '正在顺序解码';
          const msg = `WebCodecs直解 (${processed}/${total}) - ${scanText} - ${speedText} - ${remText}`;
          setProgress(p => ({ ...p, current: percent, message: msg }));
          onProgress?.({ current: percent, total: 100, message: msg });
        };

        if (!video.file) {
          throw new Error('当前视频文件不可用，无法执行 WebCodecs 直解');
        }

        const decodedFrames = await extractFramesWithWebCodecs({
          file: video.file,
          videoName: video.name,
          videoId: video.id,
          group: currentGroup,
          runId,
          crop: { x: cropX, y: cropY, width: cropW, height: cropH },
          tasks: captureTasks,
          quality: PROCESSING_WEBP_QUALITY,
          signal,
          onProgress: updateProgress,
        });

        allExtractedFrames.push(...decodedFrames);

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

  // SRT 文件变化时清除 SRT 缓存
  useEffect(() => {
    if (params.srtFile !== cachedSrtFileRef.current) {
      cachedSrtFileRef.current     = null;
      cachedSrtSegmentsRef.current = null;
    }
  }, [params.srtFile]);

  return (
    <div className="hidden" />
  );
};

export default ProcessingView;
