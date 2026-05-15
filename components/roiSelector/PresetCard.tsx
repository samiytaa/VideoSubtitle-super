import { BookmarkPlus, CheckCircle2, Circle, Edit, Plus, Star, Trash2 } from 'lucide-react';
import React from 'react';
import { RoiPreset } from '../../types';

type Category = 'dialogue' | 'location';

interface PresetCardProps {
  category: Category;
  presets: RoiPreset[];
  currentPresetName: string | null;
  selectedPresetName?: string | null;
  onApply: (preset: RoiPreset) => void;
  onAdd: () => void;
  onDelete: (e: React.MouseEvent, name: string) => void;
  onRename: (e: React.MouseEvent, name: string) => void;
  onSetDefault: (e: React.MouseEvent, name: string) => void;
  optionsContent?: React.ReactNode;
}

const categoryMeta = {
  dialogue: {
    title: '对话',
    accentColor: 'blue' as const,
    activeClass: 'border-blue-400 bg-blue-50/20',
    hoverClass: 'hover:border-blue-400 hover:bg-blue-50/20',
    textActive: 'text-blue-700',
    emptyText: '暂无对话预设',
    headerText: 'text-blue-700',
    iconColor: 'text-blue-500',
    addBtnClass: 'text-blue-600 hover:bg-blue-50',
  },
  location: {
    title: '地点',
    accentColor: 'green' as const,
    activeClass: 'border-green-400 bg-green-50/20',
    hoverClass: 'hover:border-green-400 hover:bg-green-50/20',
    textActive: 'text-green-700',
    emptyText: '暂无地点预设',
    headerText: 'text-green-700',
    iconColor: 'text-green-500',
    addBtnClass: 'text-green-600 hover:bg-green-50',
  },
} as const;

const PresetCard: React.FC<PresetCardProps> = ({
  category,
  presets,
  currentPresetName,
  selectedPresetName,
  onApply,
  onAdd,
  onDelete,
  onRename,
  onSetDefault,
  optionsContent,
}) => {
  const meta = categoryMeta[category];

  const renderPresetList = () => {
    if (presets.length === 0) {
      return (
        <div className="text-center py-6 text-slate-400 text-xs">{meta.emptyText}</div>
      );
    }

    return (
      <div className="flex flex-col gap-1.5">
        {presets.map(p => {
          const isSelected = p.name === selectedPresetName;
          const isApplied = p.name === currentPresetName;
          const isActive = isSelected || isApplied;

          // 状态图标和颜色
          const StateIcon = isApplied ? CheckCircle2 : isSelected ? Circle : null;
          const stateIconClass = isApplied
            ? 'text-slate-600'
            : isSelected
              ? category === 'dialogue'
                ? 'text-blue-600'
                : 'text-green-600'
              : '';
          const stateTitle = isApplied ? '画框中' : isSelected ? '已选中' : '';

          return (
            <div
              key={p.name}
              onClick={() => onApply(p)}
              className={`group border-2 border-dashed rounded-lg px-3 py-2.5 transition-all cursor-pointer relative ${
                isActive ? meta.activeClass : `border-gray-200 ${meta.hoverClass}`
              }`}
            >
              <div className="flex items-center gap-2">
                {/* 预设名称 */}
                <span className={`text-sm font-medium truncate flex-1 ${isActive ? meta.textActive : 'text-gray-700'}`}>
                  {p.name}
                </span>

                {/* 状态图标 */}
                {StateIcon && (
                  <StateIcon className={`w-4 h-4 shrink-0 ${stateIconClass}`} title={stateTitle} />
                )}

                {/* 默认标记 */}
                {p.isDefault && (
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" title="默认预设" />
                )}

                {/* 操作按钮 */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {!p.isDefault && (
                    <button
                      onClick={e => onSetDefault(e, p.name)}
                      className="p-1 text-slate-400 hover:text-amber-500 transition-colors"
                      title="设为默认"
                    >
                      <Star className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={e => onRename(e, p.name)}
                    className="p-1 text-slate-400 hover:text-blue-500 transition-colors"
                    title="重命名预设"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                  <button
                    onClick={e => onDelete(e, p.name)}
                    className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                    title="删除预设"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-[480px]">
      {/* 卡片标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <BookmarkPlus className={`w-4 h-4 ${meta.iconColor}`} />
          <h3 className={`text-sm font-semibold ${meta.headerText}`}>{meta.title}预设</h3>
        </div>
        <button
          onClick={onAdd}
          className={`p-1.5 rounded-lg transition-colors ${meta.addBtnClass}`}
          title={`保存当前选区为${meta.title}预设`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col flex-1 min-h-0 p-4 gap-3">
        {/* 预设列表 - 占满剩余空间，超出滚动 */}
        <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 min-h-0">
          {renderPresetList()}
        </div>

        {/* 处理选项 - 固定在底部 */}
        {optionsContent && (
          <div className="pt-3 border-t border-gray-100 shrink-0">
            <div className="text-xs font-semibold text-gray-500 mb-2">处理选项</div>
            {optionsContent}
          </div>
        )}
      </div>
    </div>
  );
};

export default PresetCard;
