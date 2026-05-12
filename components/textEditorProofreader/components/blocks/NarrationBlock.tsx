import React from 'react';
import { InsertMenu, ConvertMenu } from '../menus';
import { useEditorBlockContext } from '../../context/EditorBlockContext';
import { BasicBlockItemProps } from './types';
import { ParsedBlock } from '../../types';

const NarrationBlockItem = React.memo(({ block, index, blockKey }: BasicBlockItemProps<Extract<ParsedBlock, { type: 'narration' }>>) => {
  const editor = useEditorBlockContext();
  const isEditing = editor.editingState.blockIndex === index;

  return (
    <div
      key={index}
      ref={(el) => editor.actions.setBlockRef(blockKey, el)}
      className={`group relative px-4 py-2.5 mb-1.5 rounded-lg text-sm leading-relaxed cursor-pointer transition-all ${isEditing ? 'ring-2 ring-indigo-500' : ''}`}
      style={{ backgroundColor: '#7b7b77', color: '#ffffff' }}
      onClick={() => !isEditing && editor.actions.startEditing(index, block)}
      onMouseEnter={(e) => { if (!isEditing) e.currentTarget.style.backgroundColor = '#8a8a86'; }}
      onMouseLeave={(e) => { if (!isEditing) e.currentTarget.style.backgroundColor = '#7b7b77'; }}
    >
      {isEditing ? (
        <div onClick={(e) => e.stopPropagation()} className="space-y-2">
          <textarea
            value={editor.editingState.content}
            onChange={(e) => editor.actions.setEditingContent(e.target.value)}
            className="w-full min-h-[60px] px-3 py-2 border border-white rounded-lg text-sm resize-vertical text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex gap-2">
            <button onClick={editor.actions.saveEditing} className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors">保存</button>
            <button onClick={editor.actions.cancelEditing} className="px-4 py-1.5 bg-gray-500 text-white rounded-lg text-xs font-medium hover:bg-gray-600 transition-colors">取消</button>
          </div>
        </div>
      ) : (
        <>
          {block.content}
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); editor.actions.toggleNarrationConvertMenu(index); }}
                className="px-2 py-1 bg-amber-500 text-white rounded text-xs hover:bg-amber-600 transition-colors"
                title="转换类型"
              >⇄</button>
              <ConvertMenu
                isOpen={editor.menuState.activeNarrationConvertMenuIndex === index}
                options={[
                  { label: '心理旁白', onClick: () => editor.actions.convertNarrationToThought(index) },
                  { label: '对话', onClick: () => editor.actions.convertNarrationToDialogue(index) }
                ]}
              />
            </div>
            <button onClick={(e) => { e.stopPropagation(); editor.actions.toggleInsertMenu(index); }} className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors" title="插入">＋</button>
            <button onClick={async (e) => { e.stopPropagation(); await editor.actions.deleteNarrationBlock(index); }} className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors" title="删除">✕</button>
          </div>
          <InsertMenu
            isOpen={editor.menuState.activeInsertMenuIndex === index}
            onClose={editor.actions.closeInsertMenu}
            onInsert={(type) => editor.actions.insertBlockFromMenu(index, type)}
          />
        </>
      )}
    </div>
  );
});

export default NarrationBlockItem;
