import { Scan, Upload } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { RoiPreset, VideoFile } from '../types';
import { useNotifier } from './Notifications';
import {
  getDefaultQuickProcessPrefs,
  loadQuickProcessPrefs,
  QuickProcessPrefs,
  subscribeQuickProcessPrefs,
  updateQuickProcessPrefs,
} from '../utils/quickProcessPrefs';
import { loadRoiPresets, subscribeRoiPresets } from '../utils/roiPresetStore';

export interface QuickProcessPanelProps {
  video: VideoFile | null;
  srtFile: File | null;
  onSrtFileChange: (file: File | null) => void;
  timeRange: { startTime: number; endTime: number };
  isProcessing: boolean;
  progress?: {
    current: number;
    total: number;
    message: string;
    stage?: 'extracting' | 'extracting-dialogue' | 'extracting-location' | 'deduplicating';
  };
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
  srtFile,
  onSrtFileChange,
  timeRange,
  isProcessing,
  progress,
  onConfirm,
}) => {
  const notifier = useNotifier();
  const [presets, setPresets] = useState<Record<string, RoiPreset>>(loadRoiPresets);

  // 读取上次保存的偏好
  const savedPrefs = useMemo(() => ({
    ...getDefaultQuickProcessPrefs(),
    ...loadQuickProcessPrefs(),
  }), []);

  const [captureDialogue, setCaptureDialogue] = useState(() => savedPrefs.captureDialogue ?? true);
  const [captureLocation, setCaptureLocation] = useState(() => savedPrefs.captureLocation ?? true);
  const [selectedDialoguePreset, setSelectedDialoguePreset] = useState<string>(() => {
    // 优先用上次记忆的选择，其次用默认预设，最后用第一个
    if (savedPrefs.selectedDialoguePreset) return savedPrefs.selectedDialoguePreset;
    const p = Object.values(loadRoiPresets()).filter(p => p.category === 'dialogue' || p.name.includes('对话'));
    return p.find(x => x.isDefault)?.name ?? p[0]?.name ?? '';
  });
  const [selectedLocationPreset, setSelectedLocationPreset] = useState<string>(() => {
    if (savedPrefs.selectedLocationPreset) return savedPrefs.selectedLocationPreset;
    const p = Object.values(loadRoiPresets()).filter(p => p.category === 'location' || p.name.includes('地点'));
    return p.find(x => x.isDefault)?.name ?? p[0]?.name ?? '';
  });
  const [autoDeduplicationDialogue, setAutoDeduplicationDialogue] = useState(() => savedPrefs.autoDeduplicationDialogue ?? false);
  const [autoDeduplicationLocation, setAutoDeduplicationLocation] = useState(() => savedPrefs.autoDeduplicationLocation ?? true);
  const [frameInterval, setFrameInterval] = useState(() => savedPrefs.frameInterval ?? 15);
  const [skipSubtitleDialogue, setSkipSubtitleDialogue] = useState(() => savedPrefs.skipSubtitleDialogue ?? false);
  const [skipSubtitleLocation, setSkipSubtitleLocation] = useState(() => savedPrefs.skipSubtitleLocation ?? true);

  // 每次任意选项变化时自动保存
  const persistPrefs = (patch: Partial<QuickProcessPrefs>) => {
    const current: QuickProcessPrefs = {
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
    updateQuickProcessPrefs(current);
  };

  React.useEffect(() => {
    return subscribeQuickProcessPrefs((prefs) => {
      if (typeof prefs.captureDialogue === 'boolean') setCaptureDialogue(prefs.captureDialogue);
      if (typeof prefs.captureLocation === 'boolean') setCaptureLocation(prefs.captureLocation);
      if (typeof prefs.selectedDialoguePreset === 'string') setSelectedDialoguePreset(prefs.selectedDialoguePreset);
      if (typeof prefs.selectedLocationPreset === 'string') setSelectedLocationPreset(prefs.selectedLocationPreset);
      if (typeof prefs.autoDeduplicationDialogue === 'boolean') setAutoDeduplicationDialogue(prefs.autoDeduplicationDialogue);
      if (typeof prefs.autoDeduplicationLocation === 'boolean') setAutoDeduplicationLocation(prefs.autoDeduplicationLocation);
      if (typeof prefs.skipSubtitleDialogue === 'boolean') setSkipSubtitleDialogue(prefs.skipSubtitleDialogue);
      if (typeof prefs.skipSubtitleLocation === 'boolean') setSkipSubtitleLocation(prefs.skipSubtitleLocation);
      if (typeof prefs.frameInterval === 'number') setFrameInterval(prefs.frameInterval);
    });
  }, []);

  React.useEffect(() => {
    return subscribeRoiPresets((nextPresets) => {
      setPresets(nextPresets);
    });
  }, []);

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
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-500">上传 SRT 字幕文件</div>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-3 hover:border-indigo-400 hover:bg-indigo-50/20 transition-colors cursor-pointer relative">
              <input
                type="file"
                accept=".srt"
                onChange={e => onSrtFileChange(e.target.files?.[0] ?? null)}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                disabled={isProcessing}
              />
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-500 shrink-0">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="grow min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{srtFile ? srtFile.name : '选择文件'}</p>
                  <p className="text-xs text-gray-400">{srtFile ? '将按 SRT 时间段截取' : '未上传时使用固定帧间隔截取'}</p>
                </div>
                {srtFile && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onSrtFileChange(null); }}
                    className="z-20 relative p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0"
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

          <div className="text-xs text-gray-500">
            当前将按已勾选分类执行：{captureDialogue && captureLocation ? '对话 + 地点' : captureDialogue ? '仅对话' : captureLocation ? '仅地点' : '未选择'}
          </div>

          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="w-full px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Scan className="w-4 h-4" />
            {isProcessing ? '处理中…' : '一键处理'}
          </button>

          <div className="space-y-2">
            {/* 进度条区域：处理中时显示 */}
            {isProcessing && progress && (
              <QuickProgressBar
                progress={progress}
                captureDialogue={captureDialogue}
                captureLocation={captureLocation}
                autoDeduplicationDialogue={autoDeduplicationDialogue}
                autoDeduplicationLocation={autoDeduplicationLocation}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── 进度条子组件 ──────────────────────────────────────────────────────────────

interface QuickProgressBarProps {
  progress: {
    current: number;
    total: number;
    message: string;
    stage?: 'extracting' | 'extracting-dialogue' | 'extracting-location' | 'deduplicating';
  };
  captureDialogue: boolean;
  captureLocation: boolean;
  autoDeduplicationDialogue: boolean;
  autoDeduplicationLocation: boolean;
}

type StepStatus = 'pending' | 'active' | 'done';

interface StepDef {
  key: string;
  label: string;
  color: 'blue' | 'green' | 'purple';
  activeStage: QuickProgressBarProps['progress']['stage'];
}

const SpinIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`animate-spin ${className ?? ''}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const stepColorMap = {
  blue:   { bar: 'bg-blue-500',   text: 'text-blue-600',   activeBg: 'bg-blue-50 border-blue-200' },
  green:  { bar: 'bg-green-500',  text: 'text-green-600',  activeBg: 'bg-green-50 border-green-200' },
  purple: { bar: 'bg-purple-500', text: 'text-purple-600', activeBg: 'bg-purple-50 border-purple-200' },
};

const QuickProgressBar: React.FC<QuickProgressBarProps> = ({
  progress,
  captureDialogue,
  captureLocation,
  autoDeduplicationDialogue,
  autoDeduplicationLocation,
}) => {
  // 根据实际勾选项构建步骤列表
  const steps = React.useMemo<StepDef[]>(() => {
    const list: StepDef[] = [];
    if (captureDialogue) list.push({ key: 'dialogue', label: '截取对话', color: 'blue', activeStage: 'extracting-dialogue' });
    if (captureLocation) list.push({ key: 'location', label: '截取地点', color: 'green', activeStage: 'extracting-location' });
    if (captureDialogue && autoDeduplicationDialogue) list.push({ key: 'dedup-dialogue', label: '去重对话', color: 'purple', activeStage: 'deduplicating' });
    if (captureLocation && autoDeduplicationLocation) list.push({ key: 'dedup-location', label: '去重地点', color: 'purple', activeStage: 'deduplicating' });
    return list;
  }, [captureDialogue, captureLocation, autoDeduplicationDialogue, autoDeduplicationLocation]);

  const stage = progress.stage;
  const pct = Math.min(100, Math.max(0, progress.current));

  // 计算每个步骤的状态
  const getStepStatus = (step: StepDef, idx: number): StepStatus => {
    if (step.activeStage === 'deduplicating') {
      // 去重步骤：需要区分对话/地点
      if (stage !== 'deduplicating') return idx < steps.findIndex(s => s.activeStage === 'deduplicating') ? 'done' : 'pending';
      const dedupSteps = steps.filter(s => s.activeStage === 'deduplicating');
      const isDialogueDedup = step.key === 'dedup-dialogue';
      const isLocationDedup = step.key === 'dedup-location';
      if (isDialogueDedup && progress.message.includes('对话')) return 'active';
      if (isLocationDedup && progress.message.includes('地点')) return 'active';
      // 对话去重已完成（当前在地点去重）
      if (isDialogueDedup && progress.message.includes('地点')) return 'done';
      return 'pending';
    }
    if (stage === step.activeStage) return 'active';
    // 判断是否已完成：当前 stage 在步骤列表中排在该步骤之后
    const stageOrder: Record<string, number> = {
      'extracting-dialogue': 0,
      'extracting-location': 1,
      'extracting': 0,
      'deduplicating': 2,
    };
    const currentOrder = stageOrder[stage ?? ''] ?? -1;
    const stepOrder = stageOrder[step.activeStage ?? ''] ?? 99;
    return currentOrder > stepOrder ? 'done' : 'pending';
  };

  const getStepProgress = React.useCallback((step: StepDef): number => {
    if (step.key === 'dialogue') {
      if (stage === 'extracting-dialogue') return pct;
      if (stage === 'extracting-location' || stage === 'deduplicating') return 100;
      return 0;
    }

    if (step.key === 'location') {
      if (stage === 'extracting-location') return pct;
      if (stage === 'deduplicating') return 100;
      return 0;
    }

    if (step.key === 'dedup-dialogue') {
      if (stage !== 'deduplicating') return 0;
      if (progress.message.includes('对话')) return pct;
      if (progress.message.includes('地点')) return 100;
      return 0;
    }

    if (step.key === 'dedup-location') {
      if (stage === 'deduplicating' && progress.message.includes('地点')) return pct;
      return 0;
    }

    return 0;
  }, [stage, pct, progress.message]);

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2.5">
      {/* 标题行：当前消息 */}
      <div className="flex items-center gap-2 min-w-0">
        <SpinIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
        <span className="text-xs font-semibold text-gray-700 truncate">{progress.message}</span>
      </div>

      {/* 每个步骤独立进度 */}
      <div className="space-y-2">
        {steps.map((step, idx) => {
          const status = getStepStatus(step, idx);
          const c = stepColorMap[step.color];
          const stepProgress = Math.max(0, Math.min(100, getStepProgress(step)));

          return (
            <div
              key={step.key}
              className={`rounded-lg border px-2.5 py-2 transition-colors ${
                status === 'active' ? c.activeBg : status === 'done' ? 'bg-white border-gray-200' : 'bg-white/70 border-gray-100'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {status === 'active' ? (
                    <SpinIcon className={`w-3.5 h-3.5 shrink-0 ${c.text}`} />
                  ) : status === 'done' ? (
                    <CheckIcon className="w-3.5 h-3.5 shrink-0 text-green-500" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 shrink-0" />
                  )}
                  <span className={`text-xs font-medium truncate ${status === 'pending' ? 'text-gray-400' : 'text-gray-700'}`}>
                    {step.label}
                  </span>
                </div>
                <span className={`text-xs font-bold tabular-nums shrink-0 ${status === 'active' ? c.text : 'text-gray-500'}`}>
                  {Math.round(stepProgress)}%
                </span>
              </div>

              <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    step.color === 'purple' ? 'bg-purple-400' :
                    step.color === 'green' ? 'bg-green-400' : 'bg-blue-400'
                  }`}
                  style={{ width: `${stepProgress}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QuickProcessPanel;
