import React, { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface RightSlidePanelProps {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  headerIcon?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  widthClassName?: string;
  zIndexClassName?: string;
  overlayClassName?: string;
  panelClassName?: string;
  bodyClassName?: string | null;
  closeOnOverlay?: boolean;
  showCloseButton?: boolean;
  closeButtonDisabled?: boolean;
  portalTarget?: Element | DocumentFragment | null;
}

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

const EXIT_ANIMATION_MS = 220;

const RightSlidePanel: React.FC<RightSlidePanelProps> = ({
  open,
  onClose,
  title,
  headerIcon,
  headerActions,
  children,
  widthClassName = 'w-96',
  zIndexClassName = 'z-50',
  overlayClassName = 'bg-black/20',
  panelClassName = 'bg-white shadow-2xl',
  bodyClassName = null,
  closeOnOverlay = true,
  showCloseButton = true,
  closeButtonDisabled = false,
  portalTarget,
}) => {
  const [isRendered, setIsRendered] = useState(open);
  const [isVisible, setIsVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setIsRendered(true);
      const frameId = window.requestAnimationFrame(() => setIsVisible(true));
      return () => window.cancelAnimationFrame(frameId);
    }

    setIsVisible(false);
    const timeoutId = window.setTimeout(() => setIsRendered(false), EXIT_ANIMATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  if (!isRendered) return null;
  if (typeof document === 'undefined') return null;

  const hasHeader = title !== undefined || headerIcon !== undefined || headerActions !== undefined || showCloseButton;
  const animationState = isVisible ? 'open' : 'closed';

  return createPortal(
    <div className={cx('fixed inset-0', zIndexClassName)}>
      <div
        data-state={animationState}
        className={cx('right-slide-panel-overlay absolute inset-0', overlayClassName)}
        onClick={closeOnOverlay ? onClose : undefined}
      />

      <div
        data-state={animationState}
        className={cx(
          'right-slide-panel-shell absolute right-0 top-0 bottom-0 flex flex-col overflow-hidden',
          widthClassName,
          panelClassName
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {hasHeader && (
          <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-white p-4">
            <div className="flex min-w-0 items-center gap-2">
              {headerIcon}
              {title !== undefined && <h3 className="text-lg font-semibold text-gray-800">{title}</h3>}
            </div>
            <div className="flex items-center gap-2">
              {headerActions}
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={closeButtonDisabled}
                  className="rounded-lg p-1.5 transition-colors hover:bg-gray-100 disabled:opacity-40"
                  aria-label="关闭"
                  title="关闭"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              )}
            </div>
          </div>
        )}

        {bodyClassName === null ? children : <div className={bodyClassName}>{children}</div>}
      </div>
    </div>,
    portalTarget ?? document.body
  );
};

export default RightSlidePanel;
