import { useState, useEffect, useRef, useMemo } from 'react';

interface UseGalleryPaginationOptions {
  /** 当前列表总长度，用于计算总页数和自动修正页码 */
  totalItems: number;
  /** localStorage key 前缀，不同 Gallery 传不同值避免冲突 */
  storageKey: string;
  /** 默认每页数量，首次加载时使用 */
  defaultItemsPerPage?: number;
}

interface UseGalleryPaginationResult {
  currentPage: number;
  setCurrentPage: (value: number | ((prev: number) => number)) => void;
  itemsPerPage: number;
  setItemsPerPage: (n: number) => void;
  totalPages: number;
  /** 根据 currentPage / itemsPerPage 从列表中切出当前页数据 */
  paginate: <T>(items: T[]) => T[];
}

/**
 * 通用分页 hook，带 localStorage 持久化。
 * 当 totalItems 变化导致当前页超出范围时自动修正到最后一页。
 */
export function useGalleryPagination({
  totalItems,
  storageKey,
  defaultItemsPerPage = 50,
}: UseGalleryPaginationOptions): UseGalleryPaginationResult {
  const pageKey = `${storageKey}_page`;
  const perPageKey = `${storageKey}_perPage`;

  const readInt = (key: string, fallback: number): number => {
    if (typeof window === 'undefined') return fallback;
    const v = parseInt(window.localStorage.getItem(key) ?? '', 10);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };

  const [currentPage, setCurrentPage] = useState(() => readInt(pageKey, 1));
  const [itemsPerPage, setItemsPerPageState] = useState(() =>
    readInt(perPageKey, defaultItemsPerPage)
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / itemsPerPage)),
    [totalItems, itemsPerPage]
  );

  // 数据量变化时自动修正页码
  useEffect(() => {
    setCurrentPage((prev) => {
      if (!prev || prev < 1) return 1;
      if (prev > totalPages) return totalPages;
      return prev;
    });
  }, [totalPages]);

  // 持久化页码
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(pageKey, String(currentPage));
    }
  }, [currentPage, pageKey]);

  // 持久化每页数量
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(perPageKey, String(itemsPerPage));
    }
  }, [itemsPerPage, perPageKey]);

  const setItemsPerPage = (n: number) => {
    setItemsPerPageState(n);
    setCurrentPage(1);
  };

  const paginate = <T>(items: T[]): T[] => {
    const start = (currentPage - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  };

  return { currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, totalPages, paginate };
}
