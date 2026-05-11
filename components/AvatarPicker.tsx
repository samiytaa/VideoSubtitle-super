import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { avatarMap, getAvatarPath } from '../utils/avatarMap';
import { X, Search, Star, Clock, Grid2x2, ZoomIn, ZoomOut, RotateCcw, Image as ImageIcon, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import CompactGallery from './CompactGallery';
import { ExtractedFrame, VideoFile, ROI } from '../types';

interface AvatarPickerProps {
  onSelect: (avatarName: string) => void;
  onClose: () => void;
  currentAvatar?: string;
  // 校对图片相关props
  extractedFrames?: ExtractedFrame[];
  onDeleteFrames?: (ids: string[]) => void;
  onJumpToTime?: (timestamp: string) => void;
  activeVideo?: VideoFile | null;
  videoSrc?: string | null;
  sharedVideoRef?: React.MutableRefObject<HTMLVideoElement | null>;
  roi?: ROI | null;
  onCaptureFrame?: (frame: ExtractedFrame) => void;
}

interface AvatarCategory {
  name: string;
  avatars: string[];
  subcategories?: AvatarSubcategory[];
}

interface AvatarSubcategory {
  name: string;
  avatars: string[];
}

const STORAGE_KEYS = {
  LAST_CATEGORY: 'avatarPicker_lastCategory',
  LAST_SUBCATEGORY: 'avatarPicker_lastSubcategory',
  RECENT_AVATARS: 'avatarPicker_recentAvatars',
  FAVORITE_AVATARS: 'avatarPicker_favoriteAvatars'
};

interface RecentAvatar {
  name: string;
  timestamp: number;
}

const AvatarPicker: React.FC<AvatarPickerProps> = ({ 
  onSelect, 
  onClose, 
  currentAvatar,
  extractedFrames = [],
  onDeleteFrames,
  onJumpToTime,
  activeVideo,
  videoSrc,
  sharedVideoRef,
  roi,
  onCaptureFrame
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  // 右侧预览栏当前悬停/点击的头像
  const [hoveredAvatar, setHoveredAvatar] = useState<string | null>(currentAvatar ?? null);
  
  // 校对图片折叠状态（现在在中间区域下方）
  const [isProofreadCollapsed, setIsProofreadCollapsed] = useState(() => {
    const saved = localStorage.getItem('avatarPicker_proofreadCollapsed');
    return saved !== null ? saved === 'true' : false;
  });
  const [proofreadHeight, setProofreadHeight] = useState(280);
  const MIN_PROOFREAD_HEIGHT = 150;
  const MAX_PROOFREAD_HEIGHT = 500;
  const COLLAPSED_PROOFREAD_HEIGHT = 40;

  // 左侧分类栏折叠状态
  const [isCategoryCollapsed, setIsCategoryCollapsed] = useState(() => {
    const saved = localStorage.getItem('avatarPicker_categoryCollapsed');
    return saved !== null ? saved === 'true' : false;
  });
  const COLLAPSED_CATEGORY_WIDTH = 48;

  // 右侧预览栏折叠状态
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(() => {
    const saved = localStorage.getItem('avatarPicker_previewCollapsed');
    return saved !== null ? saved === 'true' : false;
  });
  const COLLAPSED_PREVIEW_WIDTH = 48;

  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.LAST_CATEGORY) || '全部';
  });

  const [recentAvatars, setRecentAvatars] = useState<RecentAvatar[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.RECENT_AVATARS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (typeof parsed[0] === 'string') {
            return parsed.map((name: string) => ({ name, timestamp: Date.now() }));
          }
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse recent avatars:', e);
      }
    }
    return [];
  });

  const [favoriteAvatars, setFavoriteAvatars] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FAVORITE_AVATARS);
    return new Set(saved ? JSON.parse(saved) : []);
  });

  useEffect(() => {
    localStorage.setItem('avatarPicker_proofreadCollapsed', String(isProofreadCollapsed));
  }, [isProofreadCollapsed]);

  useEffect(() => {
    localStorage.setItem('avatarPicker_categoryCollapsed', String(isCategoryCollapsed));
  }, [isCategoryCollapsed]);

  useEffect(() => {
    localStorage.setItem('avatarPicker_previewCollapsed', String(isPreviewCollapsed));
  }, [isPreviewCollapsed]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LAST_CATEGORY, selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    if (selectedSubcategory) {
      localStorage.setItem(STORAGE_KEYS.LAST_SUBCATEGORY, selectedSubcategory);
    }
  }, [selectedSubcategory]);

  useEffect(() => {
    const lastSubcategory = localStorage.getItem(STORAGE_KEYS.LAST_SUBCATEGORY);
    if (lastSubcategory && selectedCategory !== '全部' && selectedCategory !== '最近使用' && selectedCategory !== '我的收藏') {
      setSelectedSubcategory(lastSubcategory);
    }
  }, [selectedCategory]);

  const addToRecent = (avatarName: string) => {
    const updated = [
      { name: avatarName, timestamp: Date.now() },
      ...recentAvatars.filter(a => a.name !== avatarName)
    ].slice(0, 20);
    setRecentAvatars(updated);
    localStorage.setItem(STORAGE_KEYS.RECENT_AVATARS, JSON.stringify(updated));
  };

  const toggleFavorite = (avatarName: string) => {
    const updated = new Set(favoriteAvatars);
    if (updated.has(avatarName)) {
      updated.delete(avatarName);
    } else {
      updated.add(avatarName);
    }
    setFavoriteAvatars(updated);
    localStorage.setItem(STORAGE_KEYS.FAVORITE_AVATARS, JSON.stringify([...updated]));
  };

  const handleSelectAvatar = (avatarName: string) => {
    addToRecent(avatarName);
    onSelect(avatarName);
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const categories = useMemo(() => {
    const categoryMap: { [key: string]: { [key: string]: string[] } } = {};

    Object.keys(avatarMap).forEach(avatarName => {
      const path = avatarMap[avatarName];
      const parts = path.split('/');
      const mainCategory = parts[0];

      if (!categoryMap[mainCategory]) categoryMap[mainCategory] = {};

      if (parts.length > 2) {
        const subCategory = parts[1];
        if (!categoryMap[mainCategory][subCategory]) categoryMap[mainCategory][subCategory] = [];
        categoryMap[mainCategory][subCategory].push(avatarName);
      } else {
        if (!categoryMap[mainCategory]['_root']) categoryMap[mainCategory]['_root'] = [];
        categoryMap[mainCategory]['_root'].push(avatarName);
      }
    });

    const categoryOrder = ['广陵王头像', '密探头像', '男主头像', '其他头像', '立绘QQ人', '小头像QQ人'];
    const guanglingSubcategoryOrder = [
      '广陵王-基础', '广陵王-面纱', '广陵王-脏脸', '世子常服', '宗室常服',
      '江东乔影', '内廷绣罗', '逆波上流', '巫女', '三国志绒绒版-联动'
    ];

    const result: AvatarCategory[] = [];

    categoryOrder.forEach(categoryName => {
      if (categoryMap[categoryName]) {
        const subcategoryMap = categoryMap[categoryName];
        const allAvatars: string[] = [];
        const subcategories: AvatarSubcategory[] = [];

        if (categoryName === '广陵王头像') {
          guanglingSubcategoryOrder.forEach(subName => {
            if (subcategoryMap[subName]) {
              subcategories.push({ name: subName, avatars: subcategoryMap[subName].sort() });
              allAvatars.push(...subcategoryMap[subName]);
            }
          });
          Object.keys(subcategoryMap).forEach(subName => {
            if (subName !== '_root' && !guanglingSubcategoryOrder.includes(subName)) {
              subcategories.push({ name: subName, avatars: subcategoryMap[subName].sort() });
              allAvatars.push(...subcategoryMap[subName]);
            }
          });
        } else if (categoryName === '密探头像') {
          const humanAvatars: string[] = [];
          Object.keys(subcategoryMap).forEach(subName => {
            if (subName === '_root') {
              humanAvatars.push(...subcategoryMap[subName]);
              allAvatars.push(...subcategoryMap[subName]);
            } else {
              subcategories.push({ name: subName, avatars: subcategoryMap[subName].sort() });
              allAvatars.push(...subcategoryMap[subName]);
            }
          });
          if (humanAvatars.length > 0) {
            subcategories.unshift({ name: '人物头像', avatars: humanAvatars.sort() });
          }
          const otherSubcategories = subcategories.slice(1);
          otherSubcategories.sort((a, b) => a.name.localeCompare(b.name));
          subcategories.splice(1, subcategories.length - 1, ...otherSubcategories);
        } else {
          Object.keys(subcategoryMap).forEach(subName => {
            if (subName === '_root') {
              allAvatars.push(...subcategoryMap[subName]);
            } else {
              subcategories.push({ name: subName, avatars: subcategoryMap[subName].sort() });
              allAvatars.push(...subcategoryMap[subName]);
            }
          });
          subcategories.sort((a, b) => a.name.localeCompare(b.name));
        }

        result.push({
          name: categoryName,
          avatars: allAvatars.sort(),
          subcategories: subcategories.length > 0 ? subcategories : undefined
        });
      }
    });

    Object.keys(categoryMap).forEach(categoryName => {
      if (!categoryOrder.includes(categoryName)) {
        const subcategoryMap = categoryMap[categoryName];
        const allAvatars: string[] = [];
        const subcategories: AvatarSubcategory[] = [];
        Object.keys(subcategoryMap).forEach(subName => {
          if (subName === '_root') {
            allAvatars.push(...subcategoryMap[subName]);
          } else {
            subcategories.push({ name: subName, avatars: subcategoryMap[subName].sort() });
            allAvatars.push(...subcategoryMap[subName]);
          }
        });
        result.push({
          name: categoryName,
          avatars: allAvatars.sort(),
          subcategories: subcategories.length > 0 ? subcategories : undefined
        });
      }
    });

    return result;
  }, []);

  const filteredAvatars = useMemo(() => {
    let avatars: string[] = [];

    if (selectedCategory === '全部') {
      avatars = Object.keys(avatarMap);
    } else if (selectedCategory === '最近使用') {
      const sortedRecent = [...recentAvatars].sort((a, b) => b.timestamp - a.timestamp);
      avatars = sortedRecent.map(a => a.name).filter(name => avatarMap[name]);
    } else if (selectedCategory === '我的收藏') {
      avatars = [...favoriteAvatars].filter(name => avatarMap[name]);
    } else {
      const category = categories.find(c => c.name === selectedCategory);
      if (category) {
        if (selectedSubcategory && category.subcategories) {
          const subcategory = category.subcategories.find(s => s.name === selectedSubcategory);
          avatars = subcategory ? subcategory.avatars : [];
        } else {
          avatars = category.avatars;
        }
      }
    }

    if (searchTerm) {
      const filtered = avatars.filter(name =>
        name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (filtered.length === 0 && selectedCategory !== '全部') {
        return Object.keys(avatarMap).filter(name =>
          name.toLowerCase().includes(searchTerm.toLowerCase())
        ).sort();
      }
      return filtered.sort();
    }

    if (selectedCategory === '最近使用') return avatars;
    return avatars.sort();
  }, [selectedCategory, selectedSubcategory, searchTerm, categories, recentAvatars, favoriteAvatars]);

  const previewPath = hoveredAvatar ? getAvatarPath(hoveredAvatar) : null;
  const isPreviewFavorite = hoveredAvatar ? favoriteAvatars.has(hoveredAvatar) : false;
  const isPreviewSelected = hoveredAvatar === currentAvatar;

  // 校对图片拖拽（现在是垂直拖拽）
  const isResizingProofread = useRef(false);
  const proofreadResizeStartY = useRef(0);
  const proofreadResizeStartHeight = useRef(0);

  const handleProofreadResizeMouseDown = useCallback((e: React.MouseEvent) => {
    if (isProofreadCollapsed) return;
    e.preventDefault();
    isResizingProofread.current = true;
    proofreadResizeStartY.current = e.clientY;
    proofreadResizeStartHeight.current = proofreadHeight;
  }, [isProofreadCollapsed, proofreadHeight]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingProofread.current) {
        // 向上拖：clientY 减小 → 高度增大
        const delta = proofreadResizeStartY.current - e.clientY;
        const newHeight = Math.min(Math.max(proofreadResizeStartHeight.current + delta, MIN_PROOFREAD_HEIGHT), MAX_PROOFREAD_HEIGHT);
        setProofreadHeight(newHeight);
      }
    };
    const handleMouseUp = () => {
      if (isResizingProofread.current) {
        isResizingProofread.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // 预览栏宽度拖拽
  const [previewWidth, setPreviewWidth] = useState(224); // 默认 w-56 = 224px
  const MIN_PREVIEW_WIDTH = 180;
  const isResizingPreview = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const mainBodyRef = useRef<HTMLDivElement>(null);

  const handlePreviewResizeMouseDown = useCallback((e: React.MouseEvent) => {
    if (isPreviewCollapsed) return;
    e.preventDefault();
    isResizingPreview.current = true;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = previewWidth;
  }, [isPreviewCollapsed, previewWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingPreview.current) return;
      // 向左拖：clientX 减小 → 宽度增大
      const delta = resizeStartX.current - e.clientX;
      const bodyWidth = mainBodyRef.current?.clientWidth ?? window.innerWidth;
      const maxWidth = bodyWidth - 400; // 保留左侧分类栏+网格最小空间
      const newWidth = Math.min(Math.max(resizeStartWidth.current + delta, MIN_PREVIEW_WIDTH), maxWidth);
      setPreviewWidth(newWidth);
    };
    const handleMouseUp = () => {
      if (isResizingPreview.current) {
        isResizingPreview.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // 放大镜
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffsetStart = useRef({ x: 0, y: 0 });
  const imgContainerRef = useRef<HTMLDivElement>(null);

  // 切换头像时重置缩放
  useEffect(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, [hoveredAvatar]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => {
      const next = prev * (e.deltaY < 0 ? 1.15 : 1 / 1.15);
      return Math.min(Math.max(next, 0.5), 8);
    });
  }, []);

  const handleImgMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    panOffsetStart.current = panOffset;
  }, [zoom, panOffset]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanning.current) return;
      setPanOffset({
        x: panOffsetStart.current.x + (e.clientX - panStart.current.x),
        y: panOffsetStart.current.y + (e.clientY - panStart.current.y),
      });
    };
    const handleMouseUp = () => { isPanning.current = false; };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full h-full flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="relative flex items-center px-5 py-2 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-sm font-semibold text-gray-800 shrink-0">选择头像</h2>
          <div className="absolute left-1/2 -translate-x-1/2 w-96">
            <div className="relative group">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索头像名称..."
                className="w-full pl-10 pr-4 py-1.5 rounded-full border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 shadow-sm hover:shadow transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  title="清除"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-500 hover:text-white border border-red-200 hover:border-red-500 transition-all shrink-0"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        {/* 主体 */}
        <div ref={mainBodyRef} className="flex flex-1 overflow-hidden">

          {/* 左侧分类侧边栏 */}
          <div 
            className="border-r border-gray-200 bg-gray-50 shrink-0 flex flex-col relative transition-all duration-300"
            style={{ width: isCategoryCollapsed ? COLLAPSED_CATEGORY_WIDTH : 208 }}
          >
            {isCategoryCollapsed ? (
              // 折叠状态
              <div className="h-full flex flex-col items-center justify-start pt-6 px-2">
                <button
                  onClick={() => setIsCategoryCollapsed(false)}
                  className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  title="展开分类"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
                <div className="[writing-mode:vertical-rl] text-xs text-gray-500 mt-3">
                  分类
                </div>
              </div>
            ) : (
              // 展开状态
              <>
                {/* 标题栏 */}
                <div className="px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">分类</span>
                  <button
                    onClick={() => setIsCategoryCollapsed(true)}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    title="折叠面板"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </div>

                {/* 分类列表 */}
                <div className="flex-1 overflow-y-auto">
                  {[
                    { label: '全部', count: Object.keys(avatarMap).length, key: '全部', icon: <Grid2x2 size={14} className="shrink-0" /> },
                    { label: '最近使用', count: recentAvatars.length, key: '最近使用', icon: <Clock size={14} className="shrink-0" /> },
                    { label: '我的收藏', count: favoriteAvatars.size, key: '我的收藏', icon: <Star size={14} className="shrink-0" fill={selectedCategory === '我的收藏' ? 'currentColor' : 'none'} /> },
                  ].map(({ label, count, key, icon }) => (
                    <div
                      key={key}
                      onClick={() => { setSelectedCategory(key); setSelectedSubcategory(''); }}
                      className={`flex items-center gap-2 px-4 py-2 cursor-pointer text-sm border-l-2 transition-colors ${
                        selectedCategory === key
                          ? 'bg-blue-50 text-blue-600 font-medium border-blue-500'
                          : 'border-transparent text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {icon}
                      <span className="truncate">{label}</span>
                      <span className="ml-auto text-xs text-gray-400 shrink-0">({count})</span>
                    </div>
                  ))}

                  <div className="h-px bg-gray-200 my-1.5 mx-3" />

                  {categories.map(category => (
                    <div key={category.name}>
                      <div
                        onClick={() => { setSelectedCategory(category.name); setSelectedSubcategory(''); }}
                        className={`flex items-center px-4 py-2 cursor-pointer text-sm border-l-2 transition-colors ${
                          selectedCategory === category.name && !selectedSubcategory
                            ? 'bg-blue-50 text-blue-600 font-medium border-blue-500'
                            : selectedCategory === category.name
                            ? 'text-blue-600 border-transparent'
                            : 'border-transparent text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <span className="truncate">{category.name}</span>
                        <span className="ml-auto text-xs text-gray-400 shrink-0">({category.avatars.length})</span>
                      </div>
                      {selectedCategory === category.name && category.subcategories && (
                        <div className="bg-gray-100">
                          {category.subcategories.map(subcategory => (
                            <div
                              key={subcategory.name}
                              onClick={() => setSelectedSubcategory(subcategory.name)}
                              className={`flex items-center pl-8 pr-4 py-1.5 cursor-pointer text-xs border-l-2 transition-colors ${
                                selectedSubcategory === subcategory.name
                                  ? 'bg-blue-50 text-blue-600 border-blue-500'
                                  : 'border-transparent text-gray-500 hover:bg-gray-200'
                              }`}
                            >
                              <span className="truncate">{subcategory.name}</span>
                              <span className="ml-auto text-xs text-gray-400 shrink-0">({subcategory.avatars.length})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 中间区域：头像网格 + 校对图片 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 头像网格 */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredAvatars.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-gray-400">
                  未找到匹配的头像
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
                  {filteredAvatars.map(avatarName => {
                    const avatarPath = getAvatarPath(avatarName);
                    const isSelected = currentAvatar === avatarName;
                    const isFavorite = favoriteAvatars.has(avatarName);
                    const isPreviewing = hoveredAvatar === avatarName;

                    return (
                      <div
                        key={avatarName}
                        onClick={() => setHoveredAvatar(avatarName)}
                        className={`group relative flex flex-col items-center gap-1 rounded-lg p-1.5 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-2 border-blue-500 bg-blue-50 shadow-sm'
                            : isPreviewing
                            ? 'border-2 border-indigo-400 bg-indigo-50 shadow-sm'
                            : 'border border-gray-200 bg-white hover:border-blue-300 hover:-translate-y-0.5 hover:shadow-md'
                        }`}
                      >
                        {avatarPath && (
                          <>
                            <div className="relative rounded-md overflow-hidden" style={{ width: '72px', height: '72px' }}>
                              <img
                                src={avatarPath}
                                alt={avatarName}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                              {/* hover 遮罩 */}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none rounded-md" />
                            </div>
                            <div className="w-full text-xs text-gray-500 text-center leading-tight line-clamp-2 break-all">
                              {avatarName}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 校对图片区域 */}
            <div
              className="border-t border-gray-200 bg-white shrink-0 flex flex-col relative transition-all duration-300"
              style={{ height: isProofreadCollapsed ? COLLAPSED_PROOFREAD_HEIGHT : proofreadHeight }}
            >
              {isProofreadCollapsed ? (
                // 折叠状态 - 左侧垂直条
                <div className="h-full flex items-center justify-start px-2">
                  <button
                    onClick={() => setIsProofreadCollapsed(false)}
                    className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-all text-xs flex items-center gap-1.5 group"
                    title="展开校对图片"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 group-hover:animate-pulse" />
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span className="text-[10px]">校对图片</span>
                  </button>
                </div>
              ) : (
                // 展开状态
                <>
                  {/* 上方拖拽手柄 */}
                  <div
                    onMouseDown={handleProofreadResizeMouseDown}
                    className="absolute top-0 left-0 right-0 h-1.5 cursor-row-resize z-10 group"
                    title="拖动调整高度"
                  >
                    <div className="absolute inset-x-0 top-0 h-1 bg-transparent group-hover:bg-indigo-400 transition-colors" />
                  </div>

                  {/* 标题栏 */}
                  <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white">
                    <div className="flex items-center gap-2">
                      <ImageIcon size={14} className="text-indigo-600" />
                      <span className="text-xs font-medium text-gray-700">校对图片</span>
                    </div>
                    <button
                      onClick={() => setIsProofreadCollapsed(true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 rounded-md transition-all shadow-sm hover:shadow group"
                      title="收起面板"
                    >
                      <span className="text-[10px] text-gray-600 group-hover:text-indigo-600 font-medium">收起</span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                    </button>
                  </div>

                  {/* 内容区域 */}
                  <div className="flex-1 overflow-hidden">
                    <CompactGallery
                      frames={extractedFrames}
                      onDelete={onDeleteFrames}
                      onJumpToTime={onJumpToTime}
                      activeVideo={activeVideo}
                      videoSrc={videoSrc}
                      sharedVideoRef={sharedVideoRef}
                      roi={roi}
                      onCaptureFrame={onCaptureFrame}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 右侧预览栏 */}
          <div
            className="border-l border-gray-200 bg-gray-50 shrink-0 flex flex-col relative transition-all duration-300"
            style={{ width: isPreviewCollapsed ? COLLAPSED_PREVIEW_WIDTH : previewWidth }}
          >
            {isPreviewCollapsed ? (
              // 折叠状态
              <div className="h-full flex flex-col items-center justify-start pt-6 px-2">
                <button
                  onClick={() => setIsPreviewCollapsed(false)}
                  className="p-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  title="展开预览"
                >
                  <PanelRightOpen className="w-4 h-4" />
                </button>
                <div className="[writing-mode:vertical-rl] text-xs text-gray-500 mt-3">
                  预览
                </div>
              </div>
            ) : (
              // 展开状态
              <>
                {/* 左侧拖拽手柄 */}
                <div
                  onMouseDown={handlePreviewResizeMouseDown}
                  className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 group"
                  title="拖动调整宽度"
                >
                  <div className="absolute inset-y-0 left-0 w-1 bg-transparent group-hover:bg-blue-400 transition-colors" />
                </div>

                <div className="px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">预览</span>
                  <button
                    onClick={() => setIsPreviewCollapsed(true)}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    title="折叠面板"
                  >
                    <PanelRightClose className="w-4 h-4" />
                  </button>
                </div>

                {hoveredAvatar && previewPath ? (
                  <div className="flex flex-col items-center gap-4 p-4 flex-1 overflow-hidden">
                    {/* 大图预览 */}
                    <div
                      ref={imgContainerRef}
                      onWheel={handleWheel}
                      onMouseDown={handleImgMouseDown}
                      className="w-full flex-1 flex items-center justify-center bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden relative"
                      style={{ cursor: zoom > 1 ? (isPanning.current ? 'grabbing' : 'grab') : 'default' }}
                    >
                      <img
                        src={previewPath}
                        alt={hoveredAvatar}
                        draggable={false}
                        className="max-w-full max-h-full object-contain select-none transition-transform duration-100"
                        style={{
                          transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
                          transformOrigin: 'center center',
                        }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      {/* 缩放控件 */}
                      <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg px-1.5 py-1 shadow-sm">
                        <button
                          onClick={() => setZoom(z => Math.max(z / 1.3, 0.5))}
                          className="p-0.5 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                          title="缩小"
                        >
                          <ZoomOut size={13} />
                        </button>
                        <span className="text-xs text-gray-500 w-9 text-center tabular-nums">
                          {Math.round(zoom * 100)}%
                        </span>
                        <button
                          onClick={() => setZoom(z => Math.min(z * 1.3, 8))}
                          className="p-0.5 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                          title="放大"
                        >
                          <ZoomIn size={13} />
                        </button>
                        <div className="w-px h-3 bg-gray-200 mx-0.5" />
                        <button
                          onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}
                          className="p-0.5 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                          title="重置"
                        >
                          <RotateCcw size={13} />
                        </button>
                      </div>
                      {/* 滚轮提示 */}
                      {zoom === 1 && (
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs text-gray-300 pointer-events-none whitespace-nowrap">
                          滚轮缩放
                        </div>
                      )}
                    </div>

                    {/* 名称 */}
                    <p className="text-sm font-medium text-gray-800 text-center leading-snug break-all">
                      {hoveredAvatar}
                    </p>

                    {/* 操作按钮 */}
                    <div className="flex flex-col gap-2 w-full">
                      <button
                        onClick={() => handleSelectAvatar(hoveredAvatar)}
                        className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                          isPreviewSelected
                            ? 'bg-blue-100 text-blue-600 border border-blue-300 cursor-default'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                        disabled={isPreviewSelected}
                      >
                        {isPreviewSelected ? '当前使用中' : '选择此头像'}
                      </button>
                      <button
                        onClick={() => toggleFavorite(hoveredAvatar)}
                        className={`w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                          isPreviewFavorite
                            ? 'bg-amber-50 text-amber-600 border border-amber-300 hover:bg-amber-100'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <Star size={13} fill={isPreviewFavorite ? 'currentColor' : 'none'} strokeWidth={2} />
                        {isPreviewFavorite ? '取消收藏' : '收藏'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-400 p-4">
                    <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                      <Grid2x2 size={24} className="text-gray-300" />
                    </div>
                    <p className="text-xs text-center">点击头像查看预览</p>
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default AvatarPicker;
