import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { avatarCategories, avatarMap, getAvatarPath, normalizeAvatarName } from '../utils/avatarMap';
import { X, Search, Star, Clock, Grid2x2, ZoomIn, ZoomOut, RotateCcw, Image as ImageIcon, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, ChevronUp } from 'lucide-react';
import CompactGallery from './CompactGallery';
import { ExtractedFrame, VideoFile, ROI } from '../types';
import { handleError } from '../utils/errorHandler';
import { generateAvatarReferenceImages } from '../utils/avatarReferenceCrop';

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
  subcategories?: AvatarLeafCategory[];
}

interface AvatarLeafCategory {
  name: string;
  avatars: string[];
}

interface AvatarLocation {
  category: string;
  subcategory?: string;
  leafSubcategory?: string;
}

const STORAGE_KEYS = {
  LAST_CATEGORY: 'avatarPicker_lastCategory',
  LAST_SUBCATEGORY: 'avatarPicker_lastSubcategory',
  LAST_LEAF_SUBCATEGORY: 'avatarPicker_lastLeafSubcategory',
  LAST_AVATAR: 'avatarPicker_lastAvatar',
  RECENT_AVATARS: 'avatarPicker_recentAvatars',
  FAVORITE_AVATARS: 'avatarPicker_favoriteAvatars'
};

const SPECIAL_CATEGORIES = ['全部', '最近使用', '我的收藏'] as const;

interface RecentAvatar {
  name: string;
  timestamp: number;
}

interface AvatarReferencePreview {
  frameId: string;
  frameUrl: string;
  left: string;
  right: string;
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
  const [selectedLeafSubcategory, setSelectedLeafSubcategory] = useState<string>('');
  // 当前展开的主分类，同一时间只允许一个
  const [expandedCategory, setExpandedCategory] = useState<string>(() => {
    return localStorage.getItem('avatarPicker_expandedCategory') || localStorage.getItem(STORAGE_KEYS.LAST_CATEGORY) || '';
  });
  // 右侧预览栏当前悬停/点击的头像
  const [hoveredAvatar, setHoveredAvatar] = useState<string | null>(currentAvatar ?? null);
  const avatarItemRefs = useRef(new Map<string, HTMLDivElement>());
  const [selectedReferenceFrameId, setSelectedReferenceFrameId] = useState<string | null>(null);
  const [avatarReferencePreview, setAvatarReferencePreview] = useState<AvatarReferencePreview | null>(null);
  const [isGeneratingReferencePreview, setIsGeneratingReferencePreview] = useState(false);
  const [referencePreviewError, setReferencePreviewError] = useState<string | null>(null);
  
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
            return parsed.map((name: string) => ({ name: normalizeAvatarName(name), timestamp: Date.now() }));
          }
          return parsed.map((item: RecentAvatar) => ({
            ...item,
            name: normalizeAvatarName(item.name),
          }));
        }
      } catch (e) {
        handleError(e, undefined, { context: 'Failed to parse recent avatars' });
      }
    }
    return [];
  });

  const [favoriteAvatars, setFavoriteAvatars] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FAVORITE_AVATARS);
    return new Set((saved ? JSON.parse(saved) : []).map((avatarName: string) => normalizeAvatarName(avatarName)));
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
    if (!selectedReferenceFrameId) return;
    if (extractedFrames.some((frame) => frame.id === selectedReferenceFrameId)) return;
    setSelectedReferenceFrameId(null);
    setAvatarReferencePreview(null);
    setReferencePreviewError(null);
  }, [extractedFrames, selectedReferenceFrameId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LAST_CATEGORY, selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    localStorage.setItem('avatarPicker_expandedCategory', expandedCategory);
  }, [expandedCategory]);

  useEffect(() => {
    if (selectedSubcategory) {
      localStorage.setItem(STORAGE_KEYS.LAST_SUBCATEGORY, selectedSubcategory);
    }
  }, [selectedSubcategory]);

  useEffect(() => {
    if (selectedLeafSubcategory) {
      localStorage.setItem(STORAGE_KEYS.LAST_LEAF_SUBCATEGORY, selectedLeafSubcategory);
    }
  }, [selectedLeafSubcategory]);

  useEffect(() => {
    const lastLeafSubcategory = localStorage.getItem(STORAGE_KEYS.LAST_LEAF_SUBCATEGORY);
    if (lastLeafSubcategory && selectedCategory === '男主头像' && selectedSubcategory) {
      setSelectedLeafSubcategory(lastLeafSubcategory);
    }
  }, [selectedCategory, selectedSubcategory]);

  const addToRecent = (avatarName: string) => {
    const normalizedAvatarName = normalizeAvatarName(avatarName);
    const updated = [
      { name: normalizedAvatarName, timestamp: Date.now() },
      ...recentAvatars.filter(a => a.name !== normalizedAvatarName)
    ].slice(0, 20);
    setRecentAvatars(updated);
    localStorage.setItem(STORAGE_KEYS.RECENT_AVATARS, JSON.stringify(updated));
  };

  const toggleFavorite = (avatarName: string) => {
    const normalizedAvatarName = normalizeAvatarName(avatarName);
    const updated = new Set(favoriteAvatars);
    if (updated.has(normalizedAvatarName)) {
      updated.delete(normalizedAvatarName);
    } else {
      updated.add(normalizedAvatarName);
    }
    setFavoriteAvatars(updated);
    localStorage.setItem(STORAGE_KEYS.FAVORITE_AVATARS, JSON.stringify([...updated]));
  };

  const handleSelectAvatar = (avatarName: string) => {
    const normalizedAvatarName = normalizeAvatarName(avatarName);
    addToRecent(normalizedAvatarName);
    localStorage.setItem(STORAGE_KEYS.LAST_AVATAR, normalizedAvatarName);
    onSelect(normalizedAvatarName);
  };

  const jumpToCategoryPath = useCallback((category: string, subcategory?: string, leafSubcategory?: string) => {
    setIsCategoryCollapsed(false);
    setSelectedCategory(category);
    setExpandedCategory(category);
    setSelectedSubcategory(subcategory ?? '');
    setSelectedLeafSubcategory(leafSubcategory ?? '');
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const categories = useMemo(
    () => avatarCategories as unknown as AvatarCategory[],
    []
  );

  const avatarLocationMap = useMemo(() => {
    const locationMap = new Map<string, AvatarLocation>();

    categories.forEach((category) => {
      category.avatars.forEach((avatarName) => {
        locationMap.set(avatarName, { category: category.name });
      });

      category.subcategories?.forEach((subcategory) => {
        subcategory.avatars.forEach((avatarName) => {
          locationMap.set(avatarName, {
            category: category.name,
            subcategory: subcategory.name,
          });
        });

        subcategory.subcategories?.forEach((leafSubcategory) => {
          leafSubcategory.avatars.forEach((avatarName) => {
            locationMap.set(avatarName, {
              category: category.name,
              subcategory: subcategory.name,
              leafSubcategory: leafSubcategory.name,
            });
          });
        });
      });
    });

    return locationMap;
  }, [categories]);

  useEffect(() => {
    const targetAvatarRaw = currentAvatar || localStorage.getItem(STORAGE_KEYS.LAST_AVATAR);
    const targetAvatar = targetAvatarRaw ? normalizeAvatarName(targetAvatarRaw) : '';
    if (targetAvatar) {
      const location = avatarLocationMap.get(targetAvatar);
      if (location) {
        setSearchTerm('');
        setSelectedCategory(location.category);
        setExpandedCategory(location.category);
        setSelectedSubcategory(location.subcategory ?? '');
        setSelectedLeafSubcategory(location.leafSubcategory ?? '');
        setHoveredAvatar(targetAvatar);
        return;
      }
    }

    const lastCategory = localStorage.getItem(STORAGE_KEYS.LAST_CATEGORY) || '全部';
    const lastSubcategory = localStorage.getItem(STORAGE_KEYS.LAST_SUBCATEGORY) || '';
    const lastLeafSubcategory = localStorage.getItem(STORAGE_KEYS.LAST_LEAF_SUBCATEGORY) || '';

    setSelectedCategory(lastCategory);
    setExpandedCategory(SPECIAL_CATEGORIES.includes(lastCategory as (typeof SPECIAL_CATEGORIES)[number]) ? '' : lastCategory);
    setSelectedSubcategory(lastSubcategory);
    setSelectedLeafSubcategory(lastLeafSubcategory);
  }, [currentAvatar, avatarLocationMap]);

  const filteredAvatars = useMemo(() => {
    let avatars: string[] = [];

    if (selectedCategory === '全部') {
      avatars = Object.keys(avatarMap);
    } else if (selectedCategory === '最近使用') {
      const sortedRecent = [...recentAvatars].sort((a, b) => b.timestamp - a.timestamp);
      avatars = sortedRecent.map(a => a.name).filter(name => avatarMap[name]);
    } else if (selectedCategory === '我的收藏') {
      avatars = Object.keys(avatarMap).filter(name => favoriteAvatars.has(name));
    } else {
      const category = categories.find(c => c.name === selectedCategory);
      if (category) {
        if (selectedSubcategory && category.subcategories) {
          const subcategory = category.subcategories.find(s => s.name === selectedSubcategory);
          if (subcategory?.subcategories && selectedLeafSubcategory) {
            const leafSubcategory = subcategory.subcategories.find(s => s.name === selectedLeafSubcategory);
            avatars = leafSubcategory ? leafSubcategory.avatars : subcategory.avatars;
          } else {
            avatars = subcategory ? subcategory.avatars : [];
          }
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
        );
      }
      return filtered;
    }

    if (selectedCategory === '最近使用') return avatars;
    return avatars;
  }, [selectedCategory, selectedSubcategory, selectedLeafSubcategory, searchTerm, categories, recentAvatars, favoriteAvatars]);

  useEffect(() => {
    const targetAvatarRaw = currentAvatar || localStorage.getItem(STORAGE_KEYS.LAST_AVATAR) || hoveredAvatar;
    const targetAvatar = targetAvatarRaw ? normalizeAvatarName(targetAvatarRaw) : '';
    if (!targetAvatar || !filteredAvatars.includes(targetAvatar)) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const targetElement = avatarItemRefs.current.get(targetAvatar);
      targetElement?.scrollIntoView({ block: 'center', inline: 'nearest' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentAvatar, hoveredAvatar, filteredAvatars, selectedCategory, selectedSubcategory, selectedLeafSubcategory]);

  const previewPath = hoveredAvatar ? getAvatarPath(hoveredAvatar) : null;
  const isPreviewFavorite = hoveredAvatar ? favoriteAvatars.has(hoveredAvatar) : false;
  const isPreviewSelected = hoveredAvatar === currentAvatar;
  const selectedReferenceFrame = useMemo(
    () => extractedFrames.find((frame) => frame.id === selectedReferenceFrameId) ?? null,
    [extractedFrames, selectedReferenceFrameId]
  );

  const handleSelectReferenceFrame = useCallback((frame: ExtractedFrame) => {
    setSelectedReferenceFrameId(frame.id);
    setReferencePreviewError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!selectedReferenceFrame) {
      setAvatarReferencePreview(null);
      setReferencePreviewError(null);
      setIsGeneratingReferencePreview(false);
      return;
    }

    setIsGeneratingReferencePreview(true);
    setReferencePreviewError(null);

    generateAvatarReferenceImages(selectedReferenceFrame.url)
      .then((preview) => {
        if (cancelled) return;
        setAvatarReferencePreview({
          frameId: selectedReferenceFrame.id,
          frameUrl: selectedReferenceFrame.url,
          left: preview.left,
          right: preview.right,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setAvatarReferencePreview(null);
        setReferencePreviewError(error instanceof Error ? error.message : '头像参考图生成失败');
        handleError(error, undefined, { context: 'Failed to generate avatar reference preview' });
      })
      .finally(() => {
        if (!cancelled) {
          setIsGeneratingReferencePreview(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedReferenceFrame]);

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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full h-full flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center gap-4 px-5 py-2 border-b border-gray-200 bg-linear-to-r from-gray-50 to-white">
          <h2 className="text-sm font-semibold text-gray-800 shrink-0">选择头像</h2>
          <div className="flex-1 flex justify-center min-w-0">
            <div className="w-full max-w-96">
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
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin shrink-0">
            <button
              onClick={() => jumpToCategoryPath('广陵王头像', '广陵王-默认')}
              className="px-2.5 py-1 rounded-full border border-blue-200 bg-blue-50 text-[11px] leading-none text-blue-600 hover:bg-blue-100 transition-colors whitespace-nowrap"
              title="跳转到广陵王-默认"
            >
              广陵王
            </button>
            <button
              onClick={() => jumpToCategoryPath('其他小头像汇总', '其他', '敌方NPC')}
              className="px-2.5 py-1 rounded-full border border-amber-200 bg-amber-50 text-[11px] leading-none text-amber-700 hover:bg-amber-100 transition-colors whitespace-nowrap"
              title="跳转到敌方NPC"
            >
              敌方NPC
            </button>
            <button
              onClick={() => jumpToCategoryPath('其他小头像汇总', '其他', '剧情NPC')}
              className="px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-[11px] leading-none text-emerald-700 hover:bg-emerald-100 transition-colors whitespace-nowrap"
              title="跳转到剧情NPC"
            >
              剧情NPC
            </button>
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
                <div className="px-4 py-2.5 border-b border-gray-200 flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-700 shrink-0">分类</span>
                  <div className="ml-auto" />
                  <button
                    onClick={() => setIsCategoryCollapsed(true)}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors shrink-0"
                    title="折叠面板"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </div>

                {/* 分类列表 */}
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                  {[ 
                    { label: '全部', count: Object.keys(avatarMap).length, key: '全部', icon: <Grid2x2 size={14} className="shrink-0" /> },
                    { label: '最近使用', count: recentAvatars.length, key: '最近使用', icon: <Clock size={14} className="shrink-0" /> },
                    { label: '我的收藏', count: favoriteAvatars.size, key: '我的收藏', icon: <Star size={14} className="shrink-0" fill={selectedCategory === '我的收藏' ? 'currentColor' : 'none'} /> },
                  ].map(({ label, count, key, icon }) => (
                    <div
                      key={key}
                      onClick={() => { setSelectedCategory(key); setSelectedSubcategory(''); setSelectedLeafSubcategory(''); }}
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
                        onClick={() => {
                          const isSpecial = ['全部', '最近使用', '我的收藏'].includes(category.name);
                          if (!isSpecial) {
                              const willExpand = expandedCategory !== category.name;
                              setSelectedCategory(category.name);

                              if (willExpand) {
                              setSelectedSubcategory('');
                              setSelectedLeafSubcategory('');
                              setExpandedCategory(category.name);
                            } else {
                              setSelectedSubcategory('');
                              setSelectedLeafSubcategory('');
                              setExpandedCategory('');
                            }
                          } else {
                            setSelectedCategory(category.name);
                            setSelectedSubcategory('');
                            setSelectedLeafSubcategory('');
                            setExpandedCategory('');
                          }
                        }}
                        className={`flex items-center px-4 py-2 cursor-pointer text-sm border-l-2 transition-colors ${
                          selectedCategory === category.name && !selectedSubcategory
                            ? 'bg-blue-50 text-blue-600 font-medium border-blue-500'
                            : selectedCategory === category.name
                            ? 'text-blue-600 border-transparent'
                            : 'border-transparent text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <span className="truncate flex-1">{category.name}</span>
                        <span className="text-xs text-gray-400 shrink-0">({category.avatars.length})</span>
                      </div>
                      {expandedCategory === category.name && category.subcategories && (
                        <div className="bg-gray-100">
                          {category.subcategories.map(subcategory => (
                            <div key={subcategory.name}>
                              <div
                                onClick={() => {
                                  setSelectedCategory(category.name);
                                  setSelectedSubcategory(subcategory.name);
                                  setSelectedLeafSubcategory('');
                                }}
                                className={`flex items-center pl-8 pr-4 py-1.5 cursor-pointer text-xs border-l-2 transition-colors ${
                                  selectedSubcategory === subcategory.name
                                    ? 'bg-blue-50 text-blue-600 border-blue-500'
                                    : 'border-transparent text-gray-500 hover:bg-gray-200'
                                }`}
                              >
                                <span className="truncate">{subcategory.name}</span>
                                <span className="ml-auto text-xs text-gray-400 shrink-0">({subcategory.avatars.length})</span>
                              </div>
                              {selectedSubcategory === subcategory.name && subcategory.subcategories && (
                                <div className="bg-gray-50">
                                  {subcategory.subcategories.map((leafSubcategory) => (
                                    <div
                                      key={leafSubcategory.name}
                                      onClick={() => setSelectedLeafSubcategory(leafSubcategory.name)}
                                      className={`flex items-center pl-12 pr-4 py-1.5 cursor-pointer text-xs border-l-2 transition-colors ${
                                        selectedLeafSubcategory === leafSubcategory.name
                                          ? 'bg-indigo-50 text-indigo-600 border-indigo-500'
                                          : 'border-transparent text-gray-500 hover:bg-gray-100'
                                      }`}
                                    >
                                      <span className="truncate">{leafSubcategory.name}</span>
                                      <span className="ml-auto text-xs text-gray-400 shrink-0">({leafSubcategory.avatars.length})</span>
                                    </div>
                                  ))}
                                </div>
                              )}
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
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
              {filteredAvatars.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-gray-400">
                  未找到匹配的头像
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
                  {filteredAvatars.map((avatarName) => {
                    const avatarPath = getAvatarPath(avatarName);
                    const isSelected = currentAvatar === avatarName;
                    const isPreviewing = hoveredAvatar === avatarName;

                    return (
                      <div
                        key={avatarName}
                        ref={(node) => {
                          if (node) {
                            avatarItemRefs.current.set(avatarName, node);
                          } else {
                            avatarItemRefs.current.delete(avatarName);
                          }
                        }}
                        onClick={() => setHoveredAvatar(avatarName)}
                        onDoubleClick={() => handleSelectAvatar(avatarName)}
                        className={`group relative flex flex-col items-center gap-1 rounded-lg p-1.5 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-2 border-blue-500 bg-blue-50 shadow-sm'
                            : isPreviewing
                              ? 'border-2 border-indigo-400 bg-indigo-50 shadow-sm'
                              : 'border border-gray-200 bg-white hover:border-blue-300 hover:-translate-y-0.5 hover:shadow-md'
                        }`}
                      >
                        {avatarPath ? (
                          <>
                            <div className="relative rounded-md overflow-hidden" style={{ width: '72px', height: '72px' }}>
                              <img
                                src={avatarPath}
                                alt={avatarName}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none rounded-md" />
                            </div>
                            <div className="w-full text-xs text-gray-500 text-center leading-tight line-clamp-2 break-all">
                              {avatarName}
                            </div>
                          </>
                        ) : (
                          <div className="w-full text-xs text-gray-400 text-center py-6">
                            图片缺失
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="relative shrink-0 border-t border-gray-200 bg-white transition-all duration-300" style={{ height: isProofreadCollapsed ? COLLAPSED_PROOFREAD_HEIGHT : proofreadHeight + COLLAPSED_PROOFREAD_HEIGHT }}>
              {/* 折叠/展开按钮 - 固定在顶部 */}
              <div className="relative h-10 px-3 py-2 flex items-center justify-between gap-3 shrink-0 bg-white border-b border-gray-200">
                <button
                  onClick={() => setIsProofreadCollapsed((v) => !v)}
                  className="flex items-center gap-2 min-w-0 hover:bg-gray-50 px-2 py-1 rounded transition-colors"
                  title={isProofreadCollapsed ? '展开校对图片' : '收起校对图片'}
                >
                  <ChevronUp className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isProofreadCollapsed ? 'rotate-180' : 'rotate-0'}`} />
                  <ImageIcon size={13} className={isProofreadCollapsed ? 'text-gray-400' : 'text-indigo-400'} />
                  <span className={`text-xs tracking-widest ${isProofreadCollapsed ? 'text-gray-400' : 'text-indigo-500 font-medium'}`}>
                    校对图片
                  </span>
                </button>
              </div>

              {/* 可展开的内容区域 */}
              {!isProofreadCollapsed && (
                <div className="relative bg-white" style={{ height: proofreadHeight }}>
                  <div
                    onMouseDown={handleProofreadResizeMouseDown}
                    className="absolute top-0 left-0 right-0 h-1.5 cursor-row-resize z-10 group"
                    title="拖动调整高度"
                  >
                    <div className="absolute inset-x-0 top-0 h-1 bg-transparent group-hover:bg-indigo-400 transition-colors" />
                  </div>
                  <div className="h-full overflow-hidden">
                    <CompactGallery
                      frames={extractedFrames}
                      onDelete={onDeleteFrames}
                      onJumpToTime={onJumpToTime}
                      activeVideo={activeVideo}
                      videoSrc={videoSrc}
                      sharedVideoRef={sharedVideoRef}
                      roi={roi}
                      onCaptureFrame={onCaptureFrame}
                      selectedReferenceFrameId={selectedReferenceFrameId}
                      onSelectReferenceFrame={handleSelectReferenceFrame}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            className="border-l border-gray-200 bg-gray-50 shrink-0 flex flex-col relative transition-all duration-300"
            style={{ width: isPreviewCollapsed ? COLLAPSED_PREVIEW_WIDTH : previewWidth }}
          >
            {isPreviewCollapsed ? (
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
              <>
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
                  <div className="flex flex-col gap-4 p-4 flex-1 overflow-y-auto">
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
                      <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg px-1.5 py-1 shadow-sm">
                        <button
                          onClick={() => setZoom((z) => Math.max(z / 1.3, 0.5))}
                          className="p-0.5 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                          title="缩小"
                        >
                          <ZoomOut size={13} />
                        </button>
                        <span className="text-xs text-gray-500 w-9 text-center tabular-nums">
                          {Math.round(zoom * 100)}%
                        </span>
                        <button
                          onClick={() => setZoom((z) => Math.min(z * 1.3, 8))}
                          className="p-0.5 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                          title="放大"
                        >
                          <ZoomIn size={13} />
                        </button>
                        <div className="w-px h-3 bg-gray-200 mx-0.5" />
                        <button
                          onClick={() => {
                            setZoom(1);
                            setPanOffset({ x: 0, y: 0 });
                          }}
                          className="p-0.5 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                          title="重置"
                        >
                          <RotateCcw size={13} />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm font-medium text-gray-800 text-center leading-snug break-all">
                      {hoveredAvatar}
                    </p>

                    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">头像参考</span>
                        {selectedReferenceFrame && (
                          <span className="text-[11px] text-emerald-600 truncate max-w-[120px]" title={selectedReferenceFrame.filename}>
                            {selectedReferenceFrame.filename}
                          </span>
                        )}
                      </div>

                      {!selectedReferenceFrame && (
                        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-400">
                          在下方校对图片里点“设为参考”，会自动裁出左右头像区域
                        </div>
                      )}

                      {selectedReferenceFrame && isGeneratingReferencePreview && (
                        <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50 px-3 py-4 text-center text-xs text-emerald-600">
                          正在生成左右头像参考图…
                        </div>
                      )}

                      {selectedReferenceFrame && referencePreviewError && (
                        <div className="rounded-lg border border-dashed border-red-200 bg-red-50 px-3 py-4 text-center text-xs text-red-500">
                          {referencePreviewError}
                        </div>
                      )}

                      {selectedReferenceFrame && avatarReferencePreview && (
                        <div className="space-y-3">
                          <div>
                            <div className="mb-1 text-[11px] font-medium text-gray-500">原图</div>
                            <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                              <img
                                src={avatarReferencePreview.frameUrl}
                                alt="校对参考图"
                                className="block h-24 w-full object-contain"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <div className="mb-1 text-[11px] font-medium text-gray-500">左侧头像</div>
                              <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                                <img
                                  src={avatarReferencePreview.left}
                                  alt="左侧头像参考"
                                  className="block aspect-[3/4] w-full object-cover"
                                />
                              </div>
                            </div>
                            <div>
                              <div className="mb-1 text-[11px] font-medium text-gray-500">右侧头像</div>
                              <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                                <img
                                  src={avatarReferencePreview.right}
                                  alt="右侧头像参考"
                                  className="block aspect-[3/4] w-full object-cover"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 w-full">
                      <button
                        onClick={() => handleSelectAvatar(hoveredAvatar)}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                          isPreviewSelected
                            ? 'bg-blue-100 text-blue-500 border border-blue-200 cursor-default'
                            : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-blue-200'
                        }`}
                        disabled={isPreviewSelected}
                      >
                        {isPreviewSelected ? '使用中' : '选择'}
                      </button>
                      <button
                        onClick={() => toggleFavorite(hoveredAvatar)}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 ${
                          isPreviewFavorite
                            ? 'bg-amber-400 text-white border border-amber-400 hover:bg-amber-500 shadow-amber-200'
                            : 'bg-white text-gray-500 border border-gray-200 hover:border-amber-300 hover:text-amber-500 hover:bg-amber-50'
                        }`}
                      >
                        <Star size={13} fill={isPreviewFavorite ? 'currentColor' : 'none'} strokeWidth={2} />
                        {isPreviewFavorite ? '已收藏' : '收藏'}
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
