import { useMemo } from 'react';
import { ExtractedFrame } from '../types';

export type GroupFilter = 'all' | 'group1' | 'group2';

/** 从文件名中提取时间（秒，含毫秒） */
const extractTimeFromFilename = (filename: string): number => {
  const match = filename.match(/\[(\d{2})[_:](\d{2})[_:](\d{2})\.(\d{3})\]/);
  if (!match) return 0;
  const [, h, m, s, ms] = match;
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
};

/** 从文件名中提取分组标识（g1 / g2） */
const extractGroupFromFilename = (filename: string): string => {
  const match = filename.match(/^(g[12])_/);
  return match ? match[1] : 'g1';
};

const GROUP_PRIORITY: Record<string, number> = { g2: 1, g1: 2 };

interface UseFrameFilterOptions {
  frames: ExtractedFrame[];
  selectedGroup: GroupFilter;
  /** 额外依赖项，用于强制重新排序（如 sortTrigger） */
  sortTrigger?: number;
}

/**
 * 对 ExtractedFrame 列表按分组过滤，并按时间 + 分组优先级排序。
 * 两个 Gallery 组件共用同一套过滤/排序逻辑，统一在此维护。
 */
export function useFrameFilter({
  frames,
  selectedGroup,
  sortTrigger,
}: UseFrameFilterOptions): ExtractedFrame[] {
  return useMemo(() => {
    const filtered =
      selectedGroup === 'all'
        ? [...frames]
        : frames.filter((f) => f.group === selectedGroup);

    filtered.sort((a, b) => {
      const tA = extractTimeFromFilename(a.filename);
      const tB = extractTimeFromFilename(b.filename);
      if (tA !== tB) return tA - tB;

      const pA = GROUP_PRIORITY[extractGroupFromFilename(a.filename)] ?? 999;
      const pB = GROUP_PRIORITY[extractGroupFromFilename(b.filename)] ?? 999;
      if (pA !== pB) return pA - pB;

      return a.filename.localeCompare(b.filename);
    });

    return filtered;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames, selectedGroup, sortTrigger]);
}
