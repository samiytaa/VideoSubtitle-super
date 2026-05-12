import React from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Clock, Layers, ScanText, User, XCircle } from 'lucide-react';

export type OcrDebugRun = {
  at: string;
  account: string;
  imageCount: number;
  mode: 'single' | 'batch';
  ok: boolean;
  message: string;
  steps: string[];
};

type OcrDebugRunsPanelProps = {
  runs: OcrDebugRun[];
  expandedRuns: Record<number, boolean>;
  setExpandedRuns: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  onClear: () => void;
  accountLabel: string;
  imageCount: number;
  isBatch: boolean;
  className?: string;
};

const OcrDebugRunsPanel: React.FC<OcrDebugRunsPanelProps> = ({
  runs,
  expandedRuns,
  setExpandedRuns,
  onClear,
  accountLabel,
  imageCount,
  isBatch,
  className = ''
}) => {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white overflow-hidden ${className}`.trim()}>
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-1.5">
          <ScanText className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-xs font-semibold text-gray-700">调试信息</span>
          {runs.length > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-600">
              {runs.length}
            </span>
          )}
        </div>
        {runs.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
          >
            清空记录
          </button>
        )}
      </div>

      <div className="px-3 py-2 border-b border-gray-100 bg-linear-to-r from-indigo-50/60 to-transparent">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <User className="w-3 h-3 text-indigo-400" />
            <span className="text-[11px] text-gray-500">账号：</span>
            <span className="text-[11px] font-medium text-gray-700">{accountLabel}</span>
          </div>
          <div className="w-px h-3 bg-gray-200" />
          <div className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-indigo-400" />
            <span className="text-[11px] text-gray-500">图片：</span>
            <span className="text-[11px] font-medium text-gray-700">{imageCount} 张</span>
          </div>
          <div className="w-px h-3 bg-gray-200" />
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${isBatch ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'}`}>
            {isBatch ? '批量识别' : '单张识别'}
          </span>
        </div>
      </div>

      <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
        {runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-5 text-gray-400">
            <Clock className="w-5 h-5 mb-1.5 opacity-40" />
            <span className="text-xs">暂无识别记录</span>
          </div>
        ) : (
          runs.map((run, idx) => {
            const isExpanded = expandedRuns[idx] ?? false;
            const distSteps = run.steps.filter((s) => s.includes('识别') && s.includes('批'));
            const otherSteps = run.steps.filter((s) => !(s.includes('识别') && s.includes('批')));
            return (
              <div key={`${run.at}-${idx}`} className="bg-white">
                <button
                  type="button"
                  onClick={() => setExpandedRuns((prev) => ({ ...prev, [idx]: !isExpanded }))}
                  className="w-full flex items-start gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                >
                  {run.ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-medium text-gray-700 truncate">{run.account}</span>
                      <span className={`inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium ${run.mode === 'batch' ? 'bg-violet-100 text-violet-600' : 'bg-sky-100 text-sky-600'}`}>
                        {run.mode === 'batch' ? '批量' : '单张'} · {run.imageCount}张
                      </span>
                      <span className={`text-[10px] ${run.ok ? 'text-emerald-600' : 'text-red-500'}`}>{run.message}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5 text-gray-300" />
                      <span className="text-[10px] text-gray-400">{run.at}</span>
                    </div>
                  </div>
                  {run.steps?.length > 0 && (isExpanded ? <ChevronUp className="w-3 h-3 text-gray-400 shrink-0 mt-0.5" /> : <ChevronDown className="w-3 h-3 text-gray-400 shrink-0 mt-0.5" />)}
                </button>
                {isExpanded && run.steps?.length > 0 && (
                  <div className="px-3 pb-2.5 space-y-1">
                    {distSteps.length > 0 && (
                      <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-2.5 py-2 mb-1.5">
                        <div className="text-[10px] font-semibold text-indigo-500 mb-1">分发明细</div>
                        <div className="space-y-0.5">
                          {distSteps.map((step, si) => {
                            const content = step.replace(/^\[\d{1,2}:\d{2}:\d{2}\]\s*/, '');
                            return (
                              <div key={si} className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                                <span className="text-[11px] text-indigo-700 font-medium">{content}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="relative pl-3">
                      <div className="absolute left-1 top-1 bottom-1 w-px bg-gray-200" />
                      {otherSteps.map((step, si) => {
                        const timeMatch = step.match(/^\[(\d{1,2}:\d{2}:\d{2})\]\s*(.*)/);
                        const time = timeMatch?.[1] ?? '';
                        const content = timeMatch?.[2] ?? step;
                        const isError = content.includes('失败') || content.includes('错误');
                        const isSuccess = content.includes('成功') || content.includes('完成');
                        return (
                          <div key={si} className="flex items-start gap-2 mb-1 relative">
                            <div className={`absolute -left-2 top-1 w-2 h-2 rounded-full border-2 border-white shrink-0 ${isError ? 'bg-red-400' : isSuccess ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                            <div className="flex items-baseline gap-1.5 min-w-0">
                              {time && <span className="text-[10px] text-gray-400 shrink-0 font-mono">{time}</span>}
                              <span className={`text-[11px] leading-relaxed ${isError ? 'text-red-600' : isSuccess ? 'text-emerald-700' : 'text-gray-600'}`}>{content}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default OcrDebugRunsPanel;
