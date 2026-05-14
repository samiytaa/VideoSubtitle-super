import { Scan, Upload } from 'lucide-react';
import React from 'react';
import { RoiPreset, VideoFile } from '../../types';
import { useNotifier } from '../Notifications';
import { formatTimeHms } from './roiSelectorUtils';
import { formatTimestampDisplay } from '../../utils/filenameUtils';

interface QuickProcessDialogProps {
  video?: VideoFile | null;
  presets: Record<string, RoiPreset>;
  defaultPresetName: string;
  isProcessing: boolean;
  progress?: { current: number; total: number; message: string; stage?: 'extracting' | 'deduplicating' };
  timeRange: { startTime: number; endTime: number };
  onClose: () => void;
  onConfirm: (
    file: File | null,
    dialoguePreset: RoiPreset | null,
    locationPreset: RoiPreset | null,
    timeRange: { startTime: number; endTime: number },
    captureType: 'dialogue' | 'location' | 'both',
    autoDeduplicationDialogue: boolean,
    autoDeduplicationLocation: boolean,
    frameInterval?: number,
  ) => void;
  onSrtFileChange: (file: File | null) => void;
  onPresetChange: (name: string, type: 'dialogue' | 'location') => void;
  selectedDialoguePresetName: string;
  selectedLocationPresetName: string;
  srtFile: File | null;
}

const QuickProcessDialog: React.FC<QuickProcessDialogProps> = ({
  presets,
  defaultPresetName,
  isProcessing,
  progress,
  timeRange,
  onClose,
  onConfirm,
  onSrtFileChange,
  onPresetChange,
  selectedDialoguePresetName,
  selectedLocationPresetName,
  srtFile,
}) => {
  const notifier = useNotifier();
  const [captureType, setCaptureType] = React.useState<'dialogue' | 'location' | 'both'>('both');
  const [autoDeduplicationDialogue, setAutoDeduplicationDialogue] = React.useState<boolean>(false);
  const [autoDeduplicationLocation, setAutoDeduplicationLocation] = React.useState<boolean>(true);
  const [frameInterval, setFrameInterval] = React.useState<number>(15);

  const dialoguePresets = React.useMemo(
    () => (Object.values(presets) as RoiPreset[]).filter(p =>
      p.category === 'dialogue' || p.name.includes('对话') || p.name.includes('【对话】')
    ),
    [presets],
  );

  const locationPresets = React.useMemo(
    () => (Object.values(presets) as RoiPreset[]).filter(p =>
      p.category === 'location' || p.name.includes('地点') || p.name.includes('【地点】')
    ),
    [presets],
  );

  const handleConfirm = () => {
    let dialoguePreset: RoiPreset | null = null;
    let locationPreset: RoiPreset | null = null;

    if (captureType === 'dialogue' || captureType === 'both') {
      const presetName = selectedDialoguePresetName || defaultPresetName || (dialoguePresets[0]?.name) || '';
      dialoguePreset = dialoguePresets.find(p => p.name === presetName) || null;
      if (!dialoguePreset) {
        notifier.addToast('请先选择一个对话坐标预设', 'warning');
        return;
      }
    }

    if (captureType === 'location' || captureType === 'both') {
      const presetName = selectedLocationPresetName || (locationPresets[0]?.name) || '';
      locationPreset = locationPresets.find(p => p.name === presetName) || null;
      if (!locationPreset) {
        notifier.addToast('请先选择一个地点坐标预设', 'warning');
        return;
      }
    }

    onConfirm(
      srtFile,
      dialoguePreset,
      locationPreset,
      timeRange,
      captureType,
      autoDeduplicationDialogue,
      autoDeduplicationLocation,
      srtFile ? undefined : frameInterval,
    );
  };

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh] overflow-hidden">
        {/* 固定头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Scan className="w-4 h-4 text-indigo-600" />
            一键处理
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
            disabled={isProcessing}
            aria-label="关闭"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 可滚动内容区域 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* 步骤 1：截取时间范围 */}
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold">1</span>
              截取时间范围
            </h4>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 flex items-center justify-between">
              <span className="font-medium">时间范围</span>
              <span className="font-mono text-sm text-gray-900">
                {formatTimestampDisplay(timeRange.startTime)} ～ {formatTimestampDisplay(timeRange.endTime)}
              </span>
            </div>
          </div>

          {/* 步骤 2：上传 SRT 字幕文件（可选） */}
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold">2</span>
              上传 SRT 字幕文件
              <span className="text-xs font-normal text-gray-400">（可选）</span>
            </h4>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors cursor-pointer relative">
              <input
                type="file"
                accept=".srt"
                onChange={e => onSrtFileChange(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                disabled={isProcessing}
              />
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="grow min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {srtFile ? srtFile.name : '选择文件'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {srtFile ? '将按 SRT 时间段截取' : '未上传时使用固定帧间隔截取'}
                  </p>
                </div>
                {srtFile && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onSrtFileChange(null); }}
                    className="z-20 relative p-1 text-gray-400 hover:text-red-500 transition-colors"
                    disabled={isProcessing}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* 无 SRT 时显示帧间隔设置 */}
            {!srtFile && (
              <div className="mt-2 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <span className="text-xs text-amber-800 font-medium whitespace-nowrap">固定帧间隔</span>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={frameInterval}
                  onChange={e => setFrameInterval(Math.max(1, Math.min(300, parseInt(e.target.value) || 1)))}
                  disabled={isProcessing}
                  className="w-20 text-xs text-center border border-amber-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                />
                <span className="text-xs text-amber-700">帧（每隔 {frameInterval} 帧截一张）</span>
              </div>
            )}
          </div>

          {/* 步骤 3：选择坐标预设 */}
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold">3</span>
              选择坐标预设
            </h4>

            {/* 对话预设 */}
            {(captureType === 'dialogue' || captureType === 'both') && (
              <div className="mb-3">
                <div className="text-xs font-medium text-blue-700 mb-1.5">对话坐标预设</div>
                {dialoguePresets.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-800">
                    没有可用的「对话」预设
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {dialoguePresets.map(p => {
                      const checked = selectedDialoguePresetName === p.name || (!selectedDialoguePresetName && defaultPresetName === p.name);
                      return (
                        <label
                          key={p.name}
                          className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                            checked ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="radio"
                            className="mt-1"
                            checked={checked}
                            onChange={() => onPresetChange(p.name, 'dialogue')}
                            disabled={isProcessing}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-medium text-gray-800 truncate">{p.name}</span>
                              {p.isDefault && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500 text-white font-medium">默认</span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-500 truncate">{p.description}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 地点预设 */}
            {(captureType === 'location' || captureType === 'both') && (
              <div>
                <div className="text-xs font-medium text-green-700 mb-1.5">地点坐标预设</div>
                {locationPresets.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-800">
                    没有可用的「地点」预设
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {locationPresets.map((p, index) => {
                      const checked = selectedLocationPresetName === p.name || (!selectedLocationPresetName && index === 0);
                      return (
                        <label
                          key={p.name}
                          className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                            checked ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="radio"
                            className="mt-1"
                            checked={checked}
                            onChange={() => onPresetChange(p.name, 'location')}
                            disabled={isProcessing}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-medium text-gray-800 truncate">{p.name}</span>
                              {p.isDefault && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500 text-white font-medium">默认</span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-500 truncate">{p.description}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 步骤 4：去重选项 */}
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold">4</span>
              去重选项
            </h4>
            <div className="space-y-2">
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoDeduplicationDialogue}
                    onChange={e => setAutoDeduplicationDialogue(e.target.checked)}
                    disabled={isProcessing}
                    className="w-4 h-4 text-blue-600 border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-blue-900">对【对话】结果去重</span>
                    <p className="text-xs text-blue-700 mt-0.5">
                      启用后，对话截取完成会自动去除重复图片（8线程并行，去重到无法再去重）
                    </p>
                  </div>
                </label>
              </div>
              <div className="border border-green-200 bg-green-50 rounded-lg p-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoDeduplicationLocation}
                    onChange={e => setAutoDeduplicationLocation(e.target.checked)}
                    disabled={isProcessing}
                    className="w-4 h-4 text-green-600 border-green-300 rounded focus:ring-2 focus:ring-green-500"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-green-900">对【地点】结果去重</span>
                    <p className="text-xs text-green-700 mt-0.5">
                      启用后，地点截取完成会自动去除重复图片（8线程并行，去重到无法再去重）
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* 说明 + 进度 */}
          <div className="space-y-2">
            <div className={`border rounded-lg p-3 text-[11px] ${
              captureType === 'dialogue'
                ? 'bg-blue-50 border-blue-100 text-blue-800'
                : captureType === 'location'
                ? 'bg-green-50 border-green-100 text-green-800'
                : 'bg-purple-50 border-purple-100 text-purple-800'
            }`}>
              {captureType === 'dialogue' ? (
                <>将使用当前视频的时间范围与默认截取参数，根据所选<strong>对话坐标预设 + SRT 字幕</strong>，自动截取对话区域截图，并保存到 <strong>【对话】分组</strong>{autoDeduplicationDialogue ? '，然后自动去重' : ''}。</>
              ) : captureType === 'location' ? (
                <>将使用当前视频的时间范围与默认截取参数，根据所选<strong>地点坐标预设 + SRT 字幕</strong>，<strong>跳过包含字幕的区域</strong>，自动截取地点区域截图，并保存到 <strong>【地点】分组</strong>{autoDeduplicationLocation ? '，然后自动去重' : ''}。</>
              ) : (
                <>将<strong>先处理对话，再处理地点</strong>。使用当前视频的时间范围与默认截取参数，根据所选预设 + SRT 字幕，自动截取对话和地点区域截图，分别保存到 <strong>【对话】</strong>和<strong>【地点】分组</strong>{autoDeduplicationDialogue && autoDeduplicationLocation ? '，并分别自动去重' : autoDeduplicationDialogue ? '，对话分组自动去重' : autoDeduplicationLocation ? '，地点分组自动去重' : ''}。</>
              )}
            </div>

            {/* 进度条区域 */}
            {isProcessing && progress && (
              <div className="space-y-2">
                {/* 步骤1：截取对话 */}
                <ProgressStep
                  label="步骤1：截取【对话】"
                  isActive={progress.stage === 'extracting' && !progress.message.includes('地点')}
                  isDone={!(progress.stage === 'extracting' && !progress.message.includes('地点'))}
                  percent={progress.stage === 'extracting' && !progress.message.includes('地点') ? Math.min(100, Math.max(0, progress.current)) : 100}
                  color="blue"
                />

                {/* 步骤2：截取地点 */}
                <ProgressStep
                  label="步骤2：截取【地点】"
                  isActive={progress.stage === 'extracting' && progress.message.includes('地点')}
                  isDone={progress.stage === 'deduplicating'}
                  percent={
                    progress.stage === 'extracting' && progress.message.includes('地点')
                      ? Math.min(100, Math.max(0, progress.current))
                      : progress.stage === 'deduplicating' ? 100 : 0
                  }
                  color="green"
                />

                {/* 步骤3：去重对话（如果勾选） */}
                {autoDeduplicationDialogue && (
                  <ProgressStep
                    label="步骤3：去重【对话】"
                    isActive={progress.stage === 'deduplicating' && progress.message.includes('对话')}
                    isDone={progress.stage === 'deduplicating' && progress.message.includes('地点')}
                    percent={
                      progress.stage === 'deduplicating' && progress.message.includes('对话')
                        ? Math.min(100, Math.max(0, progress.current))
                        : progress.stage === 'deduplicating' && progress.message.includes('地点') ? 100 : 0
                    }
                    color="purple"
                    message={progress.stage === 'deduplicating' && progress.message.includes('对话') ? progress.message : undefined}
                  />
                )}

                {/* 步骤4：去重地点（如果勾选） */}
                {autoDeduplicationLocation && (
                  <ProgressStep
                    label={`步骤${autoDeduplicationDialogue ? '4' : '3'}：去重【地点】`}
                    isActive={progress.stage === 'deduplicating' && progress.message.includes('地点')}
                    isDone={false}
                    percent={
                      progress.stage === 'deduplicating' && progress.message.includes('地点')
                        ? Math.min(100, Math.max(0, progress.current))
                        : 0
                    }
                    color="purple"
                    message={progress.stage === 'deduplicating' && progress.message.includes('地点') ? progress.message : undefined}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* 固定脚部 */}
        <div className="flex flex-row-reverse gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={handleConfirm}
            className="inline-flex items-center justify-center rounded-lg px-5 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={
              isProcessing ||
              (captureType === 'dialogue' && dialoguePresets.length === 0) ||
              (captureType === 'location' && locationPresets.length === 0) ||
              (captureType === 'both' && (dialoguePresets.length === 0 || locationPresets.length === 0))
            }
          >
            {isProcessing ? '处理中...' : '一键处理'}
          </button>
        </div>
      </div>
    </div>
  );
};

// 进度步骤子组件
interface ProgressStepProps {
  label: string;
  isActive: boolean;
  isDone: boolean;
  percent: number;
  color: 'blue' | 'green' | 'purple';
  message?: string;
}

const colorMap = {
  blue: { bar: 'bg-blue-500', text: 'text-blue-600', spin: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  green: { bar: 'bg-green-500', text: 'text-green-600', spin: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  purple: { bar: 'bg-purple-500', text: 'text-purple-600', spin: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
};

const ProgressStep: React.FC<ProgressStepProps> = ({ label, isActive, isDone, percent, color, message }) => {
  const c = colorMap[color];
  return (
    <div className={`border rounded-lg p-3 space-y-1.5 transition-all ${isActive ? c.bg : isDone ? 'bg-gray-50 border-gray-200' : 'bg-gray-50 border-gray-200 opacity-50'}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700 flex items-center gap-1.5">
          {isActive ? (
            <svg className={`w-3.5 h-3.5 animate-spin ${c.spin}`} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : isDone ? (
            <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-400" />
          )}
          {label}
        </span>
        <span className={`font-semibold ${c.text}`}>{Math.round(percent)}%</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${c.bar} transition-all duration-300`} style={{ width: `${percent}%` }} />
      </div>
      {message && <div className={`text-[10px] ${c.text} mt-1`}>{message}</div>}
    </div>
  );
};

export default QuickProcessDialog;
