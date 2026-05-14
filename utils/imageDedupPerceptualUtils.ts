import { handleError } from './errorHandler';

interface FeatureData {
  hashBits: Uint8Array;
  gray: Uint8Array;
}

interface DedupOptions {
  hashDistanceThreshold?: number;
  ssimThreshold?: number;
  strongSsimThreshold?: number;
  windowSize?: number;
  targetSize?: { width: number; height: number };
}

const DEFAULT_OPTIONS: Required<DedupOptions> = {
  hashDistanceThreshold: 8,
  ssimThreshold: 0.93,
  strongSsimThreshold: 0.97,
  windowSize: 6,
  targetSize: { width: 256, height: 144 },
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function computeDHash(gray: Uint8Array, width: number, height: number): Uint8Array {
  const hash = new Uint8Array(64);
  let bitIndex = 0;
  for (let y = 0; y < 8; y++) {
    const srcY = Math.floor((y * height) / 8);
    for (let x = 0; x < 8; x++) {
      const leftX = Math.floor((x * (width - 1)) / 8);
      const rightX = Math.min(width - 1, leftX + 1);
      const left = gray[srcY * width + leftX];
      const right = gray[srcY * width + rightX];
      hash[bitIndex++] = left > right ? 1 : 0;
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

function computeSSIM(grayA: Uint8Array, grayB: Uint8Array): number {
  const n = grayA.length;
  if (n !== grayB.length || n === 0) return 0;

  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < n; i++) {
    meanA += grayA[i];
    meanB += grayB[i];
  }
  meanA /= n;
  meanB /= n;

  let varA = 0;
  let varB = 0;
  let cov = 0;
  for (let i = 0; i < n; i++) {
    const da = grayA[i] - meanA;
    const db = grayB[i] - meanB;
    varA += da * da;
    varB += db * db;
    cov += da * db;
  }
  const denom = Math.max(1, n - 1);
  varA /= denom;
  varB /= denom;
  cov /= denom;

  const l = 255;
  const c1 = (0.01 * l) ** 2;
  const c2 = (0.03 * l) ** 2;
  const numerator = (2 * meanA * meanB + c1) * (2 * cov + c2);
  const denominator = (meanA * meanA + meanB * meanB + c1) * (varA + varB + c2);
  if (denominator === 0) return 0;
  return numerator / denominator;
}

async function extractFeature(
  url: string,
  size: { width: number; height: number }
): Promise<FeatureData> {
  const img = await loadImage(url);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 Canvas 上下文');

  canvas.width = size.width;
  canvas.height = size.height;
  ctx.drawImage(img, 0, 0, size.width, size.height);
  const imageData = ctx.getImageData(0, 0, size.width, size.height).data;

  const gray = new Uint8Array(size.width * size.height);
  for (let i = 0, p = 0; i < imageData.length; i += 4, p++) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];
    gray[p] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  const hashBits = computeDHash(gray, size.width, size.height);
  return { hashBits, gray };
}

export async function removeDuplicateImagesPerceptual(
  imageUrls: string[],
  options: DedupOptions = {},
  onProgress?: (current: number, total: number) => void
): Promise<number[]> {
  if (imageUrls.length <= 1) return imageUrls.map((_, i) => i);

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const keepIndices: number[] = [0];
  const featureCache = new Map<number, FeatureData>();
  const total = (imageUrls.length - 1) * opts.windowSize;
  let current = 0;

  const getFeature = async (index: number) => {
    const cached = featureCache.get(index);
    if (cached) return cached;
    const feature = await extractFeature(imageUrls[index], opts.targetSize);
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
        const ham = hammingDistance(currentFeature.hashBits, keptFeature.hashBits);
        if (ham > opts.hashDistanceThreshold) continue;

        const ssim = computeSSIM(currentFeature.gray, keptFeature.gray);
        if ((ham <= opts.hashDistanceThreshold && ssim >= opts.ssimThreshold) || ssim >= opts.strongSsimThreshold) {
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
      handleError(error, undefined, { context: `新去重处理图片 ${i} 时出错` });
      keepIndices.push(i);
    }
  }

  return keepIndices;
}
