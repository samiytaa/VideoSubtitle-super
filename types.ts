
export interface VideoFile {
  id: string;
  file: File;
  localPath?: string;
  name: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  previewUrl: string;
}

export interface ROI {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoiPreset {
  name: string;
  x_ratio: number;
  y_ratio: number;
  w_ratio: number;
  h_ratio: number;
  description: string;
  isDefault: boolean;
  category?: 'dialogue' | 'location'; // 预设分类：对话或地点
}

export enum ExtractionMode {
  TIME = 'time',
  FRAME = 'frame',
  SRT = 'srt'
}

export interface ExtractionParams {
  mode: ExtractionMode;
  interval: number;
  startTime: number;
  endTime: number;
  maxFrames: number;
  clearFolder: boolean;
  prefix: string;
  srtFile?: File;
  // SRT specific params
  framesBeforeEnd?: number;
  minSrtGapDuration?: number;
  srtNonSubtitleInterval?: number;
  srtNonSubtitleFrameInterval?: number; // 新增：无字幕时段按帧数截取的间隔
  selectedGroup?: 'group1' | 'group2'; // 选择的分组
  skipSubtitleRegions?: boolean; // 新增：跳过包含字幕的区域
  autoDeduplication?: boolean; // 新增：是否自动去重
}

export interface ProgressData {
  current: number;
  total: number;
  status: 'idle' | 'processing' | 'done' | 'error';
  message: string;
  currentVideo: string;
  videoIndex: number;
  videoTotal: number;
}

export interface ExtractedFrame {
  id: string;
  url: string;
  timestamp: string;
  filename: string;
  videoName: string;
  group?: 'group1' | 'group2'; // 分组标识：group1=【对话】, group2=【地点】
  requestedTime?: number; // 计划截图时间（秒）
  capturedTime?: number; // 实际落点时间（秒）
  driftMs?: number; // 实际落点与计划时间偏差（毫秒）
}

export interface MergedImage {
  id: string;
  url: string;
  width: number;
  height: number;
  filename: string;
}
