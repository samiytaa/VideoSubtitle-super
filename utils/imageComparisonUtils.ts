import pixelmatch from 'pixelmatch';
import { handleError } from './errorHandler';

interface RankedImageCandidate {
  id: string;
  url: string;
}

interface RankedImageResult {
  id: string;
  similarity: number;
}

interface ImageCompareOptions {
  threshold?: number;
  size?: number;
  paddingRatio?: number;
  backgroundColor?: string;
  crop?: NormalizedCropRect;
  portraitMode?: PortraitCompareMode;
}

export interface NormalizedCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PortraitCompareMode = 'normal' | 'expression';

/**
 * 加载图片
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function getOpaqueBounds(imageData: ImageData): { x: number; y: number; width: number; height: number } | null {
  const { data, width, height } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 10) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function getPixelIndex(width: number, x: number, y: number): number {
  return (y * width + x) * 4;
}

function getColorDistanceSquared(data: Uint8ClampedArray, indexA: number, indexB: number): number {
  const dr = data[indexA] - data[indexB];
  const dg = data[indexA + 1] - data[indexB + 1];
  const db = data[indexA + 2] - data[indexB + 2];
  return dr * dr + dg * dg + db * db;
}

function collectBorderSeedPoints(width: number, height: number): Array<{ x: number; y: number }> {
  const seeds: Array<{ x: number; y: number }> = [];
  const stepX = Math.max(1, Math.floor(width / 18));
  const stepY = Math.max(1, Math.floor(height / 18));

  for (let x = 0; x < width; x += stepX) {
    seeds.push({ x, y: 0 });
    seeds.push({ x, y: height - 1 });
  }
  for (let y = 0; y < height; y += stepY) {
    seeds.push({ x: 0, y });
    seeds.push({ x: width - 1, y });
  }

  seeds.push({ x: 0, y: 0 });
  seeds.push({ x: width - 1, y: 0 });
  seeds.push({ x: 0, y: height - 1 });
  seeds.push({ x: width - 1, y: height - 1 });
  return seeds;
}

function stripReferenceBackground(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  if (width < 8 || height < 8) {
    return imageData;
  }

  const output = new ImageData(new Uint8ClampedArray(data), width, height);
  const visited = new Uint8Array(width * height);
  const queue: Array<{ x: number; y: number; seedIndex: number }> = [];
  const COLOR_THRESHOLD_SQ = 48 * 48;
  const EDGE_BRIGHTNESS_THRESHOLD = 240;

  const seeds = collectBorderSeedPoints(width, height);
  for (const seed of seeds) {
    const idx = getPixelIndex(width, seed.x, seed.y);
    const alpha = output.data[idx + 3];
    const brightness = (output.data[idx] + output.data[idx + 1] + output.data[idx + 2]) / 3;
    if (alpha < 10 || brightness > EDGE_BRIGHTNESS_THRESHOLD) {
      queue.push({ x: seed.x, y: seed.y, seedIndex: idx });
      continue;
    }
    queue.push({ x: seed.x, y: seed.y, seedIndex: idx });
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const flatIndex = current.y * width + current.x;
    if (visited[flatIndex]) continue;
    visited[flatIndex] = 1;

    const pixelIndex = getPixelIndex(width, current.x, current.y);
    const alpha = output.data[pixelIndex + 3];
    if (alpha < 10) {
      output.data[pixelIndex + 3] = 0;
    } else {
      const distanceSq = getColorDistanceSquared(output.data, pixelIndex, current.seedIndex);
      if (distanceSq > COLOR_THRESHOLD_SQ) {
        continue;
      }
      output.data[pixelIndex + 3] = 0;
    }

    const neighbors = [
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
    ];

    for (const neighbor of neighbors) {
      if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= width || neighbor.y >= height) {
        continue;
      }
      const neighborFlat = neighbor.y * width + neighbor.x;
      if (visited[neighborFlat]) continue;
      queue.push({ x: neighbor.x, y: neighbor.y, seedIndex: current.seedIndex });
    }
  }

  const strippedBounds = getOpaqueBounds(output);
  if (!strippedBounds) {
    return imageData;
  }

  const originalBounds = getOpaqueBounds(imageData);
  if (!originalBounds) {
    return imageData;
  }

  const strippedArea = strippedBounds.width * strippedBounds.height;
  const originalArea = originalBounds.width * originalBounds.height;
  if (strippedArea < originalArea * 0.12) {
    return imageData;
  }

  return output;
}

function getImageDataFromImage(
  img: HTMLImageElement,
  crop?: NormalizedCropRect
): ImageData {
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = img.naturalWidth || img.width;
  sourceCanvas.height = img.naturalHeight || img.height;
  const sourceCtx = sourceCanvas.getContext('2d');
  if (!sourceCtx) {
    throw new Error('无法创建源图片 Canvas 上下文');
  }

  sourceCtx.drawImage(img, 0, 0);
  const fullImageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  return cropImageData(fullImageData, crop);
}

function normalizeImageData(
  sourceImageData: ImageData,
  {
    size = 96,
    paddingRatio = 0.06,
    backgroundColor = '#ffffff',
  }: Omit<ImageCompareOptions, 'threshold'> = {}
): ImageData {
  const bounds = getOpaqueBounds(sourceImageData) ?? {
    x: 0,
    y: 0,
    width: sourceImageData.width,
    height: sourceImageData.height,
  };

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = size;
  outputCanvas.height = size;
  const outputCtx = outputCanvas.getContext('2d');
  if (!outputCtx) {
    throw new Error('无法创建输出图片 Canvas 上下文');
  }

  outputCtx.fillStyle = backgroundColor;
  outputCtx.fillRect(0, 0, size, size);

  const innerSize = size * (1 - paddingRatio * 2);
  const scale = Math.min(innerSize / bounds.width, innerSize / bounds.height);
  const drawWidth = bounds.width * scale;
  const drawHeight = bounds.height * scale;
  const dx = (size - drawWidth) / 2;
  const dy = (size - drawHeight) / 2;

  outputCtx.drawImage(
    (() => {
      const inputCanvas = document.createElement('canvas');
      inputCanvas.width = sourceImageData.width;
      inputCanvas.height = sourceImageData.height;
      const inputCtx = inputCanvas.getContext('2d');
      if (!inputCtx) {
        throw new Error('无法创建输入图片 Canvas 上下文');
      }
      inputCtx.putImageData(sourceImageData, 0, 0);
      return inputCanvas;
    })(),
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    dx,
    dy,
    drawWidth,
    drawHeight
  );

  return outputCtx.getImageData(0, 0, size, size);
}

function clampCropRect(crop: NormalizedCropRect): NormalizedCropRect {
  const x = Math.min(Math.max(crop.x, 0), 0.95);
  const y = Math.min(Math.max(crop.y, 0), 0.95);
  const width = Math.min(Math.max(crop.width, 0.05), 1 - x);
  const height = Math.min(Math.max(crop.height, 0.05), 1 - y);
  return { x, y, width, height };
}

function cropImageData(imageData: ImageData, crop?: NormalizedCropRect): ImageData {
  if (!crop) {
    return imageData;
  }

  const rect = clampCropRect(crop);
  const sx = Math.max(0, Math.min(imageData.width - 1, Math.round(rect.x * imageData.width)));
  const sy = Math.max(0, Math.min(imageData.height - 1, Math.round(rect.y * imageData.height)));
  const ex = Math.max(sx + 1, Math.min(imageData.width, Math.round((rect.x + rect.width) * imageData.width)));
  const ey = Math.max(sy + 1, Math.min(imageData.height, Math.round((rect.y + rect.height) * imageData.height)));
  const width = ex - sx;
  const height = ey - sy;

  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法创建裁切 Canvas 上下文');
  }

  ctx.putImageData(imageData, 0, 0);
  return ctx.getImageData(sx, sy, width, height);
}

function getSimilarityFromImageData(
  data1: ImageData,
  data2: ImageData,
  threshold: number
): number {
  const diffPixels = pixelmatch(
    data1.data,
    data2.data,
    null,
    data1.width,
    data1.height,
    { threshold }
  );

  const totalPixels = data1.width * data1.height;
  return 1 - diffPixels / totalPixels;
}

function cropNormalizedImageData(imageData: ImageData, crop: NormalizedCropRect): ImageData {
  const rect = clampCropRect(crop);
  const sx = Math.max(0, Math.min(imageData.width - 1, Math.round(rect.x * imageData.width)));
  const sy = Math.max(0, Math.min(imageData.height - 1, Math.round(rect.y * imageData.height)));
  const ex = Math.max(sx + 1, Math.min(imageData.width, Math.round((rect.x + rect.width) * imageData.width)));
  const ey = Math.max(sy + 1, Math.min(imageData.height, Math.round((rect.y + rect.height) * imageData.height)));

  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法创建局部裁切 Canvas 上下文');
  }

  ctx.putImageData(imageData, 0, 0);
  return ctx.getImageData(sx, sy, ex - sx, ey - sy);
}

function getPortraitSimilarity(
  normalizedReference: ImageData,
  normalizedCandidate: ImageData,
  threshold: number,
  portraitMode: PortraitCompareMode = 'normal'
): number {
  const regions: Array<{ crop: NormalizedCropRect; weight: number }> = portraitMode === 'expression'
    ? [
      { crop: { x: 0.18, y: 0.14, width: 0.64, height: 0.62 }, weight: 0.18 },
      { crop: { x: 0.22, y: 0.18, width: 0.56, height: 0.16 }, weight: 0.22 },
      { crop: { x: 0.22, y: 0.22, width: 0.56, height: 0.14 }, weight: 0.24 },
      { crop: { x: 0.24, y: 0.34, width: 0.52, height: 0.14 }, weight: 0.14 },
      { crop: { x: 0.30, y: 0.48, width: 0.34, height: 0.12 }, weight: 0.22 },
    ]
    : [
      { crop: { x: 0, y: 0, width: 1, height: 1 }, weight: 0.20 },
      { crop: { x: 0.16, y: 0.08, width: 0.68, height: 0.72 }, weight: 0.35 },
      { crop: { x: 0.22, y: 0.22, width: 0.56, height: 0.20 }, weight: 0.25 },
      { crop: { x: 0.30, y: 0.48, width: 0.34, height: 0.16 }, weight: 0.20 },
    ];

  let weightedScore = 0;
  let totalWeight = 0;

  for (const region of regions) {
    const refRegion = cropNormalizedImageData(normalizedReference, region.crop);
    const candidateRegion = cropNormalizedImageData(normalizedCandidate, region.crop);
    const score = getSimilarityFromImageData(refRegion, candidateRegion, threshold);
    weightedScore += score * region.weight;
    totalWeight += region.weight;
  }

  return totalWeight > 0 ? weightedScore / totalWeight : 0;
}

/**
 * 计算两张图片的相似度
 * @param url1 第一张图片URL
 * @param url2 第二张图片URL
 * @param threshold 像素差异阈值 (0-1)，越小越严格
 * @returns 相似度 (0-1)，1表示完全相同
 */
export async function getImageSimilarity(
  url1: string,
  url2: string,
  threshold: number = 0.1
): Promise<number> {
  const canvas1 = document.createElement('canvas');
  const canvas2 = document.createElement('canvas');
  const ctx1 = canvas1.getContext('2d');
  const ctx2 = canvas2.getContext('2d');

  if (!ctx1 || !ctx2) {
    throw new Error('无法创建 Canvas 上下文');
  }

  const [img1, img2] = await Promise.all([loadImage(url1), loadImage(url2)]);

  // 设置画布尺寸
  canvas1.width = canvas2.width = img1.width;
  canvas1.height = canvas2.height = img1.height;

  // 绘制图片
  ctx1.drawImage(img1, 0, 0);
  ctx2.drawImage(img2, 0, 0);

  // 获取像素数据
  const data1 = ctx1.getImageData(0, 0, img1.width, img1.height);
  const data2 = ctx2.getImageData(0, 0, img2.width, img2.height);

  // 计算差异像素数
  const diffPixels = pixelmatch(
    data1.data,
    data2.data,
    null,
    img1.width,
    img1.height,
    { threshold }
  );

  // 返回相似度 (0-1)
  const totalPixels = img1.width * img1.height;
  return 1 - diffPixels / totalPixels;
}

export async function getNormalizedImageSimilarity(
  url1: string,
  url2: string,
  options: ImageCompareOptions = {}
): Promise<number> {
  const {
    threshold = 0.1,
    size = 96,
    paddingRatio = 0.06,
    backgroundColor = '#ffffff',
    crop,
    portraitMode = 'normal',
  } = options;

  const [img1, img2] = await Promise.all([loadImage(url1), loadImage(url2)]);
  const data1 = normalizeImageData(stripReferenceBackground(getImageDataFromImage(img1, crop)), { size, paddingRatio, backgroundColor });
  const data2 = normalizeImageData(getImageDataFromImage(img2), { size, paddingRatio, backgroundColor });
  return getPortraitSimilarity(data1, data2, threshold, portraitMode);
}

export async function rankImageCandidates(
  referenceUrl: string,
  candidates: RankedImageCandidate[],
  options: ImageCompareOptions & {
    onProgress?: (current: number, total: number) => void;
  } = {}
): Promise<RankedImageResult[]> {
  const {
    threshold = 0.1,
    size = 96,
    paddingRatio = 0.06,
    backgroundColor = '#ffffff',
    crop,
    portraitMode = 'normal',
    onProgress,
  } = options;

  if (candidates.length === 0) {
    return [];
  }

  const referenceImage = await loadImage(referenceUrl);
  const referenceData = normalizeImageData(
    stripReferenceBackground(getImageDataFromImage(referenceImage, crop)),
    { size, paddingRatio, backgroundColor }
  );
  const results: RankedImageResult[] = [];
  let completed = 0;

  for (const candidate of candidates) {
    try {
      const candidateImage = await loadImage(candidate.url);
      const candidateData = normalizeImageData(
        getImageDataFromImage(candidateImage),
        { size, paddingRatio, backgroundColor }
      );
      results.push({
        id: candidate.id,
        similarity: getPortraitSimilarity(referenceData, candidateData, threshold, portraitMode),
      });
    } catch (error) {
      handleError(error, undefined, { context: `头像比对失败: ${candidate.id}` });
      results.push({
        id: candidate.id,
        similarity: 0,
      });
    } finally {
      completed += 1;
      onProgress?.(completed, candidates.length);
    }
  }

  return results.sort((a, b) => b.similarity - a.similarity);
}

/**
 * 去除重复图片，保留后一张
 * @param imageUrls 图片URL数组
 * @param similarityThreshold 相似度阈值 (0-1)，超过此值认为是重复
 * @param onProgress 进度回调
 * @returns 去重后的索引数组
 */
export async function removeDuplicateImages(
  imageUrls: string[],
  similarityThreshold: number = 0.95,
  onProgress?: (current: number, total: number) => void
): Promise<number[]> {
  if (imageUrls.length <= 1) {
    return imageUrls.map((_, i) => i);
  }

  const keepIndices = new Set<number>();
  const duplicateOf = new Map<number, number>(); // 记录每张图片是哪张的重复

  // 从第一张开始
  keepIndices.add(0);

  // 逐个比较相邻图片
  for (let i = 1; i < imageUrls.length; i++) {
    if (onProgress) {
      onProgress(i, imageUrls.length - 1);
    }

    try {
      const similarity = await getImageSimilarity(
        imageUrls[i - 1],
        imageUrls[i],
        0.1
      );

      if (similarity >= similarityThreshold) {
        // 相似度高，认为是重复，移除前一张，保留当前这张
        duplicateOf.set(i - 1, i);
        keepIndices.delete(i - 1);
        keepIndices.add(i);
      } else {
        // 不相似，保留当前这张
        keepIndices.add(i);
      }
    } catch (error) {
      handleError(error, undefined, { context: `比较图片 ${i - 1} 和 ${i} 时出错` });
      // 出错时保留当前图片
      keepIndices.add(i);
    }
  }

  return Array.from(keepIndices).sort((a, b) => a - b);
}

/**
 * 循环去重，直到移除的重复图片小于指定阈值
 * @param imageUrls 图片URL数组
 * @param similarityThreshold 相似度阈值
 * @param minRemovedThreshold 最小移除数量阈值，低于此值停止循环
 * @param onProgress 进度回调 (current, total, iteration, removed)
 * @returns 去重后的索引数组
 */
export async function removeDuplicatesLoop(
  imageUrls: string[],
  similarityThreshold: number = 0.95,
  minRemovedThreshold: number = 10,
  onProgress?: (current: number, total: number, iteration: number, removed: number) => void
): Promise<number[]> {
  if (imageUrls.length <= 1) {
    return imageUrls.map((_, i) => i);
  }

  let currentIndices = imageUrls.map((_, i) => i);
  let iteration = 0;
  let totalRemoved = 0;

  while (true) {
    iteration++;
    const currentUrls = currentIndices.map(i => imageUrls[i]);
    
    // 执行一次去重
    const keepIndices = await removeDuplicateImagesAdvanced(
      currentUrls,
      similarityThreshold,
      (current, total) => {
        if (onProgress) {
          onProgress(current, total, iteration, totalRemoved);
        }
      }
    );

    // 计算本轮移除的数量
    const removedThisRound = currentUrls.length - keepIndices.length;
    totalRemoved += removedThisRound;

    // 如果本轮移除的数量小于阈值，停止循环
    if (removedThisRound < minRemovedThreshold) {
      // 映射回原始索引
      const finalIndices = keepIndices.map(i => currentIndices[i]);
      return finalIndices;
    }

    // 更新当前索引列表
    currentIndices = keepIndices.map(i => currentIndices[i]);

    // 如果只剩1张或0张图片，停止循环
    if (currentIndices.length <= 1) {
      return currentIndices;
    }
  }
}

/**
 * 批量去重（支持非相邻图片比较）
 * @param imageUrls 图片URL数组
 * @param similarityThreshold 相似度阈值
 * @param onProgress 进度回调
 * @returns 去重后的索引数组
 */
export async function removeDuplicateImagesAdvanced(
  imageUrls: string[],
  similarityThreshold: number = 0.95,
  onProgress?: (current: number, total: number) => void
): Promise<number[]> {
  if (imageUrls.length <= 1) {
    return imageUrls.map((_, i) => i);
  }

  const CHUNK_SIZE = 50; // 每组50张图片
  const keepIndices = new Set<number>(imageUrls.map((_, i) => i));

  // 如果图片数量小于等于50，直接顺序处理
  if (imageUrls.length <= CHUNK_SIZE) {
    const totalComparisons = imageUrls.length - 1;
    let currentComparison = 0;

    for (let i = 0; i < imageUrls.length - 1; i++) {
      currentComparison++;
      if (onProgress) {
        onProgress(currentComparison, totalComparisons);
      }

      try {
        const similarity = await getImageSimilarity(
          imageUrls[i],
          imageUrls[i + 1],
          0.1
        );

        if (similarity >= similarityThreshold) {
          keepIndices.delete(i);
        }
      } catch (error) {
        handleError(error, undefined, { context: `比较图片 ${i} 和 ${i + 1} 时出错` });
      }
    }

    return Array.from(keepIndices).sort((a, b) => a - b);
  }

  // 大于50张图片，分组并行处理
  const chunks: number[][] = [];
  for (let i = 0; i < imageUrls.length; i += CHUNK_SIZE) {
    chunks.push(Array.from({ length: Math.min(CHUNK_SIZE, imageUrls.length - i) }, (_, j) => i + j));
  }

  const totalComparisons = imageUrls.length - 1;
  let completedComparisons = 0;

  // 限制并行数量，避免卡顿
  const MAX_PARALLEL = 8; // 最多同时处理8组

  // 处理单个组的函数
  const processChunk = async (chunkIndices: number[]): Promise<Set<number>> => {
    const chunkKeepIndices = new Set<number>(chunkIndices);

    // 处理组内相邻图片
    for (let i = 0; i < chunkIndices.length - 1; i++) {
      const idx1 = chunkIndices[i];
      const idx2 = chunkIndices[i + 1];

      try {
        const similarity = await getImageSimilarity(
          imageUrls[idx1],
          imageUrls[idx2],
          0.1
        );

        if (similarity >= similarityThreshold) {
          chunkKeepIndices.delete(idx1);
        }

        completedComparisons++;
        if (onProgress) {
          onProgress(completedComparisons, totalComparisons);
        }
      } catch (error) {
        handleError(error, undefined, { context: `比较图片 ${idx1} 和 ${idx2} 时出错` });
      }
    }

    return chunkKeepIndices;
  };

  // 第一步：分批并行处理每组内部的去重
  const chunkResults: Set<number>[] = [];
  
  for (let i = 0; i < chunks.length; i += MAX_PARALLEL) {
    // 每次处理最多 MAX_PARALLEL 组
    const batchChunks = chunks.slice(i, i + MAX_PARALLEL);
    const batchResults = await Promise.all(
      batchChunks.map(chunkIndices => processChunk(chunkIndices))
    );
    chunkResults.push(...batchResults);
  }

  // 合并组内去重结果
  keepIndices.clear();
  chunkResults.forEach(chunkSet => {
    chunkSet.forEach(idx => keepIndices.add(idx));
  });

  // 第二步：处理组间边界（前一组的最后一张和后一组的第一张）
  for (let i = 0; i < chunks.length - 1; i++) {
    const currentChunk = chunks[i];
    const nextChunk = chunks[i + 1];

    // 找到当前组中保留的最后一张图片
    let lastKeptInCurrent = -1;
    for (let j = currentChunk.length - 1; j >= 0; j--) {
      if (keepIndices.has(currentChunk[j])) {
        lastKeptInCurrent = currentChunk[j];
        break;
      }
    }

    // 找到下一组中保留的第一张图片
    let firstKeptInNext = -1;
    for (let j = 0; j < nextChunk.length; j++) {
      if (keepIndices.has(nextChunk[j])) {
        firstKeptInNext = nextChunk[j];
        break;
      }
    }

    // 如果两者都存在，比较它们
    if (lastKeptInCurrent !== -1 && firstKeptInNext !== -1) {
      try {
        const similarity = await getImageSimilarity(
          imageUrls[lastKeptInCurrent],
          imageUrls[firstKeptInNext],
          0.1
        );

        if (similarity >= similarityThreshold) {
          // 移除前一张（当前组的最后一张），保留后一张（下一组的第一张）
          keepIndices.delete(lastKeptInCurrent);
        }

        completedComparisons++;
        if (onProgress) {
          onProgress(completedComparisons, totalComparisons);
        }
      } catch (error) {
        handleError(error, undefined, {
          context: `比较边界图片 ${lastKeptInCurrent} 和 ${firstKeptInNext} 时出错`,
        });
      }
    }
  }

  return Array.from(keepIndices).sort((a, b) => a - b);
}
