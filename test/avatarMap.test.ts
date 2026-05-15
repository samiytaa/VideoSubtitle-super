import { describe, expect, it } from 'vitest';
import { findBestAvatarMatch, normalizeAvatarName, resolveAvatarName } from '../utils/avatarMap';

describe('findBestAvatarMatch', () => {
  it('prefers the standard small avatar for mitan characters', () => {
    expect(findBestAvatarMatch('周群')).toBe('周群');
    expect(findBestAvatarMatch('陈群')).toBe('陈群');
  });

  it('returns null when there is no matching avatar', () => {
    expect(findBestAvatarMatch('不存在的角色')).toBeNull();
  });

  it('normalizes and resolves legacy avatar names', () => {
    expect(normalizeAvatarName('小头像-周群')).toBe('周群');
    expect(resolveAvatarName('小头像-周群')).toBe('周群');
  });
});
