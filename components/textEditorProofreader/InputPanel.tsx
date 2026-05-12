import React from 'react';

interface InputPanelProps {
  isCollapsed: boolean;
  inputText: string;
  copySuccess: boolean;
  leftScrollRef: React.RefObject<HTMLDivElement | null>;
  onExpand: () => void;
  onCopy: () => void | Promise<void>;
  onClear: () => void | Promise<void>;
  onStartProofreading: () => void;
  onTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

const InputPanel: React.FC<InputPanelProps> = ({
  isCollapsed,
  inputText,
  copySuccess,
  leftScrollRef,
  onExpand,
  onCopy,
  onClear,
  onStartProofreading,
  onTextChange
}) => {
  if (isCollapsed) {
    return (
      <div className="shrink-0">
        <button
          onClick={onExpand}
          className="w-full bg-white border border-gray-200 rounded px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm text-gray-700">输入文本</span>
          <span className="text-xs text-gray-400">点击展开</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border-b border-gray-200 p-2 flex flex-col gap-2 shrink-0">
      <div className="flex justify-between items-center">
        <label className="text-sm text-gray-700">输入文本</label>
        <div className="flex gap-1.5">
          <button
            onClick={onCopy}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded transition-colors ${copySuccess ? 'bg-green-600 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
          >
            {copySuccess ? '已复制' : '复制文本'}
          </button>
          <button
            onClick={onClear}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 rounded transition-colors"
            title="清空文本"
          >
            清空文本
          </button>
          <button
            onClick={onStartProofreading}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors"
            title="解析文本并开始校对"
          >
            开始校对
          </button>
        </div>
      </div>

      <div ref={leftScrollRef} className="max-h-[360px] overflow-y-auto">
        <textarea
          value={inputText}
          onChange={onTextChange}
          placeholder="请输入文本。密探格式：使用 ||| 分隔不同小节，例如：{{密探故事录入|头|法正|01}}{{旁白|【广陵王府】}}...|||{{密探故事录入|头|法正|02}}...&#10;通用格式：{{对话-头}}{{旁白|内容}}{{对话|人名|内容}}...{{对话-尾}}"
          className="w-full h-[340px] p-3 border border-gray-300 rounded-md text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>
    </div>
  );
};

export default InputPanel;
