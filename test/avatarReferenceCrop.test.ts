import { describe, expect, it } from 'vitest';
import { getAvatarReferenceCropRects } from '../utils/avatarReferenceCrop';

describe('getAvatarReferenceCropRects', () => {
  it('returns stable left and right portrait crop areas for widescreen frames', () => {
    const rects = getAvatarReferenceCropRects(1920, 1080);

    expect(rects.left).toEqual({
      x: 38,
      y: 65,
      width: 653,
      height: 756,
    });
    expect(rects.right).toEqual({
      x: 1229,
      y: 65,
      width: 653,
      height: 756,
    });
  });

  it('keeps crop rectangles inside the image bounds for small images', () => {
    const rects = getAvatarReferenceCropRects(120, 80);

    expect(rects.left.x).toBeGreaterThanOrEqual(0);
    expect(rects.left.y).toBeGreaterThanOrEqual(0);
    expect(rects.right.x + rects.right.width).toBeLessThanOrEqual(120);
    expect(rects.right.y + rects.right.height).toBeLessThanOrEqual(80);
  });
});
