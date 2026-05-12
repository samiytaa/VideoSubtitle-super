import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ResizablePanelProps {
  children: React.ReactNode;
  defaultWidth?: number | string; // 支持数字(px)或百分比字符串
  minWidth?: number;
  maxWidth?: number;
  collapsedWidth?: number;
  defaultCollapsed?: boolean; // 新增：默认是否折叠
}

const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  defaultWidth = 320,
  minWidth = 200,
  maxWidth = 800,
  collapsedWidth = 48,
  defaultCollapsed = false
}) => {
  // 计算初始宽度
  const getInitialWidth = () => {
    if (typeof defaultWidth === 'string' && (defaultWidth as string).includes('%')) {
      const percentage = parseFloat(defaultWidth as string) / 100;
      return window.innerWidth * percentage;
    }
    return typeof defaultWidth === 'number' ? defaultWidth : 320;
  };

  const [width, setWidth] = useState(getInitialWidth());
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('resizablePanel_collapsed');
    return saved !== null ? saved === 'true' : defaultCollapsed;
  });
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  // 窗口大小改变时重新计算宽度（如果是百分比）
  useEffect(() => {
    if (typeof defaultWidth === 'string' && (defaultWidth as string).includes('%')) {
      const handleResize = () => {
        if (!isCollapsed && !isResizing) {
          const percentage = parseFloat(defaultWidth as string) / 100;
          const newWidth = window.innerWidth * percentage;
          if (newWidth >= minWidth && newWidth <= maxWidth) {
            setWidth(newWidth);
          }
        }
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [defaultWidth, minWidth, maxWidth, isCollapsed, isResizing]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isCollapsed) return;
    
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const delta = e.clientX - startXRef.current;
      const newWidth = startWidthRef.current + delta;

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, minWidth, maxWidth]);

  const toggleCollapse = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    localStorage.setItem('resizablePanel_collapsed', String(newCollapsed));
  };

  return (
    // 外层：overflow-visible，让按钮可以突出边缘
    <div
      className="relative h-full shrink-0 transition-all duration-300"
      style={{
        width: isCollapsed ? collapsedWidth : width,
        minWidth: isCollapsed ? collapsedWidth : minWidth,
        maxWidth: isCollapsed ? collapsedWidth : maxWidth
      }}
    >
      {/* 内层面板：overflow-hidden 裁切内容 */}
      <div
        ref={panelRef}
        className="relative bg-white border-r border-gray-200 overflow-hidden h-full w-full"
      >
        {isCollapsed ? (
          // 折叠状态：只显示竖向文字标签
          <div className="h-full flex flex-col items-center justify-center px-1">
            <div className="[writing-mode:vertical-rl] text-xs text-gray-400 select-none tracking-widest">
              校对图片
            </div>
          </div>
        ) : (
          // 展开状态：内容 + 拖动手柄
          <>
            <div className="h-full p-2">
              {children}
            </div>

            {/* 拖动手柄 */}
            <div
              onMouseDown={handleMouseDown}
              className={`absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors ${
                isResizing ? 'bg-indigo-400' : 'bg-transparent'
              }`}
              title="拖动调整宽度"
            />

            {/* 拖动时的宽度提示 */}
            {isResizing && (
              <div className="absolute inset-0 bg-indigo-50/10 pointer-events-none flex items-center justify-center">
                <div className="bg-indigo-600 text-white px-3 py-1 rounded text-xs shadow">
                  {Math.round(width)}px
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 收缩/展开 toggle 按钮：绝对定位在外层，不受 overflow-hidden 裁切 */}
      <button
        onClick={toggleCollapse}
        className="absolute top-1/2 -translate-y-1/2 -right-3 z-20 flex items-center justify-center w-6 h-14 bg-white border border-gray-200 rounded-r-xl shadow-[2px_2px_8px_rgba(0,0,0,0.10)] hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-[2px_2px_12px_rgba(99,102,241,0.18)] transition-all duration-200 group"
        title={isCollapsed ? '展开面板' : '折叠面板'}
      >
        {isCollapsed
          ? <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-500 transition-colors duration-200" />
          : <ChevronLeft  className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-500 transition-colors duration-200" />
        }
      </button>
    </div>
  );
};

export default ResizablePanel;
