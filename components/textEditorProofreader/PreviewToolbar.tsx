import React from 'react';
import { buttonVariants } from './buttonVariants';
import { UserX, UserCheck, Search, RefreshCw, ListChecks, Trash2 } from 'lucide-react';

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
  onBatchDeleteConfirm: () => void;
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
  onBatchClearAvatarConfirm,
  onBatchDeleteConfirm
}) => {
  return (
    <div className="shrink-0 flex items-center gap-2 p-2 bg-white border-b border-gray-200">
      <button 
        onClick={onOpenSearch} 
        className={`${buttonVariants.toolbarBase} ${buttonVariants.solidGreen}`} 
        title="搜索旁白、对话和人名"
      >
        <Search className="w-4 h-4" />
        搜索
      </button>

      <button 
        onClick={onOpenQuickReplace} 
        className={`${buttonVariants.toolbarBase} ${buttonVariants.solidPurple}`} 
        title="一键替换指定人名的头像"
      >
        <RefreshCw className="w-4 h-4" />
        智能头像
      </button>

      <button
        onClick={onToggleMultiSelectMode}
        className={`${buttonVariants.toolbarBase} ${isMultiSelectMode ? buttonVariants.solidBlue : buttonVariants.ghost}`}
        title={isMultiSelectMode ? '退出头像多选模式' : '进入头像多选模式'}
      >
        <ListChecks className="w-4 h-4" />
        {isMultiSelectMode ? '退出多选' : '多选'}
      </button>

      {isMultiSelectMode && (
        <>
          <div className="h-4 w-px bg-gray-300"></div>
          <button 
            onClick={onToggleSelectAllDialogues} 
            className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title={allDialoguesSelected ? '取消全选' : '全选'}
          >
            {allDialoguesSelected ? '取消全选' : '全选'}
          </button>
          <div className="flex-1"></div>
          <span className="text-xs text-indigo-600 font-medium">已选 {selectedCount} 项</span>
          {selectedCount > 0 && (
            <>
              <button 
                onClick={onOpenBatchAvatarPicker} 
                className={`${buttonVariants.toolbarBase} ${buttonVariants.solidIndigo}`}
                title="为选中的对话批量设置头像"
              >
                <UserCheck className="w-4 h-4" />
                设置头像
              </button>
              <button 
                onClick={onBatchClearAvatarConfirm} 
                className={`${buttonVariants.toolbarBase} ${buttonVariants.solidOrange}`}
                title="清空选中对话的头像"
              >
                <UserX className="w-4 h-4" />
                清空头像
              </button>
              <button
                onClick={onBatchDeleteConfirm}
                className={`${buttonVariants.toolbarBase} ${buttonVariants.solidRed}`}
                title="删除选中的对话"
              >
                <Trash2 className="w-4 h-4" />
                删除选中
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default PreviewToolbar;
