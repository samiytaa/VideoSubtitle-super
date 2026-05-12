import React from 'react';
import { buttonVariants } from './buttonVariants';

interface PreviewToolbarProps {
  isMultiSelectMode: boolean;
  selectedCount: number;
  allDialoguesSelected: boolean;
  onOpenSearch: () => void;
  onOpenQuickReplace: () => void;
  onToggleMultiSelectMode: () => void;
  onToggleSelectAllDialogues: () => void;
  onOpenBatchAvatarPicker: () => void;
  onBatchClearAvatarConfirm: () => void;
}

const PreviewToolbar: React.FC<PreviewToolbarProps> = ({
  isMultiSelectMode,
  selectedCount,
  allDialoguesSelected,
  onOpenSearch,
  onOpenQuickReplace,
  onToggleMultiSelectMode,
  onToggleSelectAllDialogues,
  onOpenBatchAvatarPicker,
  onBatchClearAvatarConfirm
}) => {
  return (
    <div className="shrink-0 flex items-center gap-2 p-2 bg-white border-b border-gray-200">
      <button onClick={onOpenSearch} className={`${buttonVariants.toolbarBase} ${buttonVariants.solidGreen}`} title="搜索旁白、对话和人名">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        搜索
      </button>

      <button onClick={onOpenQuickReplace} className={`${buttonVariants.toolbarBase} ${buttonVariants.solidPurple}`} title="一键替换指定人名的头像">
        一键替换人名头像
      </button>

      <button
        onClick={onToggleMultiSelectMode}
        className={`${buttonVariants.toolbarBase} ${isMultiSelectMode ? buttonVariants.solidBlue : buttonVariants.ghost}`}
      >
        {isMultiSelectMode ? '退出头像多选' : '头像多选'}
      </button>

      {isMultiSelectMode && (
        <>
          <div className="h-4 w-px bg-gray-300"></div>
          <button onClick={onToggleSelectAllDialogues} className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded transition-colors">
            {allDialoguesSelected ? '取消全选' : '全选对话'}
          </button>
          <div className="flex-1"></div>
          <span className="text-xs text-indigo-600 font-medium">已选 {selectedCount} 项</span>
          {selectedCount > 0 && (
            <>
              <button onClick={onOpenBatchAvatarPicker} className={`${buttonVariants.toolbarBase} ${buttonVariants.solidIndigo}`}>
                批量设置头像
              </button>
              <button onClick={onBatchClearAvatarConfirm} className={`${buttonVariants.toolbarBase} ${buttonVariants.solidOrange}`}>
                批量清空头像
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default PreviewToolbar;
