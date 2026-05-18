import React from 'react';
import { getAvatarPath } from '../../../../utils/avatarMap';
import { getCharacterColor } from '../../textParserUtils';
import AvatarPicker from '../../../AvatarPicker';
import { ExtractedFrame, VideoFile, ROI } from '../../../../types';
import { navigateToAvatarRoute } from '../../../../utils/runtimeConfig';

export interface SharedDialogueItemProps {
  // 数据
  character: string;
  content: string;
  avatarStyle?: string;
  customColor?: string;
  
  // 状态
  isEditing: boolean;
  isSelected: boolean;
  isMultiSelectMode: boolean;
  isHighlighted?: boolean;
  
  // 编辑状态
  editingCharacter: string;
  editingContent: string;
  editingAvatar: string;
  showAvatarPicker: boolean;
  characterAvatarHistory: Record<string, string[]>;
  
  // 样式配置
  containerClassName?: string;
  zIndexClass?: string;
  marginClass?: string;
  
  // 回调
  onClick: () => void;
  onDoubleClick?: () => void;
  onCheckboxChange: () => void;
  onStartEditing?: () => void;
  onSaveEditing: () => void;
  onCancelEditing: () => void;
  onSetEditingCharacter: (value: string) => void;
  onSetEditingContent: (value: string) => void;
  onSetEditingAvatar: (value: string) => void;
  onSetShowAvatarPicker: (value: boolean) => void;
  
  // 操作按钮（可选，用于自定义）
  renderActionButtons?: () => React.ReactNode;
  
  // 头像选择器相关
  extractedFrames?: ExtractedFrame[];
  onDeleteFrames?: (ids: string[]) => void;
  onJumpToTime?: (timestamp: string) => void;
  activeVideo?: VideoFile | null;
  videoSrc?: string | null;
  sharedVideoRef?: React.MutableRefObject<HTMLVideoElement | null>;
  roi?: ROI | null;
  onCaptureFrame?: (frame: ExtractedFrame) => void;
  selectedReferenceFrameId?: string | null;
  onSelectReferenceFrame?: (frame: ExtractedFrame) => void;
  
  // ref
  itemRef?: (el: HTMLDivElement | null) => void;
}

export const SharedDialogueItem: React.FC<SharedDialogueItemProps> = ({
  character,
  content,
  avatarStyle,
  customColor,
  isEditing,
  isSelected,
  isMultiSelectMode,
  isHighlighted = false,
  editingCharacter,
  editingContent,
  editingAvatar,
  showAvatarPicker,
  characterAvatarHistory,
  containerClassName = '',
  zIndexClass = '',
  marginClass = '',
  onClick,
  onDoubleClick,
  onCheckboxChange,
  onSaveEditing,
  onCancelEditing,
  onSetEditingCharacter,
  onSetEditingContent,
  onSetEditingAvatar,
  onSetShowAvatarPicker,
  renderActionButtons,
  extractedFrames = [],
  onDeleteFrames,
  onJumpToTime,
  activeVideo,
  videoSrc,
  sharedVideoRef,
  roi,
  onCaptureFrame,
  selectedReferenceFrameId,
  onSelectReferenceFrame,
  itemRef
}) => {
  const characterColor = getCharacterColor(character, customColor);
  const openAvatarPage = React.useCallback(() => {
    navigateToAvatarRoute(editingAvatar);
  }, [editingAvatar]);

  return (
    <div
      ref={itemRef}
      className={`group relative bg-white border px-4 py-3 rounded-lg text-sm leading-relaxed cursor-pointer transition-all hover:shadow-md ${zIndexClass} ${marginClass} ${containerClassName} ${isEditing ? 'ring-2 ring-indigo-500' : isHighlighted ? 'ring-2 ring-yellow-400' : ''} ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
      style={{ borderColor: isSelected ? '#3b82f6' : characterColor }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {isEditing ? (
        <div onClick={(e) => e.stopPropagation()} className="space-y-2">
          <div>
            <label className="block mb-1 text-xs text-gray-600 font-medium">角色名：</label>
            <input
              type="text"
              value={editingCharacter}
              onChange={(e) => onSetEditingCharacter(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block mb-1 text-xs text-gray-600 font-medium">对话内容：</label>
            <textarea
              value={editingContent}
              onChange={(e) => onSetEditingContent(e.target.value)}
              className="w-full min-h-[60px] px-3 py-2 border border-gray-300 rounded-lg text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-3 items-start">
            <div className="shrink-0">
              {editingAvatar ? (
                <div
                  className="w-[100px] h-[100px] border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-50 cursor-pointer hover:border-blue-500 transition-colors"
                  onClick={openAvatarPage}
                  title="点击进入头像页"
                >
                  {(() => {
                    const avatarPath = getAvatarPath(editingAvatar);
                    if (!avatarPath) return <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">无效头像</div>;
                    return <img src={avatarPath} alt={editingAvatar} className="w-[120%] h-[120%] object-cover object-center -translate-x-[8.33%] -translate-y-[8.33%]" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
                  })()}
                </div>
              ) : (
                <div
                  className="w-[100px] h-[100px] border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 cursor-pointer hover:border-blue-500 transition-colors"
                  onClick={openAvatarPage}
                  title="点击进入头像页"
                >
                  <span className="text-gray-400 text-xs text-center px-2">未选择<br />头像</span>
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <button onClick={() => onSetShowAvatarPicker(true)} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors whitespace-nowrap">选择头像</button>
                <button onClick={openAvatarPage} className="px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-xs font-medium hover:bg-indigo-600 transition-colors whitespace-nowrap">进入头像页</button>
                <button onClick={() => onSetEditingAvatar('')} className="px-3 py-1.5 bg-gray-500 text-white rounded-lg text-xs font-medium hover:bg-gray-600 transition-colors whitespace-nowrap">清空头像</button>
              </div>
              <input
                type="text"
                value={editingAvatar}
                onChange={(e) => onSetEditingAvatar(e.target.value)}
                placeholder="例如：广陵王-无语"
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {(() => {
                const history = characterAvatarHistory[editingCharacter] || [];
                if (history.length === 0) return null;
                return (
                  <div className="flex gap-1.5 flex-wrap">
                    {history.map((avatarName) => {
                      const p = getAvatarPath(avatarName);
                      if (!p) return null;
                      const isActive = editingAvatar === avatarName;
                      return (
                        <div
                          key={avatarName}
                          onClick={() => onSetEditingAvatar(avatarName)}
                          title={avatarName}
                          className={`w-[48px] h-[48px] rounded-lg overflow-hidden cursor-pointer border-2 transition-colors ${isActive ? 'border-blue-500' : 'border-gray-300 hover:border-blue-400'}`}
                        >
                          <img src={p} alt={avatarName} className="w-[120%] h-[120%] object-cover object-center -translate-x-[8.33%] -translate-y-[8.33%]" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onSaveEditing} className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors">保存</button>
            <button onClick={onCancelEditing} className="px-4 py-1.5 bg-gray-500 text-white rounded-lg text-xs font-medium hover:bg-gray-600 transition-colors">取消</button>
          </div>
          {showAvatarPicker && (
            <AvatarPicker
              onSelect={(name) => { onSetEditingAvatar(name); onSetShowAvatarPicker(false); }}
              onClose={() => onSetShowAvatarPicker(false)}
              currentAvatar={editingAvatar}
              extractedFrames={extractedFrames}
              onDeleteFrames={onDeleteFrames}
              onJumpToTime={onJumpToTime}
              activeVideo={activeVideo}
              videoSrc={videoSrc}
              sharedVideoRef={sharedVideoRef}
              roi={roi}
              onCaptureFrame={onCaptureFrame}
              selectedReferenceFrameId={selectedReferenceFrameId}
              onSelectReferenceFrame={onSelectReferenceFrame}
            />
          )}
        </div>
      ) : (
        <>
          <div className="flex gap-3 items-start">
            {isMultiSelectMode && (
              <div className="shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={onCheckboxChange}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                />
              </div>
            )}
            {avatarStyle && (() => {
              const avatarPath = getAvatarPath(avatarStyle);
              return avatarPath ? (
                <div className="shrink-0 w-[70px] h-[70px] overflow-hidden rounded">
                  <img src={avatarPath} alt={character} className="w-[120%] h-[120%] object-cover object-center -translate-x-[8.33%] -translate-y-[8.33%]" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              ) : null;
            })()}
            <div className="flex-1 min-w-0">
              <div className="flex items-center mb-1">
                <span className="text-base mr-1 font-bold" style={{ color: characterColor }}>◆</span>
                <span className="font-bold text-sm" style={{ color: characterColor }}>{character}</span>
              </div>
              <div className="text-gray-700 text-sm leading-relaxed">{content}</div>
            </div>
          </div>
          {renderActionButtons && renderActionButtons()}
        </>
      )}
    </div>
  );
};
