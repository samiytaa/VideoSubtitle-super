import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, ChevronLeft, ChevronRight, X, ZoomIn, Filter } from 'lucide-react';
import { ExtractedFrame, MergedImage } from '../types';

type ProofreadGalleryProps = {
  frames: ExtractedFrame[];
  mergedImages: MergedImage[];
  onJumpToTime?: (timestamp: string) => void;
};

type ViewMode = 'frames' | 'merged';
type GroupFilter = 'all' | 'group1' | 'group2';

const ProofreadGallery: React.FC<ProofreadGalleryProps> = ({
  frames,
  mergedImages,
  onJumpToTime,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('frames');
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(24);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 过滤帧
  const filteredFrames = React.useMemo(() => {
    if (groupFilter === 'all') return frames;
    return frames.filter(f => f.group === groupFilter);
  }, [frames, groupFilter]);

  // 当前显示的项目
  const currentItems = viewMode === 'frames' ? filteredFrames : mergedImages;
  const totalPages = Math.ceil(currentItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayItems = currentItems.slice(startIndex, startIndex + itemsPerPage);

  // 切换视图模式时重置页码
  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode, groupFilter]);

  // 翻页时滚动到顶部
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [currentPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handleImageClick = (url: string) => {
    setSelectedImage(url);
    setImageScale(1);
  };

  const handleClosePreview = () => {
    setSelectedImage(null);
    setImageScale(1);
  };

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImageScale(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImageScale(prev => Math.max(prev - 0.5, 0.5));
  };

  const handleResetZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImageScale(1);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 顶部工具栏 */}
      <div className="flex flex-col gap-2 p-3 border-b border-gray-200 bg-white shadow-sm">
        {/* 第一行：视图切换 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('frames')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                viewMode === 'frames'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              截取图片 ({frames.length})
            </button>
            <button
              onClick={() => setViewMode('merged')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                viewMode === 'merged'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              拼接图片 ({mergedImages.length})
            </button>
          </div>

          {/* 每页数量选择 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">每页显示</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
              <option value={96}>96</option>
            </select>
          </div>
        </div>

        {/* 第二行：分组筛选（仅截取图片模式显示） */}
        {viewMode === 'frames' && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-500">分组筛选：</span>
            <div className="flex gap-1">
              {[
                { key: 'all', label: '全部', count: frames.length },
                { key: 'group1', label: '对话', count: frames.filter(f => f.group === 'group1').length },
                { key: 'group2', label: '地点', count: frames.filter(f => f.group === 'group2').length }
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setGroupFilter(key as GroupFilter)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    groupFilter === key
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 图片网格区域 */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4">
        {currentItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <ImageIcon className="w-20 h-20 mb-4 opacity-30" />
            <p className="text-lg font-medium">
              {viewMode === 'frames' 
                ? (groupFilter === 'all' ? '暂无截取图片' : `暂无${groupFilter === 'group1' ? '对话' : '地点'}图片`)
                : '暂无拼接图片'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {displayItems.map((item) => (
              <div
                key={item.id}
                className="group relative bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-xl hover:border-indigo-300 transition-all cursor-pointer"
                onClick={() => handleImageClick(item.url)}
              >
                <div className="aspect-video relative overflow-hidden bg-gray-100">
                  <img
                    src={item.url}
                    alt={item.filename}
                    className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  {/* 悬浮放大图标 */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-lg">
                      <ZoomIn className="w-4 h-4 text-gray-700" />
                    </div>
                  </div>
                </div>
                
                <div className="p-2 border-t border-gray-100">
                  <p className="text-xs text-gray-600 truncate font-medium" title={item.filename}>
                    {item.filename}
                  </p>
                  {viewMode === 'frames' && 'timestamp' in item && (
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-400">{item.timestamp}</p>
                      {onJumpToTime && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onJumpToTime(item.timestamp);
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium hover:underline"
                        >
                          跳转
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部分页控制 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-3 border-t border-gray-200 bg-white shadow-sm">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            上一页
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              第 <span className="font-semibold text-indigo-600">{currentPage}</span> / {totalPages} 页
            </span>
            <span className="text-xs text-gray-400">
              (共 {currentItems.length} 张)
            </span>
          </div>
          
          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            下一页
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 图片预览弹窗 */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={handleClosePreview}
        >
          <div className="relative max-w-full max-h-full flex items-center justify-center">
            <img
              src={selectedImage}
              alt="预览"
              style={{ transform: `scale(${imageScale})` }}
              className="max-w-full max-h-[90vh] object-contain transition-transform duration-200"
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* 控制按钮组 */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <button
                onClick={handleZoomIn}
                className="p-2 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white transition-colors shadow-lg"
                title="放大"
              >
                <ZoomIn className="w-5 h-5 text-gray-800" />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-2 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white transition-colors shadow-lg"
                title="缩小"
              >
                <ZoomIn className="w-5 h-5 text-gray-800 rotate-180" />
              </button>
              <button
                onClick={handleResetZoom}
                className="p-2 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white transition-colors shadow-lg"
                title="重置缩放"
              >
                <span className="text-xs font-bold text-gray-800">1:1</span>
              </button>
              <button
                onClick={handleClosePreview}
                className="p-2 bg-red-500/90 backdrop-blur-sm rounded-lg hover:bg-red-600 transition-colors shadow-lg"
                title="关闭"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* 缩放比例显示 */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-sm font-medium text-gray-800 shadow-lg">
              {Math.round(imageScale * 100)}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProofreadGallery;
