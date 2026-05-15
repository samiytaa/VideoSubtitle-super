import React from 'react';
import { ExtractedFrame } from '../../types';
import { useNotifier } from '../Notifications';
import CenteredModal from '../common/CenteredModal';

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
    <CenteredModal
      open={true}
      onClose={onCancel}
      title="合并分组"
      bodyClassName={null}
      footer={
        <>
          <button
            onClick={handleConfirm}
            disabled={sourceGroup === targetGroup || groupCounts[sourceGroup] === 0}
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认合并
          </button>
          <button
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
        </>
      }
    >
      <div className="p-5 flex flex-col gap-5 overflow-y-auto max-h-[70vh]">
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
    </CenteredModal>
  );
};

export default MergeGroupDialog;
