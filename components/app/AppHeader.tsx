import { FileCheck, Image as ImageIcon, LayoutGrid, MessageCircle, ScanText } from 'lucide-react';
import React from 'react';

export type AppTab = 'extract' | 'gallery' | 'proofread' | 'proofread2' | 'aichat' | 'baimiao';

type AppHeaderProps = {
  activeTab: AppTab;
  isProcessing: boolean;
  onChangeTab: (tab: AppTab) => void;
  isAiChatProcessing?: boolean;
};

const TAB_CONFIG: Array<{ tab: AppTab; label: string; icon: React.ReactElement }> = [
  { tab: 'extract',    label: '字幕截取', icon: <ImageIcon className="w-4 h-4" /> },
  { tab: 'gallery',    label: '查看图片', icon: <LayoutGrid className="w-4 h-4" /> },
  { tab: 'aichat',     label: 'AI处理',   icon: <MessageCircle className="w-4 h-4" /> },
  { tab: 'proofread',  label: '文本转换', icon: <FileCheck className="w-4 h-4" /> },
  { tab: 'proofread2', label: '文本校对', icon: <FileCheck className="w-4 h-4" /> },
  { tab: 'baimiao',    label: '白描ocr',  icon: <ScanText className="w-4 h-4" /> },
];

function getTabClass(tab: AppTab, activeTab: AppTab, isBusy: boolean): string {
  if (activeTab === tab) return 'bg-indigo-50 text-indigo-700';
  if (isBusy) return 'text-gray-300 cursor-not-allowed';
  return 'text-gray-600 hover:text-gray-900 hover:bg-gray-50';
}

function AppHeader({ activeTab, isProcessing, onChangeTab, isAiChatProcessing = false }: AppHeaderProps): React.ReactElement {
  const isBusy = isProcessing || isAiChatProcessing;

  return (
    <header className="sticky top-0 z-50 bg-white pt-2 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-11 items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/favicon.ico" alt="icon" className="w-7 h-7" />
            <h1 className="text-lg font-semibold text-gray-900 hidden sm:block" style={{ fontFamily: "'QuanHengDuLiang', serif" }}>代号鸢剧情提取器</h1>
          </div>

          <nav className="flex space-x-1">
            {TAB_CONFIG.map(({ tab, label, icon }) => {
              const disabled = (isProcessing && tab !== 'extract') || isAiChatProcessing;
              return (
                <button
                  key={tab}
                  onClick={() => !disabled && onChangeTab(tab)}
                  disabled={disabled}
                  title={disabled ? '处理中，请等待完成后再切换' : undefined}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${getTabClass(tab, activeTab, isBusy)}`}
                >
                  <span className="flex items-center gap-1.5">{icon} {label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
