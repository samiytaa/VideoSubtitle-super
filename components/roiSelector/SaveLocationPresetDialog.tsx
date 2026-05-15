import React from 'react';
import { ROI, RoiPreset, VideoFile } from '../../types';
import { useNotifier } from '../Notifications';
import CenteredModal from '../common/CenteredModal';

interface SaveLocationPresetDialogProps {
  video?: VideoFile | null;
  cropBox: ROI;
  presets: Record<string, RoiPreset>;
  onSave: (name: string) => void;
  onCancel: () => void;
}

const SaveLocationPresetDialog: React.FC<SaveLocationPresetDialogProps> = ({ video, cropBox, presets, onSave, onCancel }) => {
  const [name, setName] = React.useState('');
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
    onSave(trimmedName);
  };

  const x_px = Math.round((cropBox.x / 100) * (video?.width ?? 1920));
  const y_px = Math.round((cropBox.y / 100) * (video?.height ?? 1080));
  const w_px = Math.round((cropBox.width / 100) * (video?.width ?? 1920));
  const h_px = Math.round((cropBox.height / 100) * (video?.height ?? 1080));

  return (
    <CenteredModal
      open={true}
      onClose={onCancel}
      title="保存地点预设"
      headerIcon={<div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-green-500 text-white">地</div>}
      panelClassName="w-full max-w-md mx-4 flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      bodyClassName={null}
      footer={
        <>
          <button onClick={handleSave} className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm">保存</button>
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
            placeholder="例如：地点-左侧、地点-右上角"
            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 outline-none transition-shadow focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:bg-white"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
          />
        </div>

        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="font-medium text-green-700 text-xs mb-1">选区信息</div>
          <div className="text-xs text-green-600">位置：X={x_px}, Y={y_px} | 尺寸：{w_px}×{h_px}</div>
        </div>
      </div>
    </CenteredModal>
  );
};

export default SaveLocationPresetDialog;
