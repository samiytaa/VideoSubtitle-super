import { handleError } from './errorHandler';

interface SubtitleBandDedupOptions {
  windowSize?: number;
  targetSize?: { width: number; height: number };
  bandTopRatio?: number;
  bandBottomRatio?: number;
  hashDistanceThreshold?: number;
  binarySimilarityThreshold?: number;
  projectionSimilarityThreshold?: number;
}

interface SubtitleBandFeature {
  hashBits: Uint8Array;
  binary: Uint8Array;
  rowProjection: Float32Array;
  colProjection: Float32Array;
  width: number;
  height: number;
}

const DEFAULT_OPTIONS: Required<SubtitleBandDedupOptions> = {
  windowSize: 8,
  targetSize: { width: 256, height: 144 },
  bandTopRatio: 0.58,
  bandBottomRatio: 0.9,
  hashDistanceThreshold: 6,
  binarySimilarityThreshold: 0.985,
  projectionSimilarityThreshold: 0.955,
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function computeDHash(binary: Uint8Array, width: number, height: number): Uint8Array {
  const hash = new Uint8Array(64);
  let bitIndex = 0;

  for (let y = 0; y < 8; y++) {
    const srcY = Math.floor((y * height) / 8);
    for (let x = 0; x < 8; x++) {
      const leftX = Math.floor((x * Math.max(1, width - 1)) / 8);
      const rightX = Math.min(width - 1, leftX + 1);
      hash[bitIndex++] = binary[srcY * width + leftX] > binary[srcY * width + rightX] ? 1 : 0;
    }
  }

  return hash;
}

function hammingDistance(a: Uint8Array, b: Uint8Array): number {
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diff++;
  }
  return diff;
}

function computeBinarySimilarity(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let same = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) same++;
  }
  return same / a.length;
}

function computeProjectionSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff += Math.abs(a[i] - b[i]);
  }

  return 1 - diff / a.length;
}

async function extractSubtitleBandFeature(
  url: string,
  options: Required<SubtitleBandDedupOptions>
): Promise<SubtitleBandFeature> {
  const img = await loadImage(url);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 Canvas 上下文');

  canvas.width = options.targetSize.width;
  canvas.height = options.targetSize.height;
  ctx.drawImage(img, 0, 0, options.targetSize.width, options.targetSize.height);

  const fullImageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const bandTop = Math.max(0, Math.floor(canvas.height * options.bandTopRatio));
  const bandBottom = Math.min(canvas.height, Math.ceil(canvas.height * options.bandBottomRatio));
  const bandHeight = Math.max(1, bandBottom - bandTop);
  const width = canvas.width;

  const gray = new Uint8Array(width * bandHeight);
  let graySum = 0;
  let graySumSquares = 0;

  for (let y = 0; y < bandHeight; y++) {
    for (let x = 0; x < width; x++) {
      const srcIndex = ((bandTop + y) * width + x) * 4;
      const r = fullImageData[srcIndex];
      const g = fullImageData[srcIndex + 1];
      const b = fullImageData[srcIndex + 2];
      const value = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      const index = y * width + x;
      gray[index] = value;
      graySum += value;
      graySumSquares += value * value;
    }
  }

  const count = gray.length;
  const mean = graySum / Math.max(1, count);
  const variance = Math.max(0, graySumSquares / Math.max(1, count) - mean * mean);
  const stdDev = Math.sqrt(variance);
  const threshold = Math.max(145, Math.min(225, Math.round(mean + stdDev * 0.35)));

  const binary = new Uint8Array(count);
  const rowProjection = new Float32Array(bandHeight);
  const colProjection = new Float32Array(width);

  for (let y = 0; y < bandHeight; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const value = gray[index] >= threshold ? 1 : 0;
      binary[index] = value;
      rowProjection[y] += value;
      colProjection[x] += value;
    }
  }

  for (let y = 0; y < bandHeight; y++) {
    rowProjection[y] /= width;
  }
  for (let x = 0; x < width; x++) {
    colProjection[x] /= bandHeight;
  }

  const hashBits = computeDHash(binary, width, bandHeight);
  return { hashBits, binary, rowProjection, colProjection, width, height: bandHeight };
}

export async function removeDuplicateImagesSubtitleBand(
  imageUrls: string[],
  options: SubtitleBandDedupOptions = {},
  onProgress?: (current: number, total: number) => void
): Promise<number[]> {
  if (imageUrls.length <= 1) return imageUrls.map((_, i) => i);

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const keepIndices: number[] = [0];
  const featureCache = new Map<number, SubtitleBandFeature>();
  const total = Math.max(1, (imageUrls.length - 1) * opts.windowSize);
  let current = 0;

  const getFeature = async (index: number) => {
    const cached = featureCache.get(index);
    if (cached) return cached;
    const feature = await extractSubtitleBandFeature(imageUrls[index], opts);
    featureCache.set(index, feature);
    return feature;
  };

  for (let i = 1; i < imageUrls.length; i++) {
    try {
      const currentFeature = await getFeature(i);
      const recentKept = keepIndices.slice(-opts.windowSize).reverse();
      let duplicateTarget = -1;

      for (const keptIdx of recentKept) {
        current++;
        if (onProgress) onProgress(current, total);

        const keptFeature = await getFeature(keptIdx);
        const hashDistance = hammingDistance(currentFeature.hashBits, keptFeature.hashBits);
        if (hashDistance > opts.hashDistanceThreshold) continue;

        const binarySimilarity = computeBinarySimilarity(currentFeature.binary, keptFeature.binary);
        const rowSimilarity = computeProjectionSimilarity(
          currentFeature.rowProjection,
          keptFeature.rowProjection
        );
        const colSimilarity = computeProjectionSimilarity(
          currentFeature.colProjection,
          keptFeature.colProjection
        );
        const projectionSimilarity = (rowSimilarity + colSimilarity) / 2;

        if (
          binarySimilarity >= opts.binarySimilarityThreshold ||
          (binarySimilarity >= 0.97 &&
            projectionSimilarity >= opts.projectionSimilarityThreshold)
        ) {
          duplicateTarget = keptIdx;
          break;
        }
      }

      if (duplicateTarget >= 0) {
        const removeAt = keepIndices.indexOf(duplicateTarget);
        if (removeAt >= 0) keepIndices.splice(removeAt, 1);
      }

      keepIndices.push(i);
    } catch (error) {
      handleError(error, undefined, { context: `字幕带去重处理图片 ${i} 时出错` });
      keepIndices.push(i);
    }
  }

  return keepIndices;
}
