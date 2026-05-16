import { useCallback } from 'react';
import { ExtractionMode, ExtractionParams, RoiPreset, VideoFile } from '../types';
import { Notifier } from '../components/Notifications';
import { confirmDelete } from '../utils/confirmActions';

type QuickProcessType = 'dialogue' | 'location' | 'both';
type CaptureGroup = 'group1' | 'group2';

export interface QuickProcessOptions {
  srtFile: File | null;
  dialoguePreset: RoiPreset | null;
  locationPreset: RoiPreset | null;
  timeRange: { startTime: number; endTime: number };
  captureType: QuickProcessType;
  autoDeduplicationDialogue: boolean;
  autoDeduplicationLocation: boolean;
  frameInterval?: number;
  skipSubtitleDialogue?: boolean;
  skipSubtitleLocation?: boolean;
}

interface BuildExtractionParamsOptions {
  baseParams: ExtractionParams;
  srtFile: File | null;
  timeRange: { startTime: number; endTime: number };
  frameInterval?: number;
  group: CaptureGroup;
  skipSubtitle: boolean;
  autoDeduplication: boolean;
}

function presetToRoi(preset: RoiPreset) {
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

function buildExtractionParams(options: BuildExtractionParamsOptions): ExtractionParams {
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

function getSkipSubtitleRegions(
  category: 'dialogue' | 'location',
  srtFile: File | null,
  options: QuickProcessOptions
): boolean {
  if (!srtFile) return false;
  if (category === 'dialogue') return options.skipSubtitleDialogue ?? false;
  return options.skipSubtitleLocation ?? true;
}

interface UseQuickProcessOptions {
  activeVideo: VideoFile | null;
  extractedFramesCount: number;
  params: ExtractionParams;
  notifier: Notifier;
  onClearFrames: () => void;
  onSetRoi: (roi: { x: number; y: number; width: number; height: number }) => void;
  onParamsSet: (params: ExtractionParams, skipNotification: boolean) => void;
  onUpdateNextStepInfo: (info: any) => void;
}

export function useQuickProcess(options: UseQuickProcessOptions) {
  const {
    activeVideo,
    extractedFramesCount,
    params,
    notifier,
    onClearFrames,
    onSetRoi,
    onParamsSet,
    onUpdateNextStepInfo,
  } = options;

  const handleQuickProcess = useCallback(
    async (processOptions: QuickProcessOptions) => {
      if (!activeVideo) {
        notifier.addToast('请先上传视频，再使用一键处理功能', 'warning');
        return;
      }

      const {
        srtFile,
        dialoguePreset,
        locationPreset,
        timeRange,
        captureType,
        autoDeduplicationDialogue,
        autoDeduplicationLocation,
        frameInterval,
        skipSubtitleDialogue,
        skipSubtitleLocation,
      } = processOptions;
      const useSrt = !!srtFile;

      if (extractedFramesCount > 0) {
        const shouldClear = await confirmDelete(extractedFramesCount, '截取', notifier);

        if (shouldClear) {
          onClearFrames();
          await waitForUi();
        } else {
          return;
        }
      }

      if (captureType === 'both') {
        notifier.addToast(
          `一键处理：先对话，再地点${useSrt ? '' : '（固定帧间隔）'}`,
          'info'
        );

        if (locationPreset) {
          const nextInfo = {
            preset: locationPreset,
            srtFile,
            frameInterval,
            timeRange,
            isBothMode: true,
            autoDeduplicationLocation,
            autoDeduplicationDialogue,
            skipSubtitleLocation: skipSubtitleLocation ?? true,
          };
          onUpdateNextStepInfo(nextInfo);
        }

        if (dialoguePreset) {
          onSetRoi(presetToRoi(dialoguePreset));
          await waitForUi();
          onParamsSet(
            buildExtractionParams({
              baseParams: params,
              srtFile,
              timeRange,
              frameInterval,
              group: 'group1',
              skipSubtitle: skipSubtitleDialogue ?? false,
              autoDeduplication: false,
            }),
            false
          );
          notifier.addToast('正在处理对话截图...', 'info');
        }
      } else {
        onUpdateNextStepInfo(null);

        const preset = captureType === 'dialogue' ? dialoguePreset : locationPreset;
        if (!preset) return;

        const category = captureType === 'dialogue' ? 'dialogue' : 'location';
        const group = captureType === 'dialogue' ? 'group1' : 'group2';
        const autoDedup =
          category === 'dialogue' ? autoDeduplicationDialogue : autoDeduplicationLocation;

        onSetRoi(presetToRoi(preset));
        await waitForUi();
        onParamsSet(
          buildExtractionParams({
            baseParams: params,
            srtFile,
            timeRange,
            frameInterval,
            group,
            skipSubtitle: getSkipSubtitleRegions(category, srtFile, processOptions),
            autoDeduplication: autoDedup,
          }),
          false
        );
        notifier.addToast(
          `已一键处理${category === 'dialogue' ? '对话' : '地点'}截图${useSrt ? '' : '（固定帧间隔）'}`,
          'success'
        );
      }
    },
    [
      activeVideo,
      extractedFramesCount,
      params,
      notifier,
      onClearFrames,
      onSetRoi,
      onParamsSet,
      onUpdateNextStepInfo,
    ]
  );

  return { handleQuickProcess };
}
