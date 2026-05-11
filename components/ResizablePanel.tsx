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
    <div
      ref={panelRef}
      className="relative bg-white border-r border-gray-200 transition-all duration-300 overflow-hidden h-full"
      style={{
        width: isCollapsed ? collapsedWidth : width,
        minWidth: isCollapsed ? collapsedWidth : minWidth,
        maxWidth: isCollapsed ? collapsedWidth : maxWidth
      }}
    >
      {isCollapsed ? (
        // 折叠状态
        <div className="h-full flex flex-col items-center justify-start pt-6 px-2">
          <button
            onClick={toggleCollapse}
            className="p-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
            title="展开面板"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="[writing-mode:vertical-rl] text-xs text-gray-500 mt-3">
            校对图片
          </div>
        </div>
      ) : (
        // 展开状态
        <>
          {/* 内容区域 */}
          <div className="h-full p-2">
            {children}
          </div>

          {/* 折叠按钮 */}
          <button
            onClick={toggleCollapse}
            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors z-10"
            title="折叠面板"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* 拖动手柄 */}
          <div
            onMouseDown={handleMouseDown}
            className={`absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500 transition-colors ${
              isResizing ? 'bg-indigo-500' : 'bg-transparent'
            }`}
            title="拖动调整宽度"
          />

          {/* 拖动时的遮罩提示 */}
          {isResizing && (
            <div className="absolute inset-0 bg-indigo-50 bg-opacity-10 pointer-events-none flex items-center justify-center">
              <div className="bg-indigo-600 text-white px-3 py-1 rounded text-xs">
                {Math.round(width)}px
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ResizablePanel;
