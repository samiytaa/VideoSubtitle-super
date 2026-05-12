import { useCallback, useEffect, useState } from 'react';

export const useMenuState = () => {
  const [activeInsertMenuIndex, setActiveInsertMenuIndex] = useState<number | null>(null);
  const [activeNarrationConvertMenuIndex, setActiveNarrationConvertMenuIndex] = useState<number | null>(null);

  const toggleInsertMenu = useCallback((index: number) => {
    setActiveInsertMenuIndex((prev) => (prev === index ? null : index));
    setActiveNarrationConvertMenuIndex(null);
  }, []);

  const toggleNarrationConvertMenu = useCallback((index: number) => {
    setActiveNarrationConvertMenuIndex((prev) => (prev === index ? null : index));
    setActiveInsertMenuIndex(null);
  }, []);

  const closeAllMenus = useCallback(() => {
    setActiveInsertMenuIndex(null);
    setActiveNarrationConvertMenuIndex(null);
  }, []);

  const closeInsertMenu = useCallback(() => {
    setActiveInsertMenuIndex(null);
  }, []);

  const closeNarrationConvertMenu = useCallback(() => {
    setActiveNarrationConvertMenuIndex(null);
  }, []);

  useEffect(() => {
    const handleDocumentClick = () => closeAllMenus();
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [closeAllMenus]);

  return {
    activeInsertMenuIndex,
    activeNarrationConvertMenuIndex,
    toggleInsertMenu,
    toggleNarrationConvertMenu,
    closeAllMenus,
    closeInsertMenu,
    closeNarrationConvertMenu
  };
};
