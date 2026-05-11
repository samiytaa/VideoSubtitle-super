// 图片处理工具函数

/**
 * 下载单个文件
 */
export const downloadFile = (url: string, filename: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * 将多个图片打包成 ZIP 并下载，每50张一组放入子文件夹
 */
export const downloadAsZip = async (images: Array<{ url: string; filename: string }>, zipFilename: string) => {
  // 动态导入 JSZip
  const JSZip = (await import('jszip')).default;
  
  const zip = new JSZip();
  const batchSize = 50;
  const totalBatches = Math.ceil(images.length / batchSize);
  
  // 按每50张分组，放入子文件夹
  for (let i = 0; i < images.length; i++) {
    const batchIndex = Math.floor(i / batchSize) + 1;
    const folderName = totalBatches > 1
      ? `${String(batchIndex).padStart(3, '0')}_第${batchIndex}组`
      : '';
    const image = images[i];
    try {
      const base64Data = image.url.split(',')[1];
      const filePath = folderName ? `${folderName}/${image.filename}` : image.filename;
      zip.file(filePath, base64Data, { base64: true });
    } catch (error) {
      console.error(`Failed to add ${image.filename} to zip:`, error);
    }
  }
  
  // 生成 ZIP 文件
  const blob = await zip.generateAsync({ type: 'blob' });
  
  // 下载 ZIP
  const url = URL.createObjectURL(blob);
  downloadFile(url, zipFilename);
  URL.revokeObjectURL(url);
};

/**
 * 垂直拼接多张图片
 */
export const mergeImagesVertically = async (
  imageUrls: string[],
  options: {
    alignment?: 'left' | 'center' | 'right';
    backgroundColor?: string;
    gap?: number;
  } = {}
): Promise<string> => {
  const { alignment = 'center', backgroundColor = '#000000', gap = 0 } = options;
  
  if (imageUrls.length === 0) {
    throw new Error('No images to merge');
  }
  
  // 如果只有一张图片，直接返回
  if (imageUrls.length === 1) {
    return imageUrls[0];
  }
  
  // 加载所有图片
  const images = await Promise.all(
    imageUrls.map(url => {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
    })
  );
  
  // 计算最大宽度和总高度
  const maxWidth = Math.max(...images.map(img => img.width));
  const totalHeight = images.reduce((sum, img) => sum + img.height, 0) + gap * (images.length - 1);
  
  // 创建 canvas
  const canvas = document.createElement('canvas');
  canvas.width = maxWidth;
  canvas.height = totalHeight;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  // 填充背景色
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, maxWidth, totalHeight);
  
  // 绘制所有图片
  let currentY = 0;
  for (const img of images) {
    let x = 0;
    
    // 根据对齐方式计算 x 坐标
    if (alignment === 'center') {
      x = (maxWidth - img.width) / 2;
    } else if (alignment === 'right') {
      x = maxWidth - img.width;
    }
    
    // 如果图片宽度小于最大宽度，先用白色填充该图片区域
    if (img.width < maxWidth) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, currentY, maxWidth, img.height);
    }
    
    ctx.drawImage(img, x, currentY);
    currentY += img.height + gap;
  }
  
  // 返回 data URL
  return canvas.toDataURL('image/png', 1.0);
};

/**
 * 批量拼接图片（分组处理）
 */
export const batchMergeImages = async (
  imageUrls: string[],
  batchSize: number,
  options?: {
    alignment?: 'left' | 'center' | 'right';
    backgroundColor?: string;
    gap?: number;
  }
): Promise<string[]> => {
  const results: string[] = [];
  
  for (let i = 0; i < imageUrls.length; i += batchSize) {
    const batch = imageUrls.slice(i, i + batchSize);
    const merged = await mergeImagesVertically(batch, options);
    results.push(merged);
  }
  
  return results;
};

/**
 * 计算图片文件大小（估算）
 */
export const estimateImageSize = (dataUrl: string): number => {
  // Base64 编码后的大小约为原始大小的 4/3
  const base64Length = dataUrl.split(',')[1]?.length || 0;
  return Math.round((base64Length * 3) / 4);
};

/**
 * 格式化文件大小
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};
