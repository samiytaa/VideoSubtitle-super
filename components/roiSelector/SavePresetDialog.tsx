import React from 'react';
import { ROI, RoiPreset, VideoFile } from '../../types';
import { useNotifier } from '../Notifications';
import CenteredModal from '../common/CenteredModal';

interface SavePresetDialogProps {
  video?: VideoFile | null;
  cropBox: ROI;
  presets: Record<string, RoiPreset>;
  defaultCategory?: 'dialogue' | 'location';
  onSave: (name: string, category: 'dialogue' | 'location') => void;
  onCancel: () => void;
}

const SavePresetDialog: React.FC<SavePresetDialogProps> = ({ video, cropBox, presets, defaultCategory = 'dialogue', onSave, onCancel }) => {
  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState<'dialogue' | 'location'>(defaultCategory);
  const notifier = useNotifier();

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      notifier.addToast('请输入预设名称', 'warning');
      return;
    }
    if (presets[trimmedName]) {
      const overwrite = await notifier.showConfirm({ title: '覆盖预设', message: '该预设名称已存在，是否覆盖？' });
      if (!overwrite) return;
    }
    onSave(trimmedName, category);
  };

  const x_px = Math.round((cropBox.x / 100) * (video?.width ?? 1920));
  const y_px = Math.round((cropBox.y / 100) * (video?.height ?? 1080));
  const w_px = Math.round((cropBox.width / 100) * (video?.width ?? 1920));
  const h_px = Math.round((cropBox.height / 100) * (video?.height ?? 1080));

  return (
    <CenteredModal
      open={true}
      onClose={onCancel}
      title="保存预设"
      panelClassName="w-full max-w-md mx-4 flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      bodyClassName={null}
      footer={
        <>
          <button onClick={handleSave} className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm">保存</button>
          <button onClick={onCancel} className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors">取消</button>
        </>
      }
    >
      <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">预设名称</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="例如：对话-底部、地点-左侧"
            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">预设分类</label>
          <div className="flex gap-2">
            <button
              onClick={() => setCategory('dialogue')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${category === 'dialogue' ? 'bg-blue-500 text-white shadow-sm' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${category === 'dialogue' ? 'bg-white text-blue-500' : 'bg-blue-200 text-blue-700'}`}>对</div>
              对话预设
            </button>
            <button
              onClick={() => setCategory('location')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${category === 'location' ? 'bg-green-500 text-white shadow-sm' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${category === 'location' ? 'bg-white text-green-500' : 'bg-green-200 text-green-700'}`}>地</div>
              地点预设
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm text-gray-600">
          <div className="font-medium text-gray-700 text-xs mb-0.5">选区信息</div>
          <div className="text-xs text-gray-500">位置：X={x_px}, Y={y_px} | 尺寸：{w_px}×{h_px}</div>
        </div>
      </div>
    </CenteredModal>
  );
};

export default SavePresetDialog;
