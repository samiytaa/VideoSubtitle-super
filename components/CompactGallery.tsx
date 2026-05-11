import React, { useState, useRef, useEffect } from 'react';
import { CheckSquare, Square, ExternalLink, Trash2, X, Upload, Image as ImageIcon, Video, Scissors } from 'lucide-react';
import { ExtractedFrame, VideoFile, ROI } from '../types';
import { useNotifier } from './Notifications';

interface CompactGalleryProps {
  frames: ExtractedFrame[];
  onDelete?: (ids: string[]) => void;
  onJumpToTime?: (timestamp: string) => void;
  activeVideo?: VideoFile | null;
  videoSrc?: string | null;
  sharedVideoRef?: React.MutableRefObject<HTMLVideoElement | null>;
  roi?: ROI | null;
  onCaptureFrame?: (frame: ExtractedFrame) => void;
}

const CompactGallery: React.FC<CompactGalleryProps> = ({ frames, onDelete, onJumpToTime, activeVideo, videoSrc, sharedVideoRef, roi, onCaptureFrame }) => {
  const [panelTab, setPanelTab] = useState<'images' | 'video'>('images');
  const videoRef = useRef<HTMLVideoElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0); // 记忆最后的播放时间点

  // 截取当前帧（按 roi 裁切）
  const handleCaptureFrame = () => {
    const video = videoRef.current;
    if (!video || !activeVideo || !onCaptureFrame) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    // 读取最新 cropBox
    let cr = { x_ratio: 0, y_ratio: 0, w_ratio: 1, h_ratio: 1 };
    try {
      const saved = sessionStorage.getItem(`video_state_${activeVideo.id}`);
      if (saved) {
        const state = JSON.parse(saved);
        if (state.cropBox) {
          const cb = state.cropBox;
          cr = { x_ratio: cb.x / 100, y_ratio: cb.y / 100, w_ratio: cb.width / 100, h_ratio: cb.height / 100 };
        }
      }
    } catch { /* ignore */ }
    if (roi) {
      cr = { x_ratio: roi.x / 100, y_ratio: roi.y / 100, w_ratio: roi.width / 100, h_ratio: roi.height / 100 };
    }
    const sx = Math.round(cr.x_ratio * vw);
    const sy = Math.round(cr.y_ratio * vh);
    const sw = Math.round(cr.w_ratio * vw);
    const sh = Math.round(cr.h_ratio * vh);
    if (sw <= 0 || sh <= 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    const url = canvas.toDataURL('image/jpeg', 0.92);
    // 格式化时间戳
    const t = video.currentTime;
    const h = Math.floor(t / 3600).toString().padStart(2, '0');
    const m = Math.floor((t % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(t % 60).toString().padStart(2, '0');
    const ms = Math.round((t % 1) * 1000).toString().padStart(3, '0');
    const timestamp = `${h}:${m}:${s}.${ms}`;
    const filename = `manual_[${h}:${m}:${s}.${ms}].jpg`;
    onCaptureFrame({
      id: `manual_${Date.now()}`,
      url,
      timestamp,
      filename,
      videoName: activeVideo.name,
      group: 'group1',
    });
    notifier.addToast(`已截取 ${timestamp}`, 'success');
  };

  // 双向时间同步：切换到视频tab时从 sharedVideoRef 拉取时间，离开时推回去
  useEffect(() => {
    if (panelTab !== 'video') {
      // 离开视频tab：记忆本地时间，并推回 sharedVideoRef
      const local = videoRef.current;
      if (local) {
        lastTimeRef.current = local.currentTime;
        if (sharedVideoRef?.current && Math.abs(sharedVideoRef.current.currentTime - local.currentTime) > 0.1) {
          sharedVideoRef.current.currentTime = local.currentTime;
        }
      }
      return;
    }
    // 进入视频tab：优先用 sharedVideoRef 的时间，其次用记忆的时间
    const local = videoRef.current;
    if (!local) return;
    const sharedTime = sharedVideoRef?.current?.currentTime;
    const targetTime = sharedTime !== undefined ? sharedTime : lastTimeRef.current;
    if (Math.abs(local.currentTime - targetTime) > 0.1) {
      local.currentTime = targetTime;
    }
  }, [panelTab]); // eslint-disable-line

  // 用当前 roi 作为裁切坐标（roi 是百分比，转为 0~1 比例）
  // 优先用 prop 传入的 roi，同时尝试从 sessionStorage 读取 RoiSelector 的实时 cropBox
  const cropRoi = React.useMemo(() => {
    // 尝试从 sessionStorage 读取 RoiSelector 保存的实时 cropBox
    if (activeVideo?.id) {
      try {
        const saved = sessionStorage.getItem(`video_state_${activeVideo.id}`);
        if (saved) {
          const state = JSON.parse(saved);
          if (state.cropBox) {
            const cb = state.cropBox;
            return {
              x_ratio: cb.x / 100,
              y_ratio: cb.y / 100,
              w_ratio: cb.width / 100,
              h_ratio: cb.height / 100,
              name: '当前坐标',
            };
          }
        }
      } catch { /* ignore */ }
    }
    // 降级：用 prop 传入的 roi
    if (roi) {
      return {
        x_ratio: roi.x / 100,
        y_ratio: roi.y / 100,
        w_ratio: roi.width / 100,
        h_ratio: roi.height / 100,
        name: '当前坐标',
      };
    }
    return null;
  }, [roi, activeVideo?.id, panelTab]);

  // 实时裁切预览：draw 函数每帧从 sessionStorage 读取最新 cropBox
  useEffect(() => {
    if (panelTab !== 'video' || !activeVideo) return;

    const getCropRoi = () => {
      try {
        const saved = sessionStorage.getItem(`video_state_${activeVideo.id}`);
        if (saved) {
          const state = JSON.parse(saved);
          if (state.cropBox) {
            const cb = state.cropBox;
            return { x_ratio: cb.x / 100, y_ratio: cb.y / 100, w_ratio: cb.width / 100, h_ratio: cb.height / 100 };
          }
        }
      } catch { /* ignore */ }
      if (roi) return { x_ratio: roi.x / 100, y_ratio: roi.y / 100, w_ratio: roi.width / 100, h_ratio: roi.height / 100 };
      return null;
    };

    const draw = () => {
      const video = videoRef.current;
      const canvas = cropCanvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) { animFrameRef.current = requestAnimationFrame(draw); return; }
      const cr = getCropRoi();
      if (!cr) { animFrameRef.current = requestAnimationFrame(draw); return; }
      const sx = Math.round(cr.x_ratio * vw);
      const sy = Math.round(cr.y_ratio * vh);
      const sw = Math.round(cr.w_ratio * vw);
      const sh = Math.round(cr.h_ratio * vh);
      if (sw <= 0 || sh <= 0) { animFrameRef.current = requestAnimationFrame(draw); return; }
      const displayW = canvas.parentElement?.clientWidth || sw;
      const displayH = Math.round(sh * (displayW / sw));
      if (canvas.width !== displayW || canvas.height !== displayH) {
        canvas.width = displayW;
        canvas.height = displayH;
      }
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(video, sx, sy, sw, sh, 0, 0, displayW, displayH);
      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [panelTab, activeVideo, videoSrc, roi]);


  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedGroup, setSelectedGroup] = useState<'all' | 'group1' | 'group2'>('all');
  
  // 滚动容器引用
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // 从 localStorage 获取指定分组的页数和每页数量
  const getGroupState = (group: string) => {
    if (typeof window === 'undefined') return { page: 1, itemsPerPage: 50 };
    const savedPage = window.localStorage.getItem(`compactGallery_currentPage_${group}`);
    const savedItemsPerPage = window.localStorage.getItem(`compactGallery_itemsPerPage_${group}`);
    const page = savedPage ? parseInt(savedPage, 10) : 1;
    const itemsPerPage = savedItemsPerPage ? parseInt(savedItemsPerPage, 10) : 50;
    return {
      page: Number.isFinite(page) && page > 0 ? page : 1,
      itemsPerPage: Number.isFinite(itemsPerPage) && itemsPerPage > 0 ? itemsPerPage : 50
    };
  };
  
  const [currentPage, setCurrentPage] = useState(() => getGroupState('all').page);
  const [itemsPerPage, setItemsPerPage] = useState(() => getGroupState('all').itemsPerPage);
  
  const notifier = useNotifier();

  // 根据选择的分组过滤和排序截取结果
  const filteredFrames = React.useMemo(() => {
    const filtered = selectedGroup === 'all' 
      ? frames 
      : frames.filter(f => f.group === selectedGroup);
    
    const groupPriority: Record<string, number> = {
      'g2': 1,  // 【地点】优先
      'g1': 2   // 【对话】其次
    };
    
    const extractTimeFromFilename = (filename: string): number => {
      const match = filename.match(/\[(\d{2})[_:](\d{2})[_:](\d{2})\.(\d{3})\]/);
      if (!match) return 0;
      const [, hours, minutes, seconds, milliseconds] = match;
      return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(milliseconds) / 1000;
    };
    
    const extractGroupFromFilename = (filename: string): string => {
      const match = filename.match(/^(g[12])_/);
      return match ? match[1] : 'g1';
    };
    
    return [...filtered].sort((a, b) => {
      const timeA = extractTimeFromFilename(a.filename);
      const timeB = extractTimeFromFilename(b.filename);
      
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      
      const groupA = extractGroupFromFilename(a.filename);
      const groupB = extractGroupFromFilename(b.filename);
      const priorityA = groupPriority[groupA] || 999;
      const priorityB = groupPriority[groupB] || 999;
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      return a.filename.localeCompare(b.filename);
    });
  }, [frames, selectedGroup]);

  // 分页计算
  const currentItems = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredFrames.slice(startIndex, endIndex);
  }, [filteredFrames, currentPage, itemsPerPage]);

  const totalPages = React.useMemo(() => {
    return Math.max(1, Math.ceil(filteredFrames.length / itemsPerPage));
  }, [filteredFrames, itemsPerPage]);

  // 保存当前分组的页数和每页数量到 localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(`compactGallery_currentPage_${selectedGroup}`, String(currentPage));
  }, [currentPage, selectedGroup]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(`compactGallery_itemsPerPage_${selectedGroup}`, String(itemsPerPage));
  }, [itemsPerPage, selectedGroup]);

  // 保存滚动位置到 localStorage
  useEffect(() => {
    const saveScrollPosition = () => {
      if (scrollContainerRef.current && typeof window !== 'undefined') {
        window.localStorage.setItem(`compactGallery_scrollTop_${selectedGroup}`, String(scrollContainerRef.current.scrollTop));
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', saveScrollPosition);
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', saveScrollPosition);
      }
    };
  }, [selectedGroup]);

  // 切换分组时，恢复该分组的页数、每页数量和滚动位置
  const hasMountedRef = React.useRef(false);
  const previousGroupRef = React.useRef<string>(selectedGroup);
  
  useEffect(() => {
    // 如果分组发生变化，先保存之前分组的滚动位置
    if (hasMountedRef.current && previousGroupRef.current !== selectedGroup && scrollContainerRef.current) {
      const previousScrollTop = scrollContainerRef.current.scrollTop;
      window.localStorage.setItem(`compactGallery_scrollTop_${previousGroupRef.current}`, String(previousScrollTop));
    }
    
    // 恢复新分组的页数、每页数量和滚动位置
    const groupState = getGroupState(selectedGroup);
    setCurrentPage(groupState.page);
    setItemsPerPage(groupState.itemsPerPage);
    
    // 恢复滚动位置（需要延迟以确保DOM已更新）
    const restoreScrollPosition = () => {
      if (scrollContainerRef.current && typeof window !== 'undefined') {
        const savedScrollTop = window.localStorage.getItem(`compactGallery_scrollTop_${selectedGroup}`);
        if (savedScrollTop) {
          scrollContainerRef.current.scrollTop = Number(savedScrollTop);
        }
      }
    };
    
    if (hasMountedRef.current) {
      // 切换分组时，延迟恢复滚动位置以确保内容已渲染
      setTimeout(restoreScrollPosition, 50);
    } else {
      hasMountedRef.current = true;
      // 首次加载时恢复滚动位置
      setTimeout(restoreScrollPosition, 100);
    }
    
    previousGroupRef.current = selectedGroup;
  }, [selectedGroup]);

  // 数据量变化时，如果当前页超出范围则自动修正
  React.useEffect(() => {
    setCurrentPage(prev => {
      if (!prev || prev < 1) return 1;
      if (prev > totalPages) return totalPages;
      return prev;
    });
  }, [totalPages]);

  // 当页面改变时，恢复该页面的滚动位置（或滚动到顶部）
  const previousPageRef = React.useRef<number>(currentPage);
  useEffect(() => {
    if (hasMountedRef.current && previousPageRef.current !== currentPage) {
      // 页面改变时，可以滚动到顶部，或者记忆每个页面的滚动位置
      // 这里选择滚动到顶部，因为切换页面时通常期望看到页面顶部
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
    previousPageRef.current = currentPage;
  }, [currentPage]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const selectAll = () => {
    const allCurrentItemsSelected = filteredFrames.length > 0 && filteredFrames.every(item => selectedIds.has(item.id));
    
    if (allCurrentItemsSelected) {
      const newSelectedIds = new Set(selectedIds);
      filteredFrames.forEach(item => newSelectedIds.delete(item.id));
      setSelectedIds(newSelectedIds);
    } else {
      const newSelectedIds = new Set(selectedIds);
      filteredFrames.forEach(item => newSelectedIds.add(item.id));
      setSelectedIds(newSelectedIds);
    }
  };

  const handleDeleteSelected = async () => {
    const selectedInCurrentView = filteredFrames.filter(item => selectedIds.has(item.id));
    
    if (selectedInCurrentView.length === 0) {
      notifier.addToast('请先选择要删除的图片', 'warning');
      return;
    }

    const confirmed = await notifier.showConfirm({
      title: '确认删除',
      message: `确定要删除选中的 ${selectedInCurrentView.length} 张图片吗？`
    });

    if (confirmed && onDelete) {
      const idsToDelete = selectedInCurrentView.map(item => item.id);
      onDelete(idsToDelete);
      
      const newSelectedIds = new Set(selectedIds);
      idsToDelete.forEach(id => newSelectedIds.delete(id));
      setSelectedIds(newSelectedIds);
      notifier.addToast(`已删除 ${selectedInCurrentView.length} 张图片`, 'success');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* 顶部：Tab 切换 + 分组筛选 */}
      <div className="flex items-center justify-between border-b border-gray-200 shrink-0 px-2 py-1.5">
        {/* 左侧：Tab 切换 */}
        <div className="flex gap-1">
          <button
            onClick={() => setPanelTab('images')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              panelTab === 'images'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            图片
          </button>
          <button
            onClick={() => setPanelTab('video')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              panelTab === 'video'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            视频
          </button>
        </div>

        {/* 右侧：分组筛选（仅在图片tab显示） */}
        {panelTab === 'images' && (
          <div className="flex items-center gap-1">
            {[
              { key: 'all', label: '全部', count: frames.length },
              { key: 'group1', label: '【对话】', count: frames.filter(f => f.group === 'group1').length },
              { key: 'group2', label: '【地点】', count: frames.filter(f => f.group === 'group2').length }
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setSelectedGroup(key as any)}
                className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                  selectedGroup === key
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 视频 Tab */}
      <div className={`flex-1 overflow-y-auto flex flex-col bg-black ${panelTab === 'video' ? '' : 'hidden'}`}>
          {activeVideo && videoSrc ? (
            <>
              <video
                ref={videoRef}
                src={videoSrc}
                controls
                className="w-full object-contain shrink-0 max-h-[55vh]"
              />
              {/* 截取按钮 */}
              {onCaptureFrame && (
                <div className="shrink-0 bg-gray-900 px-2 py-1.5 flex justify-end border-b border-gray-700">
                  <button
                    onClick={handleCaptureFrame}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
                  >
                    <Scissors className="w-3 h-3" />
                    截取当前帧
                  </button>
                </div>
              )}
              {cropRoi && (
                <div className="shrink-0 bg-gray-900 border-t border-gray-700 p-2">
                  <div className="text-[10px] text-gray-400 mb-1 px-1">
                    裁切预览 · {cropRoi.name}
                  </div>
                  <canvas
                    ref={cropCanvasRef}
                    className="w-full rounded block"
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              <div className="text-center">
                <Video className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>请先上传视频</p>
              </div>
            </div>
          )}
        </div>

      {/* 图片 Tab */}
      <div className={panelTab === 'images' ? 'contents' : 'hidden'}>
        <>
      {/* 工具栏：操作按钮 + 每页数量 */}
      <div className="border-b border-gray-200 px-2 py-1.5 bg-gray-50">
        <div className="flex items-center justify-between gap-2">
          {/* 左侧：选择操作 */}
          <div className="flex items-center gap-1.5">
            <button 
              onClick={selectAll}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200 rounded transition-colors"
              title="全选"
            >
              {(() => {
                const allCurrentItemsSelected = filteredFrames.length > 0 && filteredFrames.every(item => selectedIds.has(item.id));
                return allCurrentItemsSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />;
              })()}
            </button>
            
            {selectedIds.size > 0 && (
              <>
                <span className="text-xs text-indigo-600 font-medium">
                  已选 {filteredFrames.filter(f => selectedIds.has(f.id)).length}
                </span>
                <button 
                  onClick={() => setSelectedIds(new Set())}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-white bg-gray-600 rounded hover:bg-gray-700 transition-colors"
                  title="取消选择"
                >
                  <X className="w-3 h-3" />
                </button>
                <button 
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                  title="删除选中"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>

          {/* 右侧：统计 + 每页数量 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              共 {filteredFrames.length} 张
            </span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            >
              <option value={20}>20/页</option>
              <option value={50}>50/页</option>
              <option value={100}>100/页</option>
            </select>
          </div>
        </div>
      </div>

      {/* 图片列表 - 每行一张 */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto space-y-1.5 px-2 pb-2">
        {currentItems.map((frame) => {
          const isSelected = selectedIds.has(frame.id);
          
          return (
            <div 
              key={frame.id}
              onClick={() => toggleSelect(frame.id)}
              className={`group relative border transition-all cursor-pointer overflow-hidden rounded-lg ${
                isSelected 
                  ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' 
                  : 'border-gray-200 bg-white hover:border-indigo-300'
              }`}
            >
              <div className="relative bg-black overflow-hidden flex items-center justify-center min-h-[80px]">
                <img 
                  src={frame.url} 
                  alt={frame.filename} 
                  className="w-full object-contain group-hover:scale-105 transition-transform duration-300 max-h-[200px]"
                />
                <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity" />
                
                {/* 悬浮按钮 */}
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const ts = frame.timestamp;
                      const parts = ts.split(':');
                      if (parts.length === 3 && activeVideo) {
                        const hours = parseInt(parts[0]);
                        const minutes = parseInt(parts[1]);
                        const secParts = parts[2].split('.');
                        const seconds = parseInt(secParts[0]);
                        const ms = secParts[1] ? parseInt(secParts[1]) : 0;
                        const totalSeconds = hours * 3600 + minutes * 60 + seconds + ms / 1000;
                        setPanelTab('video');
                        // 同时同步本地视频和 sharedVideoRef（字幕截取区域）
                        setTimeout(() => {
                          lastTimeRef.current = totalSeconds;
                          if (videoRef.current) {
                            videoRef.current.currentTime = totalSeconds;
                          }
                          if (sharedVideoRef?.current) {
                            sharedVideoRef.current.currentTime = totalSeconds;
                          }
                        }, 50);
                      } else if (onJumpToTime) {
                        onJumpToTime(ts);
                      }
                    }}
                    className="p-1 bg-white/80 backdrop-blur rounded-full text-indigo-600 hover:bg-white shadow-sm"
                    title="跳转到视频时间点"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                
                {/* 选中标记 */}
                {isSelected && (
                  <div className="absolute top-1 left-1 bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
                    ✓
                  </div>
                )}
              </div>
              
              {/* 图片信息 */}
              <div className="p-1.5 bg-gray-50">
                <p className="text-[10px] text-indigo-600 font-medium">{frame.timestamp}</p>
                <p className="text-[10px] text-gray-600 truncate">{frame.filename}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部分页 */}
      {totalPages > 1 && (
        <div className="border-t border-gray-200 pt-2 px-2 pb-2">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
            >
              上一页
            </button>
            
            <span className="text-sm text-gray-700 font-medium">
              {currentPage} / {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* 空状态 */}
      {filteredFrames.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-center py-8 px-2">
          <div>
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Upload className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">
              {selectedGroup === 'all' ? '暂无截取结果' : `${selectedGroup === 'group1' ? '【对话】' : '【地点】'}暂无截取结果`}
            </p>
          </div>
        </div>
      )}
        </>
      </div>
    </div>
  );
};

export default CompactGallery;
