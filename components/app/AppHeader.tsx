import { FileCheck, Image as ImageIcon, LayoutGrid, MessageCircle, ScanText, Video } from 'lucide-react';
import React from 'react';

export type AppTab = 'extract' | 'gallery' | 'proofread' | 'proofread2' | 'aichat' | 'baimiao';

type AppHeaderProps = {
  activeTab: AppTab;
  isProcessing: boolean;
  onChangeTab: (tab: AppTab) => void;
  isAiChatProcessing?: boolean;
};

const AppHeader: React.FC<AppHeaderProps> = ({ activeTab, isProcessing, onChangeTab, isAiChatProcessing = false }) => {
  const renderTabButton = (tab: AppTab, label: string, icon: React.ReactNode) => {
    const disabled = (isProcessing && tab !== 'extract') || isAiChatProcessing;
    return (
      <button
        onClick={() => !disabled && onChangeTab(tab)}
        disabled={disabled}
        title={disabled ? '处理中，请等待完成后再切换' : undefined}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-indigo-50 text-indigo-700' : isProcessing || isAiChatProcessing ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
      >
        <span className="flex items-center gap-1.5">{icon} {label}</span>
      </button>
    );
  };

  return (
    <header className="bg-white border-b border-gray-200/60 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-10 items-center">
          <div className="flex items-center gap-2">
            <div className="bg-linear-to-br from-indigo-600 to-indigo-700 p-1.5 rounded-md shadow-sm">
              <Video className="text-white w-4 h-4" />
            </div>
            <h1 className="text-lg font-semibold text-gray-900 hidden sm:block">视频字幕截取工具</h1>
          </div>

          <nav className="flex space-x-1">
            {renderTabButton('extract', '字幕截取', <ImageIcon className="w-4 h-4" />)}
            {renderTabButton('gallery', '查看图片', <LayoutGrid className="w-4 h-4" />)}
            {renderTabButton('aichat', 'AI处理', <MessageCircle className="w-4 h-4" />)}
            {renderTabButton('proofread', '文本转换', <FileCheck className="w-4 h-4" />)}
            {renderTabButton('proofread2', '文本校对', <FileCheck className="w-4 h-4" />)}
            {renderTabButton('baimiao', '白描ocr', <ScanText className="w-4 h-4" />)}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
