import { describe, expect, it } from 'vitest';
import { getAvatarReferenceCropRects } from '../utils/avatarReferenceCrop';

describe('getAvatarReferenceCropRects', () => {
  it('returns stable left and right portrait crop areas for widescreen frames', () => {
    const rects = getAvatarReferenceCropRects(1920, 1080);

    expect(rects.left).toEqual({
      x: 0,
      y: 0,
      width: 442,
      height: 1080,
    });
    expect(rects.right).toEqual({
      x: 1478,
      y: 0,
      width: 442,
      height: 1080,
    });
  });

  it('keeps crop rectangles inside the image bounds for small images', () => {
    const rects = getAvatarReferenceCropRects(120, 80);

    expect(rects.left.x).toBeGreaterThanOrEqual(0);
    expect(rects.left.y).toBeGreaterThanOrEqual(0);
    expect(rects.right.x + rects.right.width).toBeLessThanOrEqual(120);
    expect(rects.right.y + rects.right.height).toBeLessThanOrEqual(80);
  });

  it('allows different crop widths for left and right sides', () => {
    const rects = getAvatarReferenceCropRects(1920, 1080, {
      leftWidthRatio: 0.3,
      rightWidthRatio: 0.45,
    });

    expect(rects.left.width).toBeLessThan(rects.right.width);
    expect(rects.left.height).toBe(1080);
    expect(rects.right.height).toBe(1080);
    expect(rects.left.x).toBe(0);
    expect(rects.right.x + rects.right.width).toBeLessThanOrEqual(1920);
  });
});
