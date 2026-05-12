import { DependencyList, MutableRefObject, useEffect } from 'react';

interface ScrollPersistenceOptions {
  leftKey: string;
  rightKey: string;
  saveDeps?: DependencyList;
  restoreDeps?: DependencyList;
}

export function useScrollPersistence(
  leftRef: MutableRefObject<HTMLDivElement | null>,
  rightRef: MutableRefObject<HTMLDivElement | null>,
  options: ScrollPersistenceOptions
) {
  const { leftKey, rightKey, saveDeps = [], restoreDeps = [] } = options;

  useEffect(() => {
    let rafId: number | null = null;
    const saveScrollPositions = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        if (leftRef.current) {
          localStorage.setItem(leftKey, String(leftRef.current.scrollTop));
        }
        if (rightRef.current) {
          localStorage.setItem(rightKey, String(rightRef.current.scrollTop));
        }
      });
    };

    const flushPending = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (leftRef.current) {
        localStorage.setItem(leftKey, String(leftRef.current.scrollTop));
      }
      if (rightRef.current) {
        localStorage.setItem(rightKey, String(rightRef.current.scrollTop));
      }
    };

    const leftEl = leftRef.current;
    const rightEl = rightRef.current;

    if (leftEl) leftEl.addEventListener('scroll', saveScrollPositions);
    if (rightEl) rightEl.addEventListener('scroll', saveScrollPositions);

    return () => {
      flushPending();
      if (leftEl) leftEl.removeEventListener('scroll', saveScrollPositions);
      if (rightEl) rightEl.removeEventListener('scroll', saveScrollPositions);
    };
  }, [leftRef, rightRef, leftKey, rightKey, ...saveDeps]);

  useEffect(() => {
    const leftScroll = localStorage.getItem(leftKey);
    const rightScroll = localStorage.getItem(rightKey);

    if (leftRef.current && leftScroll) {
      leftRef.current.scrollTop = Number(leftScroll);
    }
    if (rightRef.current && rightScroll) {
      rightRef.current.scrollTop = Number(rightScroll);
    }
  }, [leftRef, rightRef, leftKey, rightKey, ...restoreDeps]);
}
