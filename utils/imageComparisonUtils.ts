import pixelmatch from 'pixelmatch';

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
      console.error(`比较图片 ${i - 1} 和 ${i} 时出错:`, error);
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
        console.error(`比较图片 ${i} 和 ${i + 1} 时出错:`, error);
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
        console.error(`比较图片 ${idx1} 和 ${idx2} 时出错:`, error);
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
        console.error(`比较边界图片 ${lastKeptInCurrent} 和 ${firstKeptInNext} 时出错:`, error);
      }
    }
  }

  return Array.from(keepIndices).sort((a, b) => a - b);
}
