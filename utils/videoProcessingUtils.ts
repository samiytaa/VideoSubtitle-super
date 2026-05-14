/**
 * 视频处理优化工具
 * 提供高性能的视频帧截取功能，不受浏览器标签页活跃状态影响
 */
import { DEFAULT_MERGE_BATCH_SIZE } from '../config/constants';

/**
 * 优化的视频定位函数
 * 使用更可靠的策略来定位视频到指定时间点
 * 返回实际定位到的精确时间
 */
export const seekVideoToTime = (
  video: HTMLVideoElement,
  targetTime: number,
  timeout: number = 500
): Promise<number> => {
  return new Promise((resolve, reject) => {
    if (!video) {
      reject(new Error('视频元素不存在'));
      return;
    }

    const duration = Number.isFinite(video.duration) ? video.duration : targetTime;
    const epsilon = 1 / 240;
    const maxTime = Math.max(0, duration - epsilon);
    const clampedTarget = Math.max(0, Math.min(targetTime, maxTime));
    const tolerance = 0.005; // 降低容差到5ms，提高精度

    // 如果已经在目标时间点附近（误差小于5ms），直接返回
    if (Math.abs(video.currentTime - clampedTarget) < tolerance) {
      resolve(video.currentTime);
      return;
    }

    let resolved = false;
    let seekAttempts = 0;
    const maxSeekAttempts = 3;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finish = (finalTime: number) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(finalTime);
    };

    const scheduleTimeout = (ms: number) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (resolved) return;
        // 超时后返回当前时间
        finish(video.currentTime);
      }, ms);
    };

    const performSeek = () => {
      try {
        seekAttempts++;
        // 优先使用fastSeek（更快但可能不够精确）
        if (seekAttempts === 1 && typeof (video as any).fastSeek === 'function') {
          (video as any).fastSeek(clampedTarget);
        } else {
          // 后续尝试使用精确seek
          video.currentTime = clampedTarget;
        }
      } catch (e) {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(e);
        }
      }
    };

    const onSeeked = () => {
      if (resolved) return;
      
      const currentDiff = Math.abs(video.currentTime - clampedTarget);
      
      // 如果精度足够，直接完成
      if (currentDiff < tolerance) {
        finish(video.currentTime);
        return;
      }
      
      // 如果还有重试机会且精度不够，再次尝试
      if (seekAttempts < maxSeekAttempts) {
        performSeek();
        return;
      }
      
      // 达到最大尝试次数，返回当前最接近的时间
      finish(video.currentTime);
    };

    const onError = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      reject(new Error('视频定位失败'));
    };

    const onReady = () => {
      if (video.readyState < 1) return;
      performSeek();
    };

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('loadedmetadata', onReady);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('seeked', onSeeked);
    video.addEventListener('loadedmetadata', onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
    scheduleTimeout(timeout);

    if (video.readyState >= 1) {
      onReady();
    }
  });
};

/**
 * 批量截取视频帧
 * 使用优化的策略来提高截取速度
 */
export interface CaptureFrameOptions {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  timestamp: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
  quality?: number;
}

export const captureFrame = async (
  options: CaptureFrameOptions
): Promise<string> => {
  const {
    video,
    canvas,
    ctx,
    timestamp,
    cropX,
    cropY,
    cropW,
    cropH,
    quality = 0.92
  } = options;

  // 定位到目标时间
  await seekVideoToTime(video, timestamp);

  // 绘制到 canvas
  ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  // 转换为 data URL
  return canvas.toDataURL('image/jpeg', quality);
};

/**
 * 使用 OffscreenCanvas 进行后台处理（如果浏览器支持）
 * 这样可以避免主线程阻塞，提高性能
 */
export const supportsOffscreenCanvas = (): boolean => {
  return typeof OffscreenCanvas !== 'undefined';
};

/**
 * 创建优化的 canvas 上下文
 */
export const createOptimizedCanvas = (
  width: number,
  height: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', {
    alpha: false, // 不需要透明度，提高性能
    willReadFrequently: false, // 优化写入性能
    desynchronized: true // 允许异步渲染
  });

  if (!ctx) {
    throw new Error('无法创建 Canvas 上下文');
  }

  return { canvas, ctx };
};

/**
 * 批量处理帧的辅助函数
 * 将大量帧分批处理，避免内存溢出
 */
export const processBatchWithYield = async <T>(
  items: T[],
  processor: (item: T, index: number) => Promise<void>,
  batchSize: number = DEFAULT_MERGE_BATCH_SIZE,
  onBatchComplete?: (processed: number, total: number) => void
): Promise<void> => {
  const total = items.length;
  
  for (let i = 0; i < total; i++) {
    await processor(items[i], i);
    
    // 每处理完一批，让出控制权给浏览器
    if ((i + 1) % batchSize === 0 || i === total - 1) {
      onBatchComplete?.(i + 1, total);
      
      // 使用 MessageChannel 来创建真正的宏任务
      // 这比 setTimeout(0) 更可靠，不受浏览器节流影响
      await new Promise<void>(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
          channel.port1.close();
          channel.port2.close();
          resolve();
        };
        channel.port2.postMessage(null);
      });
    }
  }
};

/**
 * 预加载视频数据
 * 确保视频完全加载后再开始处理
 */
export const preloadVideo = (video: HTMLVideoElement): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 3) {
      // HAVE_FUTURE_DATA or HAVE_ENOUGH_DATA
      resolve();
      return;
    }

    const onCanPlay = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error('视频加载失败'));
    };

    const cleanup = () => {
      video.removeEventListener('canplaythrough', onCanPlay);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('canplaythrough', onCanPlay, { once: true });
    video.addEventListener('error', onError, { once: true });

    // 触发加载
    video.load();
  });
};
