import React, { ReactNode } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface CenteredModalProps {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  headerIcon?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  zIndexClassName?: string;
  overlayClassName?: string;
  panelClassName?: string;
  bodyClassName?: string | null;
  footerClassName?: string | null;
  closeOnOverlay?: boolean;
  showCloseButton?: boolean;
  closeButtonDisabled?: boolean;
  usePortal?: boolean;
  portalTarget?: Element | DocumentFragment | null;
}

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

const CenteredModal: React.FC<CenteredModalProps> = ({
  open,
  onClose,
  title,
  headerIcon,
  headerActions,
  children,
  footer,
  zIndexClassName = 'z-50',
  overlayClassName = 'bg-black/[0.35] p-4',
  panelClassName = 'w-full max-w-lg flex flex-col rounded-2xl bg-white shadow-2xl',
  bodyClassName = 'p-5 flex flex-col gap-5 overflow-y-auto max-h-[70vh]',
  footerClassName = 'flex flex-row-reverse gap-2 rounded-b-2xl border-t border-gray-100 bg-gray-50 px-5 py-4',
  closeOnOverlay = true,
  showCloseButton = true,
  closeButtonDisabled = false,
  usePortal = false,
  portalTarget,
}) => {
  if (!open) return null;

  const hasHeader = title !== undefined || headerIcon !== undefined || headerActions !== undefined || showCloseButton;
  const content = (
    <div
      className={cx('fixed inset-0 flex items-center justify-center', zIndexClassName, overlayClassName)}
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <div
        className={cx('animate-baimiao-modal-in overflow-hidden', panelClassName)}
        onClick={(e) => e.stopPropagation()}
      >
        {hasHeader && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex min-w-0 items-center gap-2">
              {headerIcon}
              {title !== undefined && <span className="text-sm font-semibold text-gray-800">{title}</span>}
            </div>
            <div className="flex items-center gap-3">
              {headerActions}
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={closeButtonDisabled}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
                  aria-label="关闭"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {bodyClassName === null ? children : <div className={bodyClassName}>{children}</div>}

        {footer && (footerClassName === null ? footer : <div className={footerClassName}>{footer}</div>)}
      </div>
    </div>
  );

  if (usePortal && typeof document !== 'undefined') {
    return createPortal(content, portalTarget ?? document.body);
  }

  return content;
};

export default CenteredModal;
