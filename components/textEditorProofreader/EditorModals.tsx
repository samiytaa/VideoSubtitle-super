import React from 'react';
import AvatarPicker from '../AvatarPicker';
import QuickReplaceDialog from './QuickReplaceDialog';
import SearchDialog from './SearchDialog';
import { Chapter, SearchResult } from './types';
import { ExtractedFrame, ROI, VideoFile } from '../../types';

interface EditorModalsProps {
  showSearchDialog: boolean;
  searchKeyword: string;
  searchResults: SearchResult[];
  chapters: Chapter[];
  onCloseSearchDialog: () => void;
  onSearch: (keyword: string) => void;
  onJumpSearchResult: (result: SearchResult) => void;
  showAvatarPicker: boolean;
  onSelectAvatar: (avatarName: string) => void;
  onCloseAvatarPicker: () => void;
  editingAvatar: string;
  showBatchAvatarPicker: boolean;
  onBatchSelectAvatar: (avatarName: string) => void;
  onCloseBatchAvatarPicker: () => void;
  showNestedAvatarPicker: boolean;
  onSelectNestedAvatar: (avatarName: string) => void;
  onCloseNestedAvatarPicker: () => void;
  editingNestedBlockAvatar: string;
  showQuickReplaceDialog: boolean;
  quickReplaceCharacters: string[];
  selectedCharacterName: string;
  onSelectCharacterName: (character: string) => void;
  onQuickReplaceConfirm: (avatarName: string) => void;
  onQuickReplaceBatchConfirm: (replaceMap: Record<string, string>) => void;
  onCloseQuickReplaceDialog: () => void;
  characterAvatarHistory: Record<string, string[]>;
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  extractedFrames: ExtractedFrame[];
  onDeleteFrames?: (ids: string[]) => void;
  onJumpToTime?: (timestamp: string) => void;
  activeVideo?: VideoFile | null;
  videoSrc?: string | null;
  sharedVideoRef?: React.MutableRefObject<HTMLVideoElement | null>;
  roi?: ROI | null;
  onCaptureFrame?: (frame: ExtractedFrame) => void;
}

const EditorModals: React.FC<EditorModalsProps> = (props) => {
  const sharedAvatarProps = {
    extractedFrames: props.extractedFrames,
    onDeleteFrames: props.onDeleteFrames,
    onJumpToTime: props.onJumpToTime,
    activeVideo: props.activeVideo,
    videoSrc: props.videoSrc,
    sharedVideoRef: props.sharedVideoRef,
    roi: props.roi,
    onCaptureFrame: props.onCaptureFrame
  };

  return (
    <>
      <SearchDialog
        open={props.showSearchDialog}
        keyword={props.searchKeyword}
        results={props.searchResults}
        chapters={props.chapters}
        onClose={props.onCloseSearchDialog}
        onSearch={props.onSearch}
        onJump={props.onJumpSearchResult}
      />

      {props.showAvatarPicker && (
        <AvatarPicker onSelect={props.onSelectAvatar} onClose={props.onCloseAvatarPicker} currentAvatar={props.editingAvatar} {...sharedAvatarProps} />
      )}

      {props.showBatchAvatarPicker && (
        <AvatarPicker onSelect={props.onBatchSelectAvatar} onClose={props.onCloseBatchAvatarPicker} currentAvatar="" {...sharedAvatarProps} />
      )}

      {props.showNestedAvatarPicker && (
        <AvatarPicker
          onSelect={props.onSelectNestedAvatar}
          onClose={props.onCloseNestedAvatarPicker}
          currentAvatar={props.editingNestedBlockAvatar}
          {...sharedAvatarProps}
        />
      )}

      {props.showQuickReplaceDialog && (
        <QuickReplaceDialog
          characters={props.quickReplaceCharacters}
          selectedCharacter={props.selectedCharacterName}
          onCharacterSelect={props.onSelectCharacterName}
          onConfirm={props.onQuickReplaceConfirm}
          onBatchConfirm={props.onQuickReplaceBatchConfirm}
          onClose={props.onCloseQuickReplaceDialog}
          avatarHistory={props.characterAvatarHistory}
          addToast={props.addToast}
          {...sharedAvatarProps}
        />
      )}
    </>
  );
};

export default EditorModals;

