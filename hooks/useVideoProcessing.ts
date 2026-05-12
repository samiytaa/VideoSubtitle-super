import { useCallback, useRef, useState } from 'react';
import { ExtractionMode, ExtractionParams, ROI, RoiPreset, VideoFile } from '../types';
import { useObjectURL } from './useObjectURL';

interface ProcessingProgress {
  current: number;
  total: number;
  message: string;
  stage?: 'extracting' | 'deduplicating';
}

interface NextStepInfo {
  preset: RoiPreset;
  srtFile: File | null;
  frameInterval?: number;
  timeRange: { startTime: number; endTime: number };
  isBothMode: boolean;
  autoDeduplicationLocation: boolean;
  autoDeduplicationDialogue: boolean;
  skipSubtitleLocation?: boolean;
}

export const useVideoProcessing = () => {
  const [activeVideo, setActiveVideo] = useState<VideoFile | null>(null);
  const videoSrc = useObjectURL(activeVideo?.file ?? null);
  const [roi, setRoi] = useState<ROI>({ x: 10, y: 80, width: 80, height: 15 });
  const [params, setParams] = useState<ExtractionParams>({
    mode: ExtractionMode.SRT,
    interval: 1.0,
    startTime: 0,
    endTime: 0,
    maxFrames: 500,
    clearFolder: true,
    prefix: 'v',
    minSrtGapDuration: 1.5,
    framesBeforeEnd: 5,
    srtNonSubtitleInterval: 0.5,
    srtNonSubtitleFrameInterval: 15,
    skipSubtitleRegions: false,
    autoDeduplication: true,
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress>({
    current: 0,
    total: 100,
    message: '',
    stage: 'extracting',
  });
  const [processingKey, setProcessingKey] = useState(0);
  const [nextStepInfo, setNextStepInfo] = useState<NextStepInfo | null>(null);
  const nextStepInfoRef = useRef<NextStepInfo | null>(null);

  const handleRoiSet = useCallback(
    (
      newRoi: ROI,
      timeRange?: { startTime: number; endTime: number },
      skipSubtitleRegions?: boolean
    ) => {
      setRoi(newRoi);
      if (timeRange) {
        setParams((prev) => ({
          ...prev,
          startTime: timeRange.startTime,
          endTime: timeRange.endTime,
          ...(skipSubtitleRegions !== undefined && { skipSubtitleRegions }),
        }));
      }
    },
    []
  );

  const handleParamsSet = useCallback(
    (newParams: ExtractionParams, appendMode: boolean = false) => {
      setParams(newParams);
      setIsProcessing(true);
      setIsCompleted(false);
      setProcessingProgress({
        current: 0,
        total: 100,
        message: '准备开始...',
        stage: 'extracting',
      });
      setProcessingKey((prev) => prev + 1);
      return appendMode;
    },
    []
  );

  const handleProcessingProgress = useCallback(
    (progress: { current: number; total: number; message: string }) => {
      let enhancedMessage = progress.message;
      if (params.selectedGroup === 'group1') {
        enhancedMessage = progress.message.includes('对话')
          ? progress.message
          : `截取对话 - ${progress.message}`;
      } else if (params.selectedGroup === 'group2') {
        enhancedMessage = progress.message.includes('地点')
          ? progress.message
          : `截取地点 - ${progress.message}`;
      }
      setProcessingProgress({ ...progress, message: enhancedMessage, stage: 'extracting' });
    },
    [params.selectedGroup]
  );

  const updateProcessingProgress = useCallback((progress: ProcessingProgress) => {
    setProcessingProgress(progress);
  }, []);

  const completeProcessing = useCallback(() => {
    setIsProcessing(false);
    setIsCompleted(true);
    setProcessingProgress({ current: 0, total: 0, message: '', stage: 'extracting' });
  }, []);

  const updateNextStepInfo = useCallback((info: NextStepInfo | null) => {
    setNextStepInfo(info);
    nextStepInfoRef.current = info;
  }, []);

  return {
    // State
    activeVideo,
    videoSrc,
    roi,
    params,
    isProcessing,
    isCompleted,
    processingProgress,
    processingKey,
    nextStepInfo,
    nextStepInfoRef,

    // Setters
    setActiveVideo,
    setRoi,
    setParams,
    setIsProcessing,
    setIsCompleted,

    // Handlers
    handleRoiSet,
    handleParamsSet,
    handleProcessingProgress,
    updateProcessingProgress,
    completeProcessing,
    updateNextStepInfo,
  };
};
