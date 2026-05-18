import React from 'react';
import AvatarPicker from '../AvatarPicker';
import { ExtractedFrame, ROI, VideoFile } from '../../types';
import { consumeAvatarRouteSelection } from '../../utils/runtimeConfig';

type AvatarTabProps = {
  extractedFrames: ExtractedFrame[];
  onDeleteFrames?: (ids: string[]) => void;
  onJumpToTime?: (timestamp: string) => void;
  activeVideo?: VideoFile | null;
  videoSrc?: string | null;
  videoElementRef?: React.MutableRefObject<HTMLVideoElement | null>;
  roi?: ROI | null;
  onCaptureFrame?: (frame: ExtractedFrame) => void;
};

const LAST_AVATAR_STORAGE_KEY = 'avatarPicker_lastAvatar';

const AvatarTab: React.FC<AvatarTabProps> = ({
  extractedFrames,
  onDeleteFrames,
  onJumpToTime,
  activeVideo,
  videoSrc,
  videoElementRef,
  roi,
  onCaptureFrame,
}) => {
  const [selectedAvatar, setSelectedAvatar] = React.useState<string>(() => {
    const queuedSelection = consumeAvatarRouteSelection();
    if (queuedSelection !== null) {
      return queuedSelection;
    }
    return localStorage.getItem(LAST_AVATAR_STORAGE_KEY) || '';
  });

  React.useEffect(() => {
    const handleAvatarRouteSelectionChange = () => {
      const queuedSelection = consumeAvatarRouteSelection();
      if (queuedSelection !== null) {
        setSelectedAvatar(queuedSelection);
      }
    };

    window.addEventListener('avatar-route-selection-changed', handleAvatarRouteSelectionChange);
    return () => {
      window.removeEventListener('avatar-route-selection-changed', handleAvatarRouteSelectionChange);
    };
  }, []);

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <AvatarPicker
        embedded={true}
        currentAvatar={selectedAvatar}
        onSelect={setSelectedAvatar}
        onClose={() => undefined}
        extractedFrames={extractedFrames}
        onDeleteFrames={onDeleteFrames}
        onJumpToTime={onJumpToTime}
        activeVideo={activeVideo}
        videoSrc={videoSrc}
        sharedVideoRef={videoElementRef}
        roi={roi}
        onCaptureFrame={onCaptureFrame}
      />
    </div>
  );
};

export default AvatarTab;
