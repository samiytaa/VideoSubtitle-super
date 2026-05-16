export interface PixelCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AvatarReferenceCrops {
  left: PixelCropRect;
  right: PixelCropRect;
}

export interface AvatarReferenceImages {
  left: string;
  right: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function sanitizeRect(rect: PixelCropRect, imageWidth: number, imageHeight: number): PixelCropRect {
  const x = clamp(Math.round(rect.x), 0, Math.max(0, imageWidth - 1));
  const y = clamp(Math.round(rect.y), 0, Math.max(0, imageHeight - 1));
  const width = clamp(Math.round(rect.width), 1, Math.max(1, imageWidth - x));
  const height = clamp(Math.round(rect.height), 1, Math.max(1, imageHeight - y));

  return { x, y, width, height };
}

export function getAvatarReferenceCropRects(imageWidth: number, imageHeight: number): AvatarReferenceCrops {
  const width = Math.max(1, Math.round(imageWidth));
  const height = Math.max(1, Math.round(imageHeight));
  const topPadding = Math.round(height * 0.06);
  const cropHeight = Math.min(height - topPadding, Math.max(1, Math.round(height * 0.7)));
  const cropWidth = Math.min(Math.max(1, Math.round(width * 0.34)), Math.max(1, Math.round(cropHeight * 0.9)));
  const sidePadding = Math.round(width * 0.02);

  const left = sanitizeRect(
    {
      x: sidePadding,
      y: topPadding,
      width: cropWidth,
      height: cropHeight,
    },
    width,
    height
  );

  const right = sanitizeRect(
    {
      x: width - sidePadding - cropWidth,
      y: topPadding,
      width: cropWidth,
      height: cropHeight,
    },
    width,
    height
  );

  return { left, right };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('无法加载参考图片'));
    img.src = src;
  });
}

function cropImageToDataUrl(img: HTMLImageElement, rect: PixelCropRect): string {
  const canvas = document.createElement('canvas');
  canvas.width = rect.width;
  canvas.height = rect.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法创建头像参考图画布');
  }

  ctx.drawImage(
    img,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    rect.width,
    rect.height
  );

  return canvas.toDataURL('image/png');
}

export async function generateAvatarReferenceImages(imageUrl: string): Promise<AvatarReferenceImages> {
  const img = await loadImage(imageUrl);
  const rects = getAvatarReferenceCropRects(img.naturalWidth || img.width, img.naturalHeight || img.height);

  return {
    left: cropImageToDataUrl(img, rects.left),
    right: cropImageToDataUrl(img, rects.right),
  };
}
