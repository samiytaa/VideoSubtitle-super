import { createFile, DataStream, type Box, type Sample, type Track } from 'mp4box';

import { ExtractedFrame } from '../types';
import { formatTimestampDisplay, generateFilename } from './filenameUtils';

type CaptureTask = {
  taskId: number;
  requestedTime: number;
  hasSubtitle: boolean;
};

type ExtractFramesOptions = {
  file: File;
  videoName: string;
  videoId: string;
  group: 'group1' | 'group2';
  runId: string;
  crop: { x: number; y: number; width: number; height: number };
  tasks: CaptureTask[];
  quality: number;
  signal: AbortSignal;
  onProgress?: (processed: number, total: number, currentTime: number, targetTime: number) => void;
};

type Mp4TrackInfo = Track & {
  video?: { width: number; height: number };
};

type Mp4File = ReturnType<typeof createFile> & {
  onReady?: (info: { videoTracks?: Mp4TrackInfo[] }) => void;
  onError?: (error: string) => void;
  onSamples?: (trackId: number, user: unknown, samples: Sample[]) => void;
  appendBuffer: (buffer: ArrayBuffer & { fileStart?: number }, last?: boolean) => number;
  flush: () => void;
  start: () => void;
  stop: () => void;
  setExtractionOptions: (trackId: number, user: unknown, options?: { nbSamples?: number }) => void;
};

type DescriptionCarrier = {
  avcC?: Box;
  hvcC?: Box;
  vpcC?: Box;
  av1C?: Box;
};

const MP4_CONFIG_BOX_KEYS = ['avcC', 'hvcC', 'vpcC', 'av1C'] as const;

function createAbortError(): Error {
  try {
    return new DOMException('The operation was aborted.', 'AbortError');
  } catch {
    const error = new Error('The operation was aborted.');
    error.name = 'AbortError';
    return error;
  }
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw createAbortError();
  }
}

function boxToPayload(box: Box): Uint8Array {
  const stream = new DataStream(undefined, 0, DataStream.ENDIANNESS.BIG_ENDIAN);
  box.write(stream);
  const bytes = new Uint8Array(stream.buffer, 0, stream.byteLength);
  const headerSize = box.hdr_size ?? 8;
  return bytes.slice(headerSize);
}

function resolveDecoderDescription(sample: Sample): Uint8Array | undefined {
  const description = sample.description as DescriptionCarrier | undefined;
  if (!description) return undefined;

  for (const key of MP4_CONFIG_BOX_KEYS) {
    const box = description[key];
    if (box) {
      return boxToPayload(box);
    }
  }

  return undefined;
}

async function readVideoSamples(
  file: File,
  signal: AbortSignal,
): Promise<{ track: Mp4TrackInfo; samples: Sample[] }> {
  throwIfAborted(signal);
  const buffer = await file.arrayBuffer();
  throwIfAborted(signal);

  return await new Promise<{ track: Mp4TrackInfo; samples: Sample[] }>((resolve, reject) => {
    const mp4File = createFile() as Mp4File;
    let readyTrack: Mp4TrackInfo | null = null;
    const samples: Sample[] = [];
    let settled = false;

    const cleanup = () => {
      mp4File.onReady = undefined;
      mp4File.onError = undefined;
      mp4File.onSamples = undefined;
      signal.removeEventListener('abort', onAbort);
    };

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const onAbort = () => finish(() => reject(createAbortError()));

    signal.addEventListener('abort', onAbort, { once: true });

    mp4File.onError = (error) => {
      finish(() => reject(new Error(error || 'MP4 解析失败')));
    };

    mp4File.onReady = (info) => {
      const track = info.videoTracks?.[0];
      if (!track) {
        finish(() => reject(new Error('当前视频不包含可解码的视频轨道')));
        return;
      }
      readyTrack = track;
      mp4File.setExtractionOptions(track.id, null, { nbSamples: Math.max(track.nb_samples || 1, 1) });
      mp4File.start();
      mp4File.flush();
    };

    mp4File.onSamples = (_trackId, _user, batch) => {
      samples.push(...batch);
      if (!readyTrack) return;
      if (samples.length >= readyTrack.nb_samples) {
        finish(() => resolve({ track: readyTrack!, samples }));
      }
    };

    const mp4Buffer = buffer as ArrayBuffer & { fileStart?: number };
    mp4Buffer.fileStart = 0;

    try {
      mp4File.appendBuffer(mp4Buffer, true);
      mp4File.flush();
    } catch (error) {
      finish(() => reject(error instanceof Error ? error : new Error(String(error))));
    }
  });
}

export async function extractFramesWithWebCodecs({
  file,
  videoName,
  videoId,
  group,
  runId,
  crop,
  tasks,
  quality,
  signal,
  onProgress,
}: ExtractFramesOptions): Promise<ExtractedFrame[]> {
  if (typeof VideoDecoder === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    throw new Error('当前环境不支持 WebCodecs 无 seek 提帧');
  }
  if (!tasks.length) return [];

  const sortedTasks = [...tasks].sort((a, b) => a.requestedTime - b.requestedTime);
  const { track, samples } = await readVideoSamples(file, signal);
  throwIfAborted(signal);

  if (!samples.length) {
    throw new Error('未能从视频中提取到可解码样本');
  }

  const firstSample = samples[0];
  const description = resolveDecoderDescription(firstSample);
  const codecConfig: VideoDecoderConfig = {
    codec: track.codec,
    codedWidth: Math.max(1, Math.round(track.video?.width || track.track_width || 0)),
    codedHeight: Math.max(1, Math.round(track.video?.height || track.track_height || 0)),
  };

  if (description?.byteLength) {
    codecConfig.description = description;
  }

  const support = await VideoDecoder.isConfigSupported(codecConfig);
  if (!support.supported) {
    throw new Error(`当前视频编码不支持 WebCodecs 解码: ${track.codec}`);
  }

  const canvas = new OffscreenCanvas(crop.width, crop.height);
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (!ctx) {
    throw new Error('无法创建 OffscreenCanvas 上下文');
  }

  let processedCount = 0;
  let targetIndex = 0;
  let previousFrame: VideoFrame | null = null;
  let previousTime = 0;
  let processingQueue = Promise.resolve();
  let decoderError: Error | null = null;
  const results: ExtractedFrame[] = [];
  const lastTargetTime = sortedTasks[sortedTasks.length - 1].requestedTime;

  const captureFrame = async (frame: VideoFrame, task: CaptureTask, capturedTime: number) => {
    throwIfAborted(signal);
    ctx.drawImage(frame, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    const blob = await canvas.convertToBlob({
      type: 'image/webp',
      quality,
    });
    const driftMs = Math.round((capturedTime - task.requestedTime) * 1000);
    results.push({
      id: `${videoId}_${group}_${runId}_${task.taskId}`,
      url: URL.createObjectURL(blob),
      blob,
      timestamp: formatTimestampDisplay(capturedTime),
      filename: generateFilename(capturedTime, task.hasSubtitle ? 'sub' : 'nosub', 'webp', group),
      videoName,
      group,
      requestedTime: task.requestedTime,
      capturedTime,
      driftMs,
    });
    processedCount += 1;
    onProgress?.(processedCount, sortedTasks.length, capturedTime, lastTargetTime);
  };

  const maybeCaptureTargets = async (frame: VideoFrame, currentTime: number) => {
    while (targetIndex < sortedTasks.length && currentTime >= sortedTasks[targetIndex].requestedTime) {
      const task = sortedTasks[targetIndex];
      const previousDiff = previousFrame ? Math.abs(previousTime - task.requestedTime) : Number.POSITIVE_INFINITY;
      const currentDiff = Math.abs(currentTime - task.requestedTime);
      const usePrevious = previousFrame !== null && previousDiff <= currentDiff;

      if (usePrevious && previousFrame) {
        await captureFrame(previousFrame, task, previousTime);
      } else {
        await captureFrame(frame, task, currentTime);
      }

      targetIndex += 1;
    }
  };

  const decoder = new VideoDecoder({
    output: (frame) => {
      const ownedFrame = new VideoFrame(frame);
      frame.close();

      processingQueue = processingQueue.then(async () => {
        if (decoderError) throw decoderError;
        throwIfAborted(signal);
        const currentTime = (ownedFrame.timestamp ?? 0) / 1_000_000;
        await maybeCaptureTargets(ownedFrame, currentTime);

        if (previousFrame) {
          previousFrame.close();
        }
        previousFrame = new VideoFrame(ownedFrame);
        previousTime = currentTime;
        ownedFrame.close();
      });
    },
    error: (error) => {
      decoderError = error;
    },
  });

  decoder.configure(support.config);

  try {
    for (const sample of samples) {
      throwIfAborted(signal);
      if ((sample.cts / sample.timescale) > lastTargetTime && targetIndex >= sortedTasks.length) {
        break;
      }

      decoder.decode(new EncodedVideoChunk({
        type: sample.is_sync ? 'key' : 'delta',
        timestamp: Math.round((sample.cts / sample.timescale) * 1_000_000),
        duration: Math.max(1, Math.round((sample.duration / sample.timescale) * 1_000_000)),
        data: sample.data ? new Uint8Array(sample.data) : new Uint8Array(),
      }));
    }

    await decoder.flush();
    await processingQueue;
    if (decoderError) {
      throw decoderError;
    }

    while (targetIndex < sortedTasks.length && previousFrame) {
      await captureFrame(previousFrame, sortedTasks[targetIndex], previousTime);
      targetIndex += 1;
    }
  } finally {
    decoder.close();
    previousFrame?.close();
  }

  throwIfAborted(signal);
  return results;
}
