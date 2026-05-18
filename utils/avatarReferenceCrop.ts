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

export interface LoadedAvatarReferenceImage {
  element: HTMLImageElement;
  width: number;
  height: number;
}

export interface AvatarReferenceCropOptions {
  leftWidthRatio?: number;
  rightWidthRatio?: number;
  maxWidthToHeightRatio?: number;
}

const DEFAULT_WIDTH_RATIO = 0.23;
const DEFAULT_MAX_WIDTH_TO_HEIGHT_RATIO = 0.9;

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

export function getAvatarReferenceCropRects(
  imageWidth: number,
  imageHeight: number,
  options: AvatarReferenceCropOptions = {}
): AvatarReferenceCrops {
  const width = Math.max(1, Math.round(imageWidth));
  const height = Math.max(1, Math.round(imageHeight));
  const maxWidthToHeightRatio = clamp(options.maxWidthToHeightRatio ?? DEFAULT_MAX_WIDTH_TO_HEIGHT_RATIO, 0.2, 2);
  const leftWidthRatio = clamp(options.leftWidthRatio ?? DEFAULT_WIDTH_RATIO, 0.05, 1);
  const rightWidthRatio = clamp(options.rightWidthRatio ?? DEFAULT_WIDTH_RATIO, 0.05, 1);

  const fullHeight = height;
  const maxCropWidth = Math.min(width, Math.max(1, Math.round(fullHeight * maxWidthToHeightRatio)));
  const leftCropWidth = Math.min(maxCropWidth, Math.max(1, Math.round(width * leftWidthRatio)));
  const rightCropWidth = Math.min(maxCropWidth, Math.max(1, Math.round(width * rightWidthRatio)));

  const left = sanitizeRect(
    {
      x: 0,
      y: 0,
      width: leftCropWidth,
      height: fullHeight,
    },
    width,
    height
  );

  const right = sanitizeRect(
    {
      x: width - rightCropWidth,
      y: 0,
      width: rightCropWidth,
      height: fullHeight,
    },
    width,
    height
  );

  return { left, right };
}

export function loadAvatarReferenceImage(src: string): Promise<LoadedAvatarReferenceImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({
      element: img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
    });
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

export function generateAvatarReferenceImagesFromLoadedImage(
  loadedImage: LoadedAvatarReferenceImage,
  options: AvatarReferenceCropOptions = {}
): AvatarReferenceImages {
  const rects = getAvatarReferenceCropRects(loadedImage.width, loadedImage.height, options);

  return {
    left: cropImageToDataUrl(loadedImage.element, rects.left),
    right: cropImageToDataUrl(loadedImage.element, rects.right),
  };
}

export async function generateAvatarReferenceImages(
  imageUrl: string,
  options: AvatarReferenceCropOptions = {}
): Promise<AvatarReferenceImages> {
  const loadedImage = await loadAvatarReferenceImage(imageUrl);
  return generateAvatarReferenceImagesFromLoadedImage(loadedImage, options);
}
