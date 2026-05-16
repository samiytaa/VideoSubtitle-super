import { useCallback } from 'react';
import { Notifier } from '../components/Notifications';
import { AppTab } from '../components/app/AppHeader';

interface UseJumpToTimeOptions {
  videoElementRef: React.RefObject<HTMLVideoElement | null>;
  notifier: Notifier;
  onSetActiveTab: (tab: AppTab) => void;
  onScrollToRoi: () => void;
}

export function useJumpToTime(options: UseJumpToTimeOptions) {
  const { videoElementRef, notifier, onSetActiveTab, onScrollToRoi } = options;

  const handleJumpToTime = useCallback(
    (timestamp: string) => {
      const parts = timestamp.split(':');
      if (parts.length !== 3) return;

      const [h, m, secStr] = parts;
      const [s, ms = '0'] = secStr.split('.');
      const totalSeconds =
        parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;

      onSetActiveTab('extract');

      setTimeout(() => {
        onScrollToRoi();

        if (videoElementRef.current) {
          videoElementRef.current.currentTime = totalSeconds;
          notifier.addToast(`已跳转到 ${timestamp}`, 'success');
        }
      }, 300);
    },
    [videoElementRef, notifier, onSetActiveTab, onScrollToRoi]
  );

  return { handleJumpToTime };
}
