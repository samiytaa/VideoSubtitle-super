import { Loader } from 'lucide-react';
import React from 'react';

type LoadingOverlayProps = {
  visible: boolean;
};

function LoadingOverlay({ visible }: LoadingOverlayProps): React.ReactElement | null {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-white/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-gray-100 bg-white p-8 shadow-xl">
        <Loader className="w-9 h-9 text-indigo-600 animate-spin" />
        <div className="text-center">
          <h3 className="text-sm font-semibold text-gray-900 mb-0.5">正在加载数据</h3>
          <p className="text-xs text-gray-400">从本地存储恢复图片...</p>
        </div>
      </div>
    </div>
  );
}

export default LoadingOverlay;
