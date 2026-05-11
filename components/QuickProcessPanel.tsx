import { Scan, Upload } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { RoiPreset, VideoFile } from '../types';
import { useNotifier } from './Notifications';

const DEFAULT_PRESETS: Record<string, RoiPreset> = {
  '【对话】': { name: '【对话】', x_ratio: 0, y_ratio: 0.8275, w_ratio: 0.54, h_ratio: 0.160625, description: 'X=0, Y=1324, 宽度=864, 高度=257', isDefault: true, category: 'dialogue' },
  '【地点】': { name: '【地点】', x_ratio: 0.446875, y_ratio: 0.23625, w_ratio: 0.06125, h_ratio: 0.345625, description: 'X=715, Y=378, 宽度=98, 高度=553', isDefault: false, category: 'location' },
};

const loadPresets = (): Record<string, RoiPreset> => {
  try {
    const saved = localStorage.getItem('roi_presets');
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, RoiPreset>;
      return { ...DEFAULT_PRESETS, ...parsed };
    }
  } catch { /* ignore */ }
  return DEFAULT_PRESETS;
};

// ── 面板选项持久化 ────────────────────────────────────────────────────────────

const PANEL_PREFS_KEY = 'quick_process_prefs';

interface PanelPrefs {
  captureDialogue: boolean;
  captureLocation: boolean;
  selectedDialoguePreset: string;
  selectedLocationPreset: string;
  autoDeduplicationDialogue: boolean;
  autoDeduplicationLocation: boolean;
  skipSubtitleDialogue: boolean;
  skipSubtitleLocation: boolean;
  frameInterval: number;
}

const loadPanelPrefs = (): Partial<PanelPrefs> => {
  try {
    const saved = localStorage.getItem(PANEL_PREFS_KEY);
    if (saved) return JSON.parse(saved) as Partial<PanelPrefs>;
  } catch { /* ignore */ }
  return {};
};

const savePanelPrefs = (prefs: PanelPrefs) => {
  try {
    localStorage.setItem(PANEL_PREFS_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
};

export interface QuickProcessPanelProps {
  video: VideoFile | null;
  timeRange: { startTime: number; endTime: number };
  isProcessing: boolean;
  progress?: { current: number; total: number; message: string; stage?: 'extracting' | 'deduplicating' };
  onConfirm: (
    file: File | null,
    dialoguePreset: RoiPreset | null,
    locationPreset: RoiPreset | null,
    timeRange: { startTime: number; endTime: number },
    captureType: 'dialogue' | 'location' | 'both',
    autoDeduplicationDialogue: boolean,
    autoDeduplicationLocation: boolean,
    frameInterval?: number,
    skipSubtitleDialogue?: boolean,
    skipSubtitleLocation?: boolean,
  ) => void;
}

const QuickProcessPanel: React.FC<QuickProcessPanelProps> = ({
  video,
  timeRange,
  isProcessing,
  progress,
  onConfirm,
}) => {
  const notifier = useNotifier();
  const [presets] = useState<Record<string, RoiPreset>>(loadPresets);

  // 读取上次保存的偏好
  const savedPrefs = useMemo(() => loadPanelPrefs(), []);

  const [srtFile, setSrtFile] = useState<File | null>(null);
  const [captureDialogue, setCaptureDialogue] = useState(() => savedPrefs.captureDialogue ?? true);
  const [captureLocation, setCaptureLocation] = useState(() => savedPrefs.captureLocation ?? true);
  const [selectedDialoguePreset, setSelectedDialoguePreset] = useState<string>(() => {
    // 优先用上次记忆的选择，其次用默认预设，最后用第一个
    if (savedPrefs.selectedDialoguePreset) return savedPrefs.selectedDialoguePreset;
    const p = Object.values(loadPresets()).filter(p => p.category === 'dialogue' || p.name.includes('对话'));
    return p.find(x => x.isDefault)?.name ?? p[0]?.name ?? '';
  });
  const [selectedLocationPreset, setSelectedLocationPreset] = useState<string>(() => {
    if (savedPrefs.selectedLocationPreset) return savedPrefs.selectedLocationPreset;
    const p = Object.values(loadPresets()).filter(p => p.category === 'location' || p.name.includes('地点'));
    return p.find(x => x.isDefault)?.name ?? p[0]?.name ?? '';
  });
  const [autoDeduplicationDialogue, setAutoDeduplicationDialogue] = useState(() => savedPrefs.autoDeduplicationDialogue ?? false);
  const [autoDeduplicationLocation, setAutoDeduplicationLocation] = useState(() => savedPrefs.autoDeduplicationLocation ?? true);
  const [frameInterval, setFrameInterval] = useState(() => savedPrefs.frameInterval ?? 15);
  const [skipSubtitleDialogue, setSkipSubtitleDialogue] = useState(() => savedPrefs.skipSubtitleDialogue ?? false);
  const [skipSubtitleLocation, setSkipSubtitleLocation] = useState(() => savedPrefs.skipSubtitleLocation ?? true);

  // 每次任意选项变化时自动保存
  const persistPrefs = (patch: Partial<PanelPrefs>) => {
    const current: PanelPrefs = {
      captureDialogue,
      captureLocation,
      selectedDialoguePreset,
      selectedLocationPreset,
      autoDeduplicationDialogue,
      autoDeduplicationLocation,
      skipSubtitleDialogue,
      skipSubtitleLocation,
      frameInterval,
      ...patch,
    };
    savePanelPrefs(current);
  };

  const dialoguePresets = useMemo(
    () => Object.values(presets).filter((p): p is RoiPreset => (p as RoiPreset).category === 'dialogue' || (p as RoiPreset).name.includes('对话')),
    [presets],
  );
  const locationPresets = useMemo(
    () => Object.values(presets).filter((p): p is RoiPreset => (p as RoiPreset).category === 'location' || (p as RoiPreset).name.includes('地点')),
    [presets],
  );

  const handleConfirm = () => {
    if (!captureDialogue && !captureLocation) {
      notifier.addToast('请至少选择一种截取类型', 'warning');
      return;
    }

    let dialoguePreset: RoiPreset | null = null;
    let locationPreset: RoiPreset | null = null;

    if (captureDialogue) {
      const name = selectedDialoguePreset || (dialoguePresets[0]?.name ?? '');
      dialoguePreset = dialoguePresets.find(p => p.name === name) ?? null;
      if (!dialoguePreset) { notifier.addToast('请先选择一个对话坐标预设', 'warning'); return; }
    }
    if (captureLocation) {
      const name = selectedLocationPreset || (locationPresets[0]?.name ?? '');
      locationPreset = locationPresets.find(p => p.name === name) ?? null;
      if (!locationPreset) { notifier.addToast('请先选择一个地点坐标预设', 'warning'); return; }
    }

    const captureType = captureDialogue && captureLocation ? 'both' : captureDialogue ? 'dialogue' : 'location';

    onConfirm(
      srtFile,
      dialoguePreset,
      locationPreset,
      timeRange,
      captureType,
      autoDeduplicationDialogue,
      autoDeduplicationLocation,
      srtFile ? undefined : frameInterval,
      skipSubtitleDialogue,
      skipSubtitleLocation,
    );
  };

  return (
    <div>
      {/* 三列横向等分布局，每列独立卡片 */}
      <div className="flex gap-3 px-4 py-3">

        {/* ── 第一列：SRT 文件卡片 ── */}
        <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
            <h4 className="text-xs font-semibold text-gray-600">上传 SRT 字幕文件</h4>
            <span className="text-xs font-normal text-gray-400">（可选）</span>
          </div>
          <div className="p-4 flex flex-col gap-3 flex-1">
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-3 hover:border-indigo-400 hover:bg-indigo-50/20 transition-colors cursor-pointer relative flex-1">
              <input
                type="file"
                accept=".srt"
                onChange={e => setSrtFile(e.target.files?.[0] ?? null)}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                disabled={isProcessing}
              />
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-500 flex-shrink-0">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="flex-grow min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{srtFile ? srtFile.name : '选择文件'}</p>
                  <p className="text-xs text-gray-400">{srtFile ? '将按 SRT 时间段截取' : '未上传时使用固定帧间隔截取'}</p>
                </div>
                {srtFile && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setSrtFile(null); }}
                    className="z-20 relative p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    disabled={isProcessing}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── 第二列：对话卡片 ── */}
        <div className={`flex-1 bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col transition-all ${captureDialogue ? 'border-blue-200' : 'border-gray-200 opacity-60'}`}>
          <div className={`px-4 py-3 border-b flex items-center gap-2 ${captureDialogue ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100'}`}>
            <label className="flex items-center gap-2 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={captureDialogue}
                onChange={e => { setCaptureDialogue(e.target.checked); persistPrefs({ captureDialogue: e.target.checked }); }}
                disabled={isProcessing}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
              />
              <span className={`text-sm font-semibold ${captureDialogue ? 'text-blue-700' : 'text-gray-500'}`}>对话</span>
            </label>
          </div>
          <div className={`p-4 flex flex-col gap-3 flex-1 ${!captureDialogue && 'bg-gray-50/50'}`}>
            {/* 坐标预设 */}
            {dialoguePresets.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-800">没有可用的「对话」预设</div>
            ) : (
              <div className="overflow-y-auto max-h-16">
                <div className="grid grid-cols-3 gap-1">
                  {dialoguePresets.map(p => {
                    const checked = selectedDialoguePreset === p.name;
                    return (
                      <label key={p.name} title={p.description} className={`flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg border cursor-pointer transition-all text-center ${checked ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}>
                        <input type="radio" className="sr-only" checked={checked} onChange={() => { setSelectedDialoguePreset(p.name); persistPrefs({ selectedDialoguePreset: p.name }); }} disabled={isProcessing} />
                        <span className={`text-xs font-medium truncate ${checked ? 'text-blue-700' : 'text-gray-700'}`}>{p.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            {/* 跳过字幕 */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox" checked={skipSubtitleDialogue}
                onChange={e => { setSkipSubtitleDialogue(e.target.checked); persistPrefs({ skipSubtitleDialogue: e.target.checked }); }}
                disabled={isProcessing || !srtFile}
                className="w-3.5 h-3.5 text-amber-600 border-gray-300 rounded focus:ring-1 focus:ring-amber-500 flex-shrink-0"
              />
              <span className={`text-xs ${srtFile ? 'text-amber-800' : 'text-gray-400'}`}>
                跳过包含字幕的区域
                {!srtFile && <span className="ml-1 text-gray-400">（需上传 SRT）</span>}
              </span>
            </label>
            {/* 去重 */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox" checked={autoDeduplicationDialogue}
                onChange={e => { setAutoDeduplicationDialogue(e.target.checked); persistPrefs({ autoDeduplicationDialogue: e.target.checked }); }}
                disabled={isProcessing}
                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-1 focus:ring-blue-500 flex-shrink-0"
              />
              <span className="text-xs text-blue-800">截取完成后自动去重</span>
            </label>
          </div>
        </div>

        {/* ── 第三列：地点卡片 ── */}
        <div className={`flex-1 bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col transition-all ${captureLocation ? 'border-green-200' : 'border-gray-200 opacity-60'}`}>
          <div className={`px-4 py-3 border-b flex items-center gap-2 ${captureLocation ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
            <label className="flex items-center gap-2 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={captureLocation}
                onChange={e => { setCaptureLocation(e.target.checked); persistPrefs({ captureLocation: e.target.checked }); }}
                disabled={isProcessing}
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-1 focus:ring-green-500"
              />
              <span className={`text-sm font-semibold ${captureLocation ? 'text-green-700' : 'text-gray-500'}`}>地点</span>
            </label>
          </div>
          <div className={`p-4 flex flex-col gap-3 flex-1 ${!captureLocation && 'bg-gray-50/50'}`}>
            {/* 坐标预设 */}
            {locationPresets.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-800">没有可用的「地点」预设</div>
            ) : (
              <div className="overflow-y-auto max-h-16">
                <div className="grid grid-cols-3 gap-1">
                  {locationPresets.map((p) => {
                    const checked = selectedLocationPreset === p.name;
                    return (
                      <label key={p.name} title={p.description} className={`flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg border cursor-pointer transition-all text-center ${checked ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'}`}>
                        <input type="radio" className="sr-only" checked={checked} onChange={() => { setSelectedLocationPreset(p.name); persistPrefs({ selectedLocationPreset: p.name }); }} disabled={isProcessing} />
                        <span className={`text-xs font-medium truncate ${checked ? 'text-green-700' : 'text-gray-700'}`}>{p.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            {/* 跳过字幕 */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox" checked={skipSubtitleLocation}
                onChange={e => { setSkipSubtitleLocation(e.target.checked); persistPrefs({ skipSubtitleLocation: e.target.checked }); }}
                disabled={isProcessing || !srtFile}
                className="w-3.5 h-3.5 text-amber-600 border-gray-300 rounded focus:ring-1 focus:ring-amber-500 flex-shrink-0"
              />
              <span className={`text-xs ${srtFile ? 'text-amber-800' : 'text-gray-400'}`}>
                跳过包含字幕的区域
                {!srtFile && <span className="ml-1 text-gray-400">（需上传 SRT）</span>}
              </span>
            </label>
            {/* 去重 */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox" checked={autoDeduplicationLocation}
                onChange={e => { setAutoDeduplicationLocation(e.target.checked); persistPrefs({ autoDeduplicationLocation: e.target.checked }); }}
                disabled={isProcessing}
                className="w-3.5 h-3.5 text-green-600 border-gray-300 rounded focus:ring-1 focus:ring-green-500 flex-shrink-0"
              />
              <span className="text-xs text-green-800">截取完成后自动去重</span>
            </label>
          </div>
        </div>

      </div>

      {/* 底部：进度条 + 开始按钮 */}
      <div className="px-4 pb-3 space-y-2">
        {/* 进度条区域：处理中时显示 */}
        {isProcessing && progress && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
            {/* 总进度标题行 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 animate-spin text-indigo-600 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-xs font-semibold text-gray-700 truncate max-w-[320px]">{progress.message}</span>
              </div>
              <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${progress.stage === 'deduplicating' ? 'text-purple-600' : 'text-indigo-600'}`}>
                {Math.round(progress.current)}%
              </span>
            </div>

            {/* 主进度条 */}
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  progress.stage === 'deduplicating'
                    ? 'bg-gradient-to-r from-purple-500 to-purple-400'
                    : progress.message.includes('地点')
                    ? 'bg-gradient-to-r from-green-500 to-green-400'
                    : 'bg-gradient-to-r from-indigo-500 to-blue-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, progress.current))}%` }}
              />
            </div>

            {/* 阶段标签行 */}
            <div className="flex items-center gap-3">
              {/* 截取对话 */}
              <div className={`flex items-center gap-1 text-[11px] font-medium ${
                progress.stage === 'extracting' && !progress.message.includes('地点')
                  ? 'text-blue-600'
                  : 'text-gray-400'
              }`}>
                {progress.stage === 'extracting' && !progress.message.includes('地点') ? (
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                截取对话
              </div>

              <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>

              {/* 截取地点 */}
              <div className={`flex items-center gap-1 text-[11px] font-medium ${
                progress.stage === 'extracting' && progress.message.includes('地点')
                  ? 'text-green-600'
                  : progress.stage === 'deduplicating'
                  ? 'text-gray-400'
                  : 'text-gray-300'
              }`}>
                {progress.stage === 'extracting' && progress.message.includes('地点') ? (
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : progress.stage === 'deduplicating' ? (
                  <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <div className="w-3 h-3 rounded-full border-2 border-gray-300" />
                )}
                截取地点
              </div>

              <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>

              {/* 自动去重 */}
              <div className={`flex items-center gap-1 text-[11px] font-medium ${
                progress.stage === 'deduplicating' ? 'text-purple-600' : 'text-gray-300'
              }`}>
                {progress.stage === 'deduplicating' ? (
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <div className="w-3 h-3 rounded-full border-2 border-gray-300" />
                )}
                自动去重
              </div>
            </div>
          </div>
        )}

        {/* 开始按钮 */}
        <div className="flex justify-end">
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Scan className="w-4 h-4" />
            {isProcessing ? '处理中…' : '开始一键处理'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickProcessPanel;
