import React from 'react';
import { ExtractedFrame } from '../../types';
import { useNotifier } from '../Notifications';

interface MergeGroupDialogProps {
  frames: ExtractedFrame[];
  onConfirm: (sourceGroup: 'group1' | 'group2', targetGroup: 'group1' | 'group2') => void;
  onCancel: () => void;
}

const MergeGroupDialog: React.FC<MergeGroupDialogProps> = ({ frames, onConfirm, onCancel }) => {
  const [sourceGroup, setSourceGroup] = React.useState<'group1' | 'group2'>('group2');
  const [targetGroup, setTargetGroup] = React.useState<'group1' | 'group2'>('group1');
  const notifier = useNotifier();

  const groupCounts = {
    group1: frames.filter((f) => f.group === 'group1').length,
    group2: frames.filter((f) => f.group === 'group2').length,
  };

  const handleConfirm = () => {
    if (sourceGroup === targetGroup) {
      notifier.showAlert('源分组和目标分组不能相同', '提示');
      return;
    }
    onConfirm(sourceGroup, targetGroup);
  };

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">合并分组</h3>
          <button
            onClick={onCancel}
            className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="关闭"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">源分组（将被合并）</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSourceGroup('group1')}
                className={`px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  sourceGroup === 'group1'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                【对话】
                <div className="text-xs mt-0.5 opacity-80">{groupCounts.group1} 张</div>
              </button>
              <button
                onClick={() => setSourceGroup('group2')}
                className={`px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  sourceGroup === 'group2'
                    ? 'bg-green-500 text-white shadow-sm'
                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                }`}
              >
                【地点】
                <div className="text-xs mt-0.5 opacity-80">{groupCounts.group2} 张</div>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center text-gray-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">目标分组（合并到此分组）</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTargetGroup('group1')}
                className={`px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  targetGroup === 'group1'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                【对话】
                <div className="text-xs mt-0.5 opacity-80">{groupCounts.group1} 张</div>
              </button>
              <button
                onClick={() => setTargetGroup('group2')}
                className={`px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  targetGroup === 'group2'
                    ? 'bg-green-500 text-white shadow-sm'
                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                }`}
              >
                【地点】
                <div className="text-xs mt-0.5 opacity-80">{groupCounts.group2} 张</div>
              </button>
            </div>
          </div>

          {sourceGroup === targetGroup && (
            <div className="relative w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              ⚠️ 源分组和目标分组不能相同
            </div>
          )}

          {sourceGroup !== targetGroup && groupCounts[sourceGroup] > 0 && (
            <div className="relative w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              ℹ️ 将把{sourceGroup === 'group1' ? '【对话】' : '【地点】'}的 {groupCounts[sourceGroup]} 张图片合并到
              {targetGroup === 'group1' ? '【对话】' : '【地点】'}，文件名保持不变。
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex flex-row-reverse gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            onClick={handleConfirm}
            disabled={sourceGroup === targetGroup || groupCounts[sourceGroup] === 0}
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium bg-orange-600 text-white hover:bg-orange-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认合并
          </button>
          <button
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default MergeGroupDialog;
