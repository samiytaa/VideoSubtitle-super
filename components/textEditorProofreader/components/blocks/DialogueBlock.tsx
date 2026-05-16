import React from 'react';
import { InsertMenu } from '../menus';
import { useEditorBlockContext } from '../../context/EditorBlockContext';
import { BasicBlockItemProps } from './types';
import { ParsedBlock } from '../../types';
import { SharedDialogueItem } from './SharedDialogueItem';

const DialogueBlockItem = React.memo(({ block, index, blockKey }: BasicBlockItemProps<Extract<ParsedBlock, { type: 'dialogue' }>>) => {
  const editor = useEditorBlockContext();
  const isEditing = editor.editingState.blockIndex === index;
  const isSelected = editor.editingState.selectedBlockIndices.has(index);
  const isMultiSelectMode = editor.editingState.isMultiSelectMode;
  const isInsertMenuOpen = editor.menuState.activeInsertMenuIndex === index;

  const renderActionButtons = () => (
    <>
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); editor.actions.convertDialogueToNarration(index); }} className="px-2 py-1 bg-amber-500 text-white rounded text-xs hover:bg-amber-600 transition-colors" title="转为旁白">⇄</button>
        <button onClick={(e) => { e.stopPropagation(); editor.actions.toggleInsertMenu(index); }} className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors" title="插入">＋</button>
        <button onClick={async (e) => { e.stopPropagation(); await editor.actions.deleteDialogueBlock(index); }} className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors" title="删除">✕</button>
      </div>
      <InsertMenu
        isOpen={isInsertMenuOpen}
        onClose={editor.actions.closeInsertMenu}
        onInsert={(type) => editor.actions.insertBlockFromMenu(index, type)}
      />
    </>
  );

  return (
    <SharedDialogueItem
      key={index}
      character={block.character || ''}
      content={block.content}
      avatarStyle={block.avatarStyle}
      customColor={block.customColor}
      isEditing={isEditing}
      isSelected={isSelected}
      isMultiSelectMode={isMultiSelectMode}
      editingCharacter={editor.editingState.character}
      editingContent={editor.editingState.content}
      editingAvatar={editor.editingState.avatar}
      showAvatarPicker={editor.menuState.showAvatarPicker}
      characterAvatarHistory={editor.resources.characterAvatarHistory}
      zIndexClass={`z-0 hover:z-20 ${isInsertMenuOpen ? 'z-30' : ''}`}
      onClick={() => {
        if (isMultiSelectMode) editor.actions.toggleBlockSelection(index);
        else if (!isEditing) editor.actions.startEditing(index, block);
      }}
      onCheckboxChange={() => editor.actions.toggleBlockSelection(index)}
      onSaveEditing={editor.actions.saveEditing}
      onCancelEditing={editor.actions.cancelEditing}
      onSetEditingCharacter={editor.actions.setEditingCharacter}
      onSetEditingContent={editor.actions.setEditingContent}
      onSetEditingAvatar={editor.actions.setEditingAvatar}
      onSetShowAvatarPicker={editor.actions.setShowAvatarPicker}
      renderActionButtons={renderActionButtons}
      itemRef={(el) => editor.actions.setBlockRef(blockKey, el)}
    />
  );
});

export default DialogueBlockItem;
