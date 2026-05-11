import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Play,
  RefreshCw,
  Upload,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ExtractionMode, ExtractionParams, RoiPreset, VideoFile } from '../types';
import { useNotifier } from './Notifications';

// ─── 类型 ────────────────────────────────────────────────────────────────────

interface SrtSegment {
  start: number;
  end: number;
  duration: number;
}

interface SrtData {
  subtitle_segments: SrtSegment[];
  non_subtitle_segments: SrtSegment[];
}

export interface ParamSetterProps {
  video: VideoFile;
  params: ExtractionParams;
  onConfirm: (params: ExtractionParams, appendMode?: boolean) => void;
  onBack: () => void;
  hasExistingFrames?: boolean;
  isProcessing?: boolean;
  progress?: { current: number; total: number; message: string; stage?: 'extracting' | 'deduplicating' };
  onPresetSelect?: (preset: RoiPreset) => void;
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
};

const parseSrtToSegments = (content: string): SrtSegment[] => {
  const segments: SrtSegment[] = [];
  const re = /(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/;
  const toSec = (h: string, m: string, s: string, ms: string) =>
    parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
  for (const block of content.replace(/\r/g, '').split('\n\n')) {
    if (!block.trim()) continue;
    const match = block.split('\n')[1]?.match(re);
    if (match) {
      const start = toSec(match[1], match[2], match[3], match[4]);
      const end = toSec(match[5], match[6], match[7], match[8]);
      segments.push({ start, end, duration: end - start });
    }
  }
  return segments;
};

const calculateNonSubtitleSegments = (subs: SrtSegment[], duration: number): SrtSegment[] => {
  if (!subs.length) return [];
  const result: SrtSegment[] = [];
  let last = 0;
  for (const seg of subs) {
    if (seg.start > last) result.push({ start: last, end: seg.start, duration: seg.start - last });
    last = Math.max(last, seg.end);
  }
  if (last < duration) result.push({ start: last, end: duration, duration: duration - last });
  return result;
};

const DEFAULT_PRESETS: Record<string, RoiPreset> = {
  '【对话】': { name: '【对话】', x_ratio: 0, y_ratio: 0.8275, w_ratio: 0.54, h_ratio: 0.160625, description: 'X=0, Y=1324, 宽度=864, 高度=257', isDefault: true, category: 'dialogue' },
  '【地点】': { name: '【地点】', x_ratio: 0.446875, y_ratio: 0.23625, w_ratio: 0.06125, h_ratio: 0.345625, description: 'X=715, Y=378, 宽度=98, 高度=553', isDefault: false, category: 'location' },
};

const loadPresets = (): RoiPreset[] => {
  try {
    const saved = localStorage.getItem('roi_presets');
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, RoiPreset>;
      return Object.values({ ...DEFAULT_PRESETS, ...parsed });
    }
  } catch { /* ignore */ }
  return Object.values(DEFAULT_PRESETS);
};

// ─── 子组件：SRT 分析面板 ──────────────────────────────────────────────────────

const SrtAnalysis: React.FC<{ srtData: SrtData; localParams: ExtractionParams }> = ({ srtData, localParams }) => {
  const [open, setOpen] = useState(false);
  const { startTime, endTime } = localParams;

  const filteredSubs = srtData.subtitle_segments.filter(s => s.end > startTime && s.start < endTime);
  const filteredNonSubs = srtData.non_subtitle_segments.filter(s => s.end > startTime && s.start < endTime);
  const validNonSubs = filteredNonSubs.filter(s => s.duration >= (localParams.minSrtGapDuration || 0));
  const skippedNonSubs = filteredNonSubs.filter(s => s.duration < (localParams.minSrtGapDuration || 0));
  const totalDuration = filteredSubs.reduce((sum, s) => sum + (Math.min(s.end, endTime) - Math.max(s.start, startTime)), 0);
  const captureCount = localParams.skipSubtitleRegions ? 0 : filteredSubs.length;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-3 py-2.5 flex items-center justify-between text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2"><span className="text-gray-400">≡</span> 字幕时间段分析</span>
        <span className="text-xs text-gray-400">{open ? '收起' : '展开'}</span>
      </button>

      {open && (
        <div className="p-3 space-y-3 border-t border-gray-100">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-cyan-50 rounded-lg p-2.5 text-center border border-cyan-200">
              <div className="text-lg font-bold text-cyan-700">{totalDuration.toFixed(1)}s</div>
              <div className="text-[10px] text-cyan-600 mt-0.5">有字幕总时长</div>
            </div>
            <div className={`rounded-lg p-2.5 text-center border ${localParams.skipSubtitleRegions ? 'bg-gray-50 border-gray-200' : 'bg-green-50 border-green-200'}`}>
              <div className={`text-lg font-bold ${localParams.skipSubtitleRegions ? 'text-gray-400 line-through' : 'text-green-700'}`}>{captureCount}</div>
              <div className={`text-[10px] mt-0.5 ${localParams.skipSubtitleRegions ? 'text-gray-400' : 'text-green-600'}`}>
                有字幕时间段{localParams.skipSubtitleRegions && <span className="block text-red-600 font-bold">已跳过</span>}
              </div>
            </div>
            <div className="bg-amber-50 rounded-lg p-2.5 text-center border border-amber-200">
              <div className="text-lg font-bold text-amber-700">{validNonSubs.length}<span className="text-xs ml-1 text-amber-500">(跳过{skippedNonSubs.length})</span></div>
              <div className="text-[10px] text-amber-600 mt-0.5">无字幕时间段</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <CheckCircle2 className={`w-3.5 h-3.5 ${localParams.skipSubtitleRegions ? 'text-gray-400' : 'text-green-600'}`} />
                <span className={`text-xs font-medium ${localParams.skipSubtitleRegions ? 'text-gray-400' : 'text-gray-700'}`}>
                  有字幕时间段{localParams.skipSubtitleRegions && <span className="ml-1 text-red-600">(已跳过)</span>}
                </span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 bg-gray-50 rounded-lg p-2 border border-gray-200">
                {filteredSubs.slice(0, 10).map((seg, i) => (
                  <div key={i} className={`text-[10px] rounded px-2 py-1 border ${localParams.skipSubtitleRegions ? 'text-gray-400 bg-gray-100 border-gray-200 line-through' : 'text-gray-700 bg-white border-gray-100'}`}>
                    <strong>{i + 1}.</strong> {formatTime(seg.start)} – {formatTime(seg.end)} <span className="text-gray-400">({seg.duration.toFixed(1)}s)</span>
                  </div>
                ))}
                {filteredSubs.length > 10 && <div className="text-[10px] text-gray-400 text-center py-1">…还有 {filteredSubs.length - 10} 个</div>}
                {filteredSubs.length === 0 && <div className="text-[10px] text-gray-400 text-center py-2">范围内无字幕时间段</div>}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-medium text-gray-700">无字幕时间段</span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 bg-gray-50 rounded-lg p-2 border border-gray-200">
                {validNonSubs.slice(0, 10).map((seg, i) => (
                  <div key={i} className="text-[10px] text-gray-700 bg-white rounded px-2 py-1 border border-gray-100 flex items-center justify-between">
                    <span><strong>{i + 1}.</strong> {formatTime(seg.start)} – {formatTime(seg.end)} <span className="text-gray-400">({seg.duration.toFixed(1)}s)</span></span>
                    <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium ml-1 shrink-0">将截取</span>
                  </div>
                ))}
                {validNonSubs.length > 10 && <div className="text-[10px] text-gray-400 text-center py-1">…还有 {validNonSubs.length - 10} 个</div>}
                {validNonSubs.length === 0 && <div className="text-[10px] text-gray-400 text-center py-2">范围内无符合条件的无字幕时间段</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 子组件：进度条 ────────────────────────────────────────────────────────────

const ProgressBars: React.FC<{ progress: NonNullable<ParamSetterProps['progress']> }> = ({ progress }) => (
  <div className="space-y-3">
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600 font-medium">{progress.stage === 'extracting' ? progress.message : '截取完成！'}</span>
        <span className="text-indigo-600 font-bold">{progress.stage === 'extracting' ? `${progress.current}%` : '100%'}</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
        <div className="h-full bg-indigo-600 transition-all duration-300 ease-out" style={{ width: `${progress.stage === 'extracting' ? progress.current : 100}%` }} />
      </div>
    </div>
    {progress.stage === 'deduplicating' && (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-purple-700 font-medium flex items-center gap-1.5">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {progress.message}
          </span>
          <span className="text-purple-600 font-bold">{progress.current}%</span>
        </div>
        <div className="h-2.5 bg-purple-100 rounded-full overflow-hidden border border-purple-200">
          <div className="h-full bg-purple-600 transition-all duration-300 ease-out" style={{ width: `${progress.current}%` }} />
        </div>
      </div>
    )}
  </div>
);

// ─── 主组件 ───────────────────────────────────────────────────────────────────

const ParamSetter: React.FC<ParamSetterProps> = ({
  video,
  params,
  onConfirm,
  hasExistingFrames = false,
  isProcessing = false,
  progress,
  onPresetSelect,
}) => {
  const notifier = useNotifier();

  const initGroup = params.selectedGroup || 'group1';
  const [localParams, setLocalParams] = useState<ExtractionParams>({
    ...params,
    mode: ExtractionMode.SRT,
    selectedGroup: initGroup,
    skipSubtitleRegions: initGroup === 'group2',
    autoDeduplication: initGroup === 'group2',
  });
  const [srtData, setSrtData] = useState<SrtData | null>(null);
  const [isParsingSrt, setIsParsingSrt] = useState(false);
  const [presets] = useState<RoiPreset[]>(loadPresets);

  // 同步外部 startTime / endTime
  useEffect(() => {
    setLocalParams(prev => ({ ...prev, startTime: params.startTime, endTime: params.endTime }));
  }, [params.startTime, params.endTime]);

  const switchGroup = (group: 'group1' | 'group2') => {
    setLocalParams(p => ({
      ...p,
      selectedGroup: group,
      skipSubtitleRegions: group === 'group2',
      autoDeduplication: group === 'group2',
    }));
  };

  const handleSrtUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingSrt(true);
    setSrtData(null);
    setLocalParams(prev => ({ ...prev, srtFile: file }));
    try {
      const text = await file.text();
      const subtitle_segments = parseSrtToSegments(text);
      const non_subtitle_segments = calculateNonSubtitleSegments(subtitle_segments, video.duration);
      setSrtData({ subtitle_segments, non_subtitle_segments });
      notifier.addToast(`成功解析字幕，包含 ${subtitle_segments.length} 条字幕`, 'success');
    } catch {
      notifier.addToast('SRT 文件解析失败，请检查文件格式。', 'error');
    } finally {
      setIsParsingSrt(false);
    }
  };

  const handleClearSrt = () => {
    setLocalParams(prev => ({ ...prev, srtFile: undefined }));
    setSrtData(null);
    notifier.addToast('已清空 SRT 文件', 'success');
  };

  const isGroup1 = localParams.selectedGroup === 'group1';
  const currentCategory = isGroup1 ? 'dialogue' : 'location';
  const groupPresets = presets.filter(p =>
    p.category === currentCategory ||
    (currentCategory === 'dialogue' && p.name.includes('对话')) ||
    (currentCategory === 'location' && p.name.includes('地点'))
  );

  return (
    <div className="flex flex-col gap-4">

      {/* ── 顶部：分组 + 预设 ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {/* 分组按钮 */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-gray-600 whitespace-nowrap mr-1">保存分组：</span>
            <button
              onClick={() => switchGroup('group1')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                isGroup1 ? 'bg-blue-500 text-white shadow-sm' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${isGroup1 ? 'bg-white text-blue-500' : 'bg-blue-200 text-blue-700'}`}>1</span>
              【对话】
            </button>
            <button
              onClick={() => switchGroup('group2')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                !isGroup1 ? 'bg-green-500 text-white shadow-sm' : 'bg-green-50 text-green-700 hover:bg-green-100'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${!isGroup1 ? 'bg-white text-green-500' : 'bg-green-200 text-green-700'}`}>2</span>
              【地点】
            </button>
          </div>

          {/* 预设选择 */}
          {groupPresets.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400 whitespace-nowrap">截取区域：</span>
              {groupPresets.map(p => (
                <button
                  key={p.name}
                  onClick={() => onPresetSelect?.(p)}
                  title={p.description}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isGroup1
                      ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300'
                      : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-300'
                  }`}
                >
                  {p.isDefault && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isGroup1 ? 'bg-blue-500' : 'bg-green-500'}`} />}
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="text-xs text-gray-400 italic whitespace-nowrap">不同分组的结果会分开显示</span>
      </div>

      {/* ── 参数配置（无折叠，直接展示）── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">

        {/* SRT 上传 */}
        <div>
          <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5 mb-2">
            <FileText className="w-3.5 h-3.5" /> 上传 SRT 字幕文件（可选）
          </label>
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-3 hover:border-indigo-400 hover:bg-indigo-50/20 transition-colors cursor-pointer relative">
            <input type="file" accept=".srt" onChange={handleSrtUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" disabled={isParsingSrt} />
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-500">
                <Upload className="w-4 h-4" />
              </div>
              <div className="grow min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">
                  {isParsingSrt ? '解析中…' : (localParams.srtFile ? localParams.srtFile.name : '选择文件')}
                </p>
                <p className="text-xs text-gray-400">
                  {localParams.srtFile ? '支持标准 SRT 格式' : '未选择文件，默认全片无字幕'}
                </p>
              </div>
            </div>
          </div>
          {localParams.srtFile && (
            <button
              onClick={handleClearSrt}
              className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> 清空 SRT 文件
            </button>
          )}
        </div>

        {/* 两个 checkbox 横排 */}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-start gap-2.5 cursor-pointer border border-amber-200 bg-amber-50 rounded-lg p-3">
            <input
              type="checkbox"
              checked={localParams.skipSubtitleRegions || false}
              onChange={e => setLocalParams(p => ({ ...p, skipSubtitleRegions: e.target.checked }))}
              className="mt-0.5 w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-2 focus:ring-amber-500 shrink-0"
            />
            <div>
              <span className="text-sm font-medium text-amber-900">跳过包含字幕的区域</span>
              <p className="text-xs text-amber-700 mt-0.5">只截取无字幕时间段，忽略有字幕的区域</p>
            </div>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer border border-blue-200 bg-blue-50 rounded-lg p-3">
            <input
              type="checkbox"
              checked={localParams.autoDeduplication !== false}
              onChange={e => setLocalParams(p => ({ ...p, autoDeduplication: e.target.checked }))}
              className="mt-0.5 w-4 h-4 text-blue-600 border-blue-300 rounded focus:ring-2 focus:ring-blue-500 shrink-0"
            />
            <div>
              <span className="text-sm font-medium text-blue-900">截取完成后自动去重</span>
              <p className="text-xs text-blue-700 mt-0.5">自动去除重复图片（16线程并行，去重到无法再去重）</p>
            </div>
          </label>
        </div>

        {/* SRT 分析（有 SRT 时才显示） */}
        {srtData && <SrtAnalysis srtData={srtData} localParams={localParams} />}
      </div>

      {/* ── 底部操作栏 ── */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <span className="text-xs text-gray-400 italic">* 实际截取数量可能因视频帧率略有偏差</span>
        <div className="flex items-center gap-2">
          {!hasExistingFrames ? (
            <button
              onClick={() => onConfirm(localParams, false)}
              disabled={isProcessing}
              className="px-7 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4 fill-current" />
              {isProcessing ? '处理中…' : '开始截取任务'}
            </button>
          ) : (
            <>
              <button
                onClick={() => onConfirm(localParams, true)}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-md shadow-green-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4 fill-current" />
                {isProcessing ? '处理中…' : '追加截取'}
              </button>
              <button
                onClick={() => onConfirm(localParams, false)}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-md shadow-red-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4" />
                {isProcessing ? '处理中…' : '重新截取'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 进度条 */}
      {isProcessing && progress && <ProgressBars progress={progress} />}
    </div>
  );
};

export default ParamSetter;
