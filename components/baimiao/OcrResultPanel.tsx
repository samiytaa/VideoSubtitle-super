import React from 'react';
import { ScanText } from 'lucide-react';

type OcrResultPanelProps = {
  text: string;
  minHeightClassName?: string;
  actionSlot?: React.ReactNode;
};

const OcrResultPanel: React.FC<OcrResultPanelProps> = ({ text, minHeightClassName = 'min-h-56', actionSlot }) => {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col ${minHeightClassName}`.trim()}>
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-1.5">
          <ScanText className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-xs font-semibold text-gray-700">识别结果</span>
        </div>
        {actionSlot || (text ? <span className="text-[10px] text-gray-400">{text.length} 字符</span> : null)}
      </div>
      <div className="flex-1 p-4 overflow-auto max-h-96">
        {text ? (
          <pre className="text-sm text-gray-700 whitespace-pre-wrap wrap-break-word leading-relaxed">{text}</pre>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 py-8">
            <ScanText className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-xs">识别结果将在这里显示</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default OcrResultPanel;
