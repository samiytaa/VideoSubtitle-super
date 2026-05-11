/**
 * 视频处理优化工具
 * 提供高性能的视频帧截取功能，不受浏览器标签页活跃状态影响
 */

/**
 * 优化的视频定位函数
 * 使用更可靠的策略来定位视频到指定时间点
 */
export const seekVideoToTime = (
  video: HTMLVideoElement,
  targetTime: number,
  timeout: number = 500
): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!video) {
      reject(new Error('视频元素不存在'));
      return;
    }

    // 如果已经在目标时间点附近（误差小于0.05秒），直接返回，无需 seek
    if (Math.abs(video.currentTime - targetTime) < 0.05) {
      resolve();
      return;
    }

    let resolved = false;
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        // 超时后仍然resolve，允许继续处理
        resolve();
      }
    }, timeout);

    const onSeeked = () => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve();
      }
    };

    const onError = (e: Event) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error('视频定位失败'));
      }
    };

    const cleanup = () => {
      clearTimeout(timeoutId);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });

    // 设置视频时间
    try {
      video.currentTime = targetTime;
    } catch (e) {
      cleanup();
      reject(e);
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
  batchSize: number = 10,
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
