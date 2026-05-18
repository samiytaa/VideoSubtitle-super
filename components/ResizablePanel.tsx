import React, { useState, useRef, useEffect } from 'react';
import { SIDE_PANEL_COLLAPSED_WIDTH } from './panelConstants';
import CollapsibleSidebar from './common/CollapsibleSidebar';

interface ResizablePanelProps {
  children: React.ReactNode;
  defaultWidth?: number | string; // 支持数字(px)或百分比字符串
  minWidth?: number;
  maxWidth?: number;
  collapsedWidth?: number;
  defaultCollapsed?: boolean; // 新增：默认是否折叠
  label?: string; // 折叠时显示的标签文字
}

const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  defaultWidth = 320,
  minWidth = 200,
  maxWidth = 800,
  collapsedWidth = SIDE_PANEL_COLLAPSED_WIDTH,
  defaultCollapsed = false,
  label = '校对图片',
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
    <CollapsibleSidebar
      side="left"
      title={label}
      collapsed={isCollapsed}
      expandedWidth={width}
      collapsedWidth={collapsedWidth}
      onToggle={toggleCollapse}
      className="bg-gray-50"
      bodyClassName="flex-1 overflow-hidden relative"
      expandTitle="展开面板"
      collapseTitle="折叠面板"
      resizeHandle={(
        <div
          onMouseDown={handleMouseDown}
          className={`absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors ${
            isResizing ? 'bg-indigo-400' : 'bg-transparent'
          }`}
          title="拖动调整宽度"
        />
      )}
    >
      <div
        ref={panelRef}
        className="h-full p-2"
        style={{
          minWidth: minWidth,
          maxWidth: maxWidth,
        }}
      >
        {children}
      </div>

      {isResizing && (
        <div className="absolute inset-0 bg-indigo-50/10 pointer-events-none flex items-center justify-center">
          <div className="bg-indigo-600 text-white px-3 py-1 rounded text-xs shadow">
            {Math.round(width)}px
          </div>
        </div>
      )}
    </CollapsibleSidebar>
  );
};

export default ResizablePanel;
