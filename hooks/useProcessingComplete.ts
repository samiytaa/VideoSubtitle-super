import { useCallback } from 'react';
import { ExtractedFrame, ExtractionMode, ExtractionParams } from '../types';
import { Notifier } from '../components/Notifications';

type CaptureGroup = 'group1' | 'group2';

interface NextStepInfo {
  preset: any;
  srtFile: File | null;
  frameInterval?: number;
  timeRange: { startTime: number; endTime: number };
  isBothMode: boolean;
  autoDeduplicationLocation: boolean;
  autoDeduplicationDialogue: boolean;
  skipSubtitleLocation?: boolean;
}

interface UseProcessingCompleteOptions {
  params: ExtractionParams;
  nextStepInfoRef: React.MutableRefObject<NextStepInfo | null>;
  pendingDeduplication: { dialogue: boolean; location: boolean } | null;
  notifier: Notifier;
  onAddFrames: (frames: ExtractedFrame[]) => void;
  onUpdateProgress: (progress: any) => void;
  onSetRoi: (roi: { x: number; y: number; width: number; height: number }) => void;
  onParamsSet: (params: ExtractionParams, skipNotification: boolean) => void;
  onUpdateNextStepInfo: (info: NextStepInfo | null) => void;
  onSetPendingDeduplication: (pending: { dialogue: boolean; location: boolean } | null) => void;
  onPerformDeduplication: (group: CaptureGroup, label: string) => Promise<void>;
  onCompleteProcessing: () => void;
  onScrollToResult: () => void;
}

function presetToRoi(preset: any) {
  return {
    x: preset.x_ratio * 100,
    y: preset.y_ratio * 100,
    width: preset.w_ratio * 100,
    height: preset.h_ratio * 100,
  };
}

function waitForUi(ms: number = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildExtractionParams(options: {
  baseParams: ExtractionParams;
  srtFile: File | null;
  timeRange: { startTime: number; endTime: number };
  frameInterval?: number;
  group: CaptureGroup;
  skipSubtitle: boolean;
  autoDeduplication: boolean;
}): ExtractionParams {
  const { baseParams, srtFile, timeRange, frameInterval, group, skipSubtitle, autoDeduplication } =
    options;

  if (srtFile) {
    return {
      ...baseParams,
      mode: ExtractionMode.SRT,
      srtFile,
      startTime: timeRange.startTime,
      endTime: timeRange.endTime,
      selectedGroup: group,
      skipSubtitleRegions: skipSubtitle,
      autoDeduplication,
    };
  }

  return {
    ...baseParams,
    mode: ExtractionMode.FRAME,
    srtFile: undefined,
    interval: frameInterval ?? 30,
    startTime: timeRange.startTime,
    endTime: timeRange.endTime,
    selectedGroup: group,
    skipSubtitleRegions: false,
    autoDeduplication,
  };
}

export function useProcessingComplete(options: UseProcessingCompleteOptions) {
  const {
    params,
    nextStepInfoRef,
    pendingDeduplication,
    notifier,
    onAddFrames,
    onUpdateProgress,
    onSetRoi,
    onParamsSet,
    onUpdateNextStepInfo,
    onSetPendingDeduplication,
    onPerformDeduplication,
    onCompleteProcessing,
    onScrollToResult,
  } = options;

  const handleProcessingComplete = useCallback(
    async (results: ExtractedFrame[]) => {
      onAddFrames(results);

      onUpdateProgress({
        current: 100,
        total: 100,
        message: '截取完成！',
        stage: 'extracting',
      });

      const currentNextStepInfo = nextStepInfoRef.current;
      if (currentNextStepInfo && currentNextStepInfo.preset) {
        notifier.addToast('对话截取完成，开始截取地点...', 'info');

        const locationPreset = currentNextStepInfo.preset;
        onSetRoi(presetToRoi(locationPreset));
        await waitForUi();

        const locationParams = buildExtractionParams({
          baseParams: params,
          srtFile: currentNextStepInfo.srtFile,
          timeRange: currentNextStepInfo.timeRange,
          frameInterval: currentNextStepInfo.frameInterval,
          group: 'group2',
          skipSubtitle: currentNextStepInfo.skipSubtitleLocation ?? true,
          autoDeduplication: false,
        });

        const savedDeduplicationConfig = {
          dialogue: currentNextStepInfo.autoDeduplicationDialogue || false,
          location: currentNextStepInfo.autoDeduplicationLocation || false,
        };

        onUpdateNextStepInfo(null);
        onSetPendingDeduplication(savedDeduplicationConfig);

        onParamsSet(locationParams, true);
        return;
      }

      const pendingDedup = pendingDeduplication;
      if (pendingDedup) {
        onSetPendingDeduplication(null);

        if (pendingDedup.dialogue) {
          await onPerformDeduplication('group1', '【对话】');
        }

        if (pendingDedup.location) {
          await onPerformDeduplication('group2', '【地点】');
        }
      } else if (
        params.mode === ExtractionMode.SRT &&
        params.selectedGroup &&
        params.autoDeduplication !== false
      ) {
        const targetGroup = params.selectedGroup;
        const groupLabel = targetGroup === 'group1' ? '【对话】' : '【地点】';

        await onPerformDeduplication(targetGroup, groupLabel);
      }

      onCompleteProcessing();
      onScrollToResult();
    },
    [
      params,
      nextStepInfoRef,
      pendingDeduplication,
      notifier,
      onAddFrames,
      onUpdateProgress,
      onSetRoi,
      onParamsSet,
      onUpdateNextStepInfo,
      onSetPendingDeduplication,
      onPerformDeduplication,
      onCompleteProcessing,
      onScrollToResult,
    ]
  );

  return { handleProcessingComplete };
}
