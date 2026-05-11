import { BookmarkPlus, Edit, Plus, Star, Trash2 } from 'lucide-react';
import React from 'react';
import { RoiPreset } from '../../types';

interface PresetPanelProps {
  presets: Record<string, RoiPreset>;
  currentPresetName: string | null;
  activeTab: 'dialogue' | 'location';
  onTabChange: (tab: 'dialogue' | 'location') => void;
  onApply: (preset: RoiPreset) => void;
  onAdd: () => void;
  onDelete: (e: React.MouseEvent, name: string) => void;
  onRename: (e: React.MouseEvent, name: string) => void;
  onSetDefault: (e: React.MouseEvent, name: string) => void;
}

const PresetPanel: React.FC<PresetPanelProps> = ({
  presets,
  currentPresetName,
  activeTab,
  onTabChange,
  onApply,
  onAdd,
  onDelete,
  onRename,
  onSetDefault,
}) => {
  const dialoguePresets = (Object.values(presets) as RoiPreset[]).filter(p =>
    p.category === 'dialogue' || p.name.includes('对话') || p.name.includes('【对话】')
  );
  const locationPresets = (Object.values(presets) as RoiPreset[]).filter(p =>
    p.category === 'location' || p.name.includes('地点') || p.name.includes('【地点】')
  );

  const renderPresetList = (list: RoiPreset[], accentColor: 'blue' | 'green') => {
    const borderActive = accentColor === 'blue' ? 'border-blue-300 bg-blue-50' : 'border-green-300 bg-green-50';
    const borderHover = accentColor === 'blue' ? 'hover:border-blue-300 hover:bg-slate-50' : 'hover:border-green-300 hover:bg-slate-50';
    const textActive = accentColor === 'blue' ? 'text-blue-700' : 'text-green-700';
    const badgeActive = accentColor === 'blue' ? 'bg-blue-500' : 'bg-green-500';
    const emptyText = accentColor === 'blue' ? '暂无对话预设' : '暂无地点预设';

    if (list.length === 0) {
      return <div className="text-center py-8 text-slate-400 text-xs">{emptyText}</div>;
    }

    return (
      <div className="flex flex-col gap-1.5">
        {list.map(p => {
          const isActive = p.name === currentPresetName;
          return (
            <div
              key={p.name}
              onClick={() => onApply(p)}
              className={`group relative flex flex-col p-2.5 rounded-lg border transition-all text-left cursor-pointer ${
                isActive ? borderActive : `border-slate-200 ${borderHover}`
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className={`text-xs font-medium truncate ${isActive ? textActive : 'text-slate-700'}`}>
                    {p.name}
                  </span>
                  {p.isDefault && (
                    <span className="shrink-0 text-[9px] bg-green-500 text-white px-1.5 py-0.5 rounded font-medium">默认</span>
                  )}
                  {isActive && (
                    <span className={`shrink-0 text-[9px] ${badgeActive} text-white px-1.5 py-0.5 rounded font-medium`}>使用中</span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
              <p className="text-[10px] text-slate-500 truncate">{p.description}</p>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 flex-1 flex flex-col">
      {/* 标题栏 + Tab 切换 */}
      <div className="flex items-center border-b border-slate-200">
        <div className="flex items-center gap-2 px-4 py-3 shrink-0">
          <BookmarkPlus className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-700 whitespace-nowrap">预设库</h3>
        </div>

        <div className="flex flex-1">
          <button
            onClick={() => onTabChange('dialogue')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'dialogue' ? 'text-blue-600 bg-blue-50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            对话
            {activeTab === 'dialogue' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
          </button>
          <button
            onClick={() => onTabChange('location')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'location' ? 'text-green-600 bg-green-50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            地点
            {activeTab === 'location' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600" />}
          </button>
        </div>

        <div className="px-4 py-3 shrink-0">
          <button
            onClick={onAdd}
            className="p-1.5 text-amber-600 rounded-lg hover:bg-amber-50 transition-colors"
            title="保存当前选区为预设"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto p-4 pt-3 scrollbar-thin max-h-[400px]">
        {activeTab === 'dialogue'
          ? renderPresetList(dialoguePresets, 'blue')
          : renderPresetList(locationPresets, 'green')
        }
      </div>
    </div>
  );
};

export default PresetPanel;
