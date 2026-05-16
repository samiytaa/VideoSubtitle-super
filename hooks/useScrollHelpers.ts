import { useRef, useCallback } from 'react';

export function useScrollHelpers() {
  const sectionUploadRef = useRef<HTMLDivElement>(null);
  const sectionRoiRef = useRef<HTMLDivElement>(null);
  const sectionProcessRef = useRef<HTMLDivElement>(null);
  const sectionResultRef = useRef<HTMLDivElement>(null);

  const scrollTo = useCallback((ref: React.RefObject<HTMLDivElement | null>) => {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  const scrollToUpload = useCallback(() => scrollTo(sectionUploadRef), [scrollTo]);
  const scrollToRoi = useCallback(() => scrollTo(sectionRoiRef), [scrollTo]);
  const scrollToProcess = useCallback(() => scrollTo(sectionProcessRef), [scrollTo]);
  const scrollToResult = useCallback(() => scrollTo(sectionResultRef), [scrollTo]);

  return {
    sectionUploadRef,
    sectionRoiRef,
    sectionProcessRef,
    sectionResultRef,
    scrollToUpload,
    scrollToRoi,
    scrollToProcess,
    scrollToResult,
  };
}
