import React from 'react';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';

type SidebarSide = 'left' | 'right';

interface CollapsibleSidebarProps {
  side: SidebarSide;
  title: string;
  collapsed: boolean;
  expandedWidth: number | string;
  collapsedWidth?: number;
  onExpand?: () => void;
  onCollapse?: () => void;
  onToggle?: () => void;
  children?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  collapsedContainerClassName?: string;
  collapsedButtonClassName?: string;
  collapsedLabelClassName?: string;
  headerTitleClassName?: string;
  expandTitle?: string;
  collapseTitle?: string;
  headerStart?: React.ReactNode;
  headerEnd?: React.ReactNode;
  resizeHandle?: React.ReactNode;
}

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({
  side,
  title,
  collapsed,
  expandedWidth,
  collapsedWidth = 40,
  onExpand,
  onCollapse,
  onToggle,
  children,
  className = '',
  headerClassName = '',
  bodyClassName = 'flex-1 overflow-hidden',
  collapsedContainerClassName = '',
  collapsedButtonClassName = 'bg-indigo-600 text-white hover:bg-indigo-700',
  collapsedLabelClassName = 'text-gray-500',
  headerTitleClassName = 'text-xs font-medium text-gray-700 shrink-0',
  expandTitle,
  collapseTitle,
  headerStart,
  headerEnd,
  resizeHandle,
}) => {
  const borderClassName = side === 'left' ? 'border-r border-gray-200' : 'border-l border-gray-200';
  const openButton = side === 'left'
    ? <PanelLeftOpen className="w-3.5 h-3.5" />
    : <PanelRightOpen className="w-3.5 h-3.5" />;
  const closeButton = side === 'left'
    ? <PanelLeftClose className="w-4 h-4" />
    : <PanelRightClose className="w-4 h-4" />;

  const handleExpand = onExpand ?? onToggle;
  const handleCollapse = onCollapse ?? onToggle;
  const collapsedButtonBaseClassName = 'rounded-lg p-1.5 transition-colors';
  const collapsedLabelBaseClassName = 'mt-2.5 text-[11px] leading-none select-none';

  return (
    <div
      className={cx(
        borderClassName,
        'shrink-0 flex flex-col relative transition-all duration-300 h-full',
        className,
      )}
      style={{ width: collapsed ? collapsedWidth : expandedWidth }}
    >
      {collapsed ? (
        <div className={cx('box-border h-full w-full flex flex-col items-center justify-start pt-6 px-2', collapsedContainerClassName)}>
          <button
            type="button"
            onClick={handleExpand}
            className={cx(collapsedButtonBaseClassName, collapsedButtonClassName)}
            title={expandTitle ?? `展开${title}`}
          >
            {openButton}
          </button>
          <div className={cx('[writing-mode:vertical-rl]', collapsedLabelBaseClassName, collapsedLabelClassName)}>
            {title}
          </div>
        </div>
      ) : (
        <>
          {resizeHandle}
          <div className={cx('px-3 py-2.5 border-b border-gray-200 flex items-center gap-2 shrink-0', headerClassName)}>
            {side === 'right' ? (
              <>
                <button
                  type="button"
                  onClick={handleCollapse}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors shrink-0"
                  title={collapseTitle ?? `折叠${title}`}
                >
                  {closeButton}
                </button>
                {headerStart}
                <span className={headerTitleClassName}>{title}</span>
                <div className="ml-auto" />
                {headerEnd}
              </>
            ) : (
              <>
                {headerStart}
                <span className={headerTitleClassName}>{title}</span>
                <div className="ml-auto" />
                {headerEnd}
                <button
                  type="button"
                  onClick={handleCollapse}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors shrink-0"
                  title={collapseTitle ?? `折叠${title}`}
                >
                  {closeButton}
                </button>
              </>
            )}
          </div>
          <div className={bodyClassName}>
            {children}
          </div>
        </>
      )}
    </div>
  );
};

export default CollapsibleSidebar;
