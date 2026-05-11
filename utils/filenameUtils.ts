// 文件名工具函数

/**
 * 将秒数转换为智能时间戳文件名格式
 * 格式: [HH:MM:SS.mmm] (时:分:秒.毫秒)
 * 
 * @param seconds - 时间（秒）
 * @returns 格式化的文件名时间戳，例如 "[00:00:05.123]" 表示 5.123 秒
 * 
 * @example
 * formatTimestampFilename(5.123) // "[00:00:05.123]"
 * formatTimestampFilename(65.456) // "[00:01:05.456]"
 * formatTimestampFilename(3665.789) // "[01:01:05.789]"
 */
export const formatTimestampFilename = (seconds: number): string => {
  const totalMilliseconds = Math.floor(seconds * 1000);
  const milliseconds = totalMilliseconds % 1000;
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  const HH = hours.toString().padStart(2, '0');
  const MM = minutes.toString().padStart(2, '0');
  const SS = secs.toString().padStart(2, '0');
  const mmm = milliseconds.toString().padStart(3, '0');
  
  return `[${HH}:${MM}:${SS}.${mmm}]`;
};

/**
 * 从时间戳文件名解析出秒数
 * 
 * @param filename - 文件名，格式为 [HH:MM:SS.mmm].ext
 * @returns 时间（秒），如果解析失败返回 null
 * 
 * @example
 * parseTimestampFilename("[00:00:05.123].jpg") // 5.123
 * parseTimestampFilename("[00:01:05.456].jpg") // 65.456
 * parseTimestampFilename("[01:01:05.789].jpg") // 3665.789
 */
export const parseTimestampFilename = (filename: string): number | null => {
  // 移除扩展名
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
  
  // 匹配格式 [HH:MM:SS.mmm]
  const match = nameWithoutExt.match(/\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\]/);
  
  if (!match) {
    return null;
  }
  
  const [, hours, minutes, seconds, milliseconds] = match;
  
  const totalSeconds = 
    parseInt(hours, 10) * 3600 +
    parseInt(minutes, 10) * 60 +
    parseInt(seconds, 10) +
    parseInt(milliseconds, 10) / 1000;
  
  return totalSeconds;
};

/**
 * 生成完整的文件名
 * 
 * @param seconds - 时间（秒）
 * @param prefix - 文件名前缀（可选）
 * @param extension - 文件扩展名（默认 'jpg'）
 * @param group - 分组标识（可选）
 * @returns 完整的文件名
 * 
 * @example
 * generateFilename(5.123) // "[00:00:05.123].jpg"
 * generateFilename(5.123, "v") // "v_[00:00:05.123].jpg"
 * generateFilename(5.123, "subtitle", "png") // "subtitle_[00:00:05.123].png"
 * generateFilename(5.123, "sub", "jpg", "group1") // "g1_sub_[00:00:05.123].jpg" (【对话】)
 * generateFilename(5.123, "nosub", "jpg", "group2") // "g2_nosub_[00:00:05.123].jpg" (【地点】)
 */
export const generateFilename = (
  seconds: number,
  prefix?: string,
  extension: string = 'jpg',
  group?: 'group1' | 'group2'
): string => {
  const timestamp = formatTimestampFilename(seconds);
  
  // 构建文件名前缀
  const parts: string[] = [];
  
  // 添加分组前缀
  if (group) {
    const groupPrefix = group.replace('group', 'g'); // group1 -> g1
    parts.push(groupPrefix);
  }
  
  // 添加自定义前缀
  if (prefix) {
    parts.push(prefix);
  }
  
  // 添加时间戳
  parts.push(timestamp);
  
  return `${parts.join('_')}.${extension}`;
};

/**
 * 格式化时间戳为可读格式（用于显示）
 * 格式: HH:MM:SS.mmm
 * 
 * @param seconds - 时间（秒）
 * @returns 格式化的时间字符串
 * 
 * @example
 * formatTimestampDisplay(5.123) // "00:00:05.123"
 * formatTimestampDisplay(65.456) // "00:01:05.456"
 * formatTimestampDisplay(3665.789) // "01:01:05.789"
 */
export const formatTimestampDisplay = (seconds: number): string => {
  const totalMilliseconds = Math.floor(seconds * 1000);
  const milliseconds = totalMilliseconds % 1000;
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  const HH = hours.toString().padStart(2, '0');
  const MM = minutes.toString().padStart(2, '0');
  const SS = secs.toString().padStart(2, '0');
  const mmm = milliseconds.toString().padStart(3, '0');
  
  return `${HH}:${MM}:${SS}.${mmm}`;
};

/**
 * 更新文件名中的分组前缀
 * 
 * @param filename - 原始文件名
 * @param newGroup - 新的分组标识
 * @returns 更新后的文件名
 * 
 * @example
 * updateFilenameGroup("g1_sub_[00:00:05.123].jpg", "group2") // "g2_sub_[00:00:05.123].jpg" (【对话】→【地点】)
 * updateFilenameGroup("g2_nosub_[00:00:05.123].jpg", "group1") // "g1_nosub_[00:00:05.123].jpg" (【地点】→【对话】)
 * updateFilenameGroup("v_[00:00:05.123].jpg", "group1") // "g1_v_[00:00:05.123].jpg"
 * updateFilenameGroup("[00:00:05.123].jpg", "group2") // "g2_[00:00:05.123].jpg"
 */
export const updateFilenameGroup = (
  filename: string,
  newGroup: 'group1' | 'group2'
): string => {
  const newGroupPrefix = newGroup.replace('group', 'g'); // group1 -> g1
  
  // 匹配现有的分组前缀 (g1_, g2_)
  const groupPrefixPattern = /^g[12]_/;
  
  if (groupPrefixPattern.test(filename)) {
    // 如果已有分组前缀，替换它
    return filename.replace(groupPrefixPattern, `${newGroupPrefix}_`);
  } else {
    // 如果没有分组前缀，添加到开头
    return `${newGroupPrefix}_${filename}`;
  }
};
