import React from 'react';
import { getAvatarPath } from '../../../../utils/avatarMap';
import { getCharacterColor } from '../../textParserUtils';
import { InsertMenu } from '../menus';
import { useEditorBlockContext } from '../../context/EditorBlockContext';
import { BasicBlockItemProps } from './types';
import { ParsedBlock } from '../../types';
import { handleError } from '../../../../utils/errorHandler';

const DialogueBlockItem = React.memo(({ block, index, blockKey }: BasicBlockItemProps<Extract<ParsedBlock, { type: 'dialogue' }>>) => {
  const editor = useEditorBlockContext();
  const isEditing = editor.editingState.blockIndex === index;
  const isSelected = editor.editingState.selectedBlockIndices.has(index);
  const isMultiSelectMode = editor.editingState.isMultiSelectMode;
  const characterColor = getCharacterColor(block.character || '', block.customColor);

  return (
    <div
      key={index}
      ref={(el) => editor.actions.setBlockRef(blockKey, el)}
      className={`group relative bg-white border px-4 py-3 mb-1.5 rounded-lg text-sm leading-relaxed flex gap-3 items-start cursor-pointer transition-all hover:shadow-md ${isEditing ? 'ring-2 ring-indigo-500' : ''} ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
      style={{ borderColor: isSelected ? '#3b82f6' : characterColor }}
      onClick={() => {
        if (isMultiSelectMode) editor.actions.toggleBlockSelection(index);
        else if (!isEditing) editor.actions.startEditing(index, block);
      }}
    >
      {isMultiSelectMode && (
        <div className="shrink-0 flex items-center" onClick={(e) => { e.stopPropagation(); editor.actions.toggleBlockSelection(index); }}>
          <input type="checkbox" checked={isSelected} onChange={() => editor.actions.toggleBlockSelection(index)} className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer" />
        </div>
      )}
      {block.avatarStyle && !isEditing && (
        <div className="shrink-0 w-[70px] h-[70px] overflow-hidden rounded">
          {(() => {
            const avatarPath = getAvatarPath(block.avatarStyle);
            if (!avatarPath) return null;
            return <img src={avatarPath} alt={block.character} className="w-[120%] h-[120%] object-cover object-center -translate-x-[8.33%] -translate-y-[8.33%]" onError={(e) => { handleError(new Error(`头像加载失败: ${block.avatarStyle}`), undefined, { context: 'Avatar load failed' }); (e.target as HTMLImageElement).style.display = 'none'; }} />;
          })()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div onClick={(e) => e.stopPropagation()} className="space-y-2">
            <div>
              <div className="flex gap-3 items-start">
                <div className="shrink-0">
                  {editor.editingState.avatar ? (
                    <div className="w-[100px] h-[100px] border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-50 cursor-pointer hover:border-blue-500 transition-colors" onClick={() => editor.actions.setShowAvatarPicker(true)} title="点击更换头像">
                      {(() => {
                        const avatarPath = getAvatarPath(editor.editingState.avatar);
                        if (!avatarPath) return <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">无效头像</div>;
                        return <img src={avatarPath} alt={editor.editingState.avatar} className="w-[120%] h-[120%] object-cover object-center -translate-x-[8.33%] -translate-y-[8.33%]" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
                      })()}
                    </div>
                  ) : (
                    <div className="w-[100px] h-[100px] border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 cursor-pointer hover:border-blue-500 transition-colors" onClick={() => editor.actions.setShowAvatarPicker(true)} title="点击选择头像">
                      <span className="text-gray-400 text-xs text-center px-2">未选择<br />头像</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <button onClick={() => editor.actions.setShowAvatarPicker(true)} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors whitespace-nowrap">选择头像</button>
                    <button onClick={() => editor.actions.setEditingAvatar('')} className="px-3 py-1.5 bg-gray-500 text-white rounded-lg text-xs font-medium hover:bg-gray-600 transition-colors whitespace-nowrap">清空头像</button>
                  </div>
                  <input type="text" value={editor.editingState.avatar} onChange={(e) => editor.actions.setEditingAvatar(e.target.value)} placeholder="例如：广陵王-无语" className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  {(() => {
                    const history = editor.resources.characterAvatarHistory[editor.editingState.character] || [];
                    if (history.length === 0) return null;
                    return (
                      <div className="flex gap-1.5 flex-wrap">
                        {history.map((avatarName) => {
                          const p = getAvatarPath(avatarName);
                          if (!p) return null;
                          const isActive = editor.editingState.avatar === avatarName;
                          return (
                            <div key={avatarName} onClick={() => editor.actions.setEditingAvatar(avatarName)} title={avatarName} className={`w-[48px] h-[48px] rounded-lg overflow-hidden cursor-pointer border-2 transition-colors ${isActive ? 'border-blue-500' : 'border-gray-300 hover:border-blue-400'}`}>
                              <img src={p} alt={avatarName} className="w-[120%] h-[120%] object-cover object-center -translate-x-[8.33%] -translate-y-[8.33%]" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
            <div>
              <label className="block mb-1 text-xs text-gray-600 font-medium">角色名：</label>
              <input type="text" value={editor.editingState.character} onChange={(e) => editor.actions.setEditingCharacter(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block mb-1 text-xs text-gray-600 font-medium">对话内容：</label>
              <textarea value={editor.editingState.content} onChange={(e) => editor.actions.setEditingContent(e.target.value)} className="w-full min-h-[60px] px-3 py-2 border border-gray-300 rounded-lg text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
            </div>
            <div className="flex gap-2">
              <button onClick={editor.actions.saveEditing} className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors">保存</button>
              <button onClick={editor.actions.cancelEditing} className="px-4 py-1.5 bg-gray-500 text-white rounded-lg text-xs font-medium hover:bg-gray-600 transition-colors">取消</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center mb-1.5">
              <span className="text-base mr-1 font-bold" style={{ color: characterColor }}>◆</span>
              <span className="font-bold text-sm" style={{ color: characterColor }}>{block.character}</span>
            </div>
            <div className="text-gray-700 text-sm leading-relaxed">{block.content}</div>
            <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={(e) => { e.stopPropagation(); editor.actions.convertDialogueToNarration(index); }} className="px-2 py-1 bg-amber-500 text-white rounded text-xs hover:bg-amber-600 transition-colors" title="转为旁白">⇄</button>
              <button onClick={(e) => { e.stopPropagation(); editor.actions.toggleInsertMenu(index); }} className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors" title="插入">＋</button>
              <button onClick={async (e) => { e.stopPropagation(); await editor.actions.deleteDialogueBlock(index); }} className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors" title="删除">✕</button>
            </div>
            <InsertMenu
              isOpen={editor.menuState.activeInsertMenuIndex === index}
              onClose={editor.actions.closeInsertMenu}
              onInsert={(type) => editor.actions.insertBlockFromMenu(index, type)}
            />
          </>
        )}
      </div>
    </div>
  );
});

export default DialogueBlockItem;
