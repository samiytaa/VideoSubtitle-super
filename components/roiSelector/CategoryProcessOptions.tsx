import React from 'react';

type Category = 'dialogue' | 'location';

interface CategoryProcessOptionsProps {
  category: Category;
  enabled: boolean;
  skipSubtitle: boolean;
  autoDeduplication: boolean;
  hasSrtFile: boolean;
  isProcessing: boolean;
  onEnabledChange: (checked: boolean) => void;
  onSkipSubtitleChange: (checked: boolean) => void;
  onAutoDeduplicationChange: (checked: boolean) => void;
}

const categoryMeta = {
  dialogue: {
    title: '对话',
    headerText: 'text-blue-900',
    checkbox: 'text-blue-600 focus:ring-blue-500',
    subCheckbox: 'text-amber-600 focus:ring-amber-500',
    optionText: 'text-blue-800',
  },
  location: {
    title: '地点',
    headerText: 'text-green-900',
    checkbox: 'text-green-600 focus:ring-green-500',
    subCheckbox: 'text-amber-600 focus:ring-amber-500',
    optionText: 'text-green-800',
  },
} as const;

const CategoryProcessOptions: React.FC<CategoryProcessOptionsProps> = ({
  category,
  enabled,
  skipSubtitle,
  autoDeduplication,
  hasSrtFile,
  isProcessing,
  onEnabledChange,
  onSkipSubtitleChange,
  onAutoDeduplicationChange,
}) => {
  const meta = categoryMeta[category];
  const childOptionsDisabled = isProcessing || !enabled;
  const skipSubtitleDisabled = childOptionsDisabled || !hasSrtFile;
  const autoDedupDisabled = childOptionsDisabled;

  return (
    <div className="space-y-2.5">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => onEnabledChange(e.target.checked)}
          disabled={isProcessing}
          className={`w-4 h-4 border-gray-300 rounded focus:ring-1 ${meta.checkbox}`}
        />
        <span className={`text-sm font-semibold ${meta.headerText}`}>启用{meta.title}截取</span>
      </label>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={skipSubtitle}
          onChange={e => onSkipSubtitleChange(e.target.checked)}
          disabled={skipSubtitleDisabled}
          className={`w-3.5 h-3.5 border-gray-300 rounded focus:ring-1 ${meta.subCheckbox}`}
        />
        <span
          className={`text-xs ${
            skipSubtitleDisabled ? 'text-gray-400' : 'text-amber-800'
          }`}
        >
          跳过包含字幕的区域
          {!enabled && <span className="ml-1 text-gray-400">（启用该分类后生效）</span>}
          {enabled && !hasSrtFile && <span className="ml-1 text-gray-400">（需上传 SRT）</span>}
        </span>
      </label>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={autoDeduplication}
          onChange={e => onAutoDeduplicationChange(e.target.checked)}
          disabled={autoDedupDisabled}
          className={`w-3.5 h-3.5 border-gray-300 rounded focus:ring-1 ${meta.checkbox}`}
        />
        <span
          className={`text-xs ${
            autoDedupDisabled ? 'text-gray-400' : meta.optionText
          }`}
        >
          截取完成后自动去重
          {!enabled && <span className="ml-1 text-gray-400">（启用该分类后生效）</span>}
        </span>
      </label>
    </div>
  );
};

export default CategoryProcessOptions;
