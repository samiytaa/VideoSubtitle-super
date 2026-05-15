import React, { useState, useRef, useEffect } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { SIDE_PANEL_COLLAPSED_WIDTH } from './panelConstants';

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
    <div
      className="border-r border-gray-200 bg-gray-50 shrink-0 flex flex-col relative transition-all duration-300 h-full"
      style={{
        width: isCollapsed ? collapsedWidth : width,
        minWidth: isCollapsed ? collapsedWidth : minWidth,
        maxWidth: isCollapsed ? collapsedWidth : maxWidth,
      }}
    >
      {isCollapsed ? (
        // 折叠状态：图标按钮 + 竖排文字（复用 AvatarPicker 左侧分类栏样式）
        <div className="box-border h-full w-full flex flex-col items-center justify-start pt-5 px-1.5">
          <button
            onClick={toggleCollapse}
            className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            title="展开面板"
          >
            <PanelLeftOpen className="w-3.5 h-3.5" />
          </button>
          <div className="[writing-mode:vertical-rl] text-[11px] leading-none text-gray-500 mt-2.5 select-none">
            {label}
          </div>
        </div>
      ) : (
        // 展开状态：标题栏 + 折叠按钮 + 内容（复用 AvatarPicker 左侧分类栏样式）
        <>
          {/* 标题栏 */}
          <div className="px-4 py-2.5 border-b border-gray-200 flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-gray-700 shrink-0">{label}</span>
            <div className="ml-auto" />
            <button
              onClick={toggleCollapse}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors shrink-0"
              title="折叠面板"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* 内容区 */}
          <div
            ref={panelRef}
            className="flex-1 overflow-hidden relative"
          >
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
          </div>
        </>
      )}
    </div>
  );
};

export default ResizablePanel;
