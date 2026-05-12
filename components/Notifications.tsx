import React, { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

// Types
type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

interface ConfirmOptions {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

interface ChoiceOptions {
  title: string;
  message: string;
  buttons: Array<{ label: string; value: string; variant?: 'primary' | 'danger' | 'default' }>;
  onChoice: (value: string) => void;
}

interface PromptOptions {
  title: string;
  message: string;
  defaultValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

interface AlertOptions {
  title: string;
  message: string;
  onClose: () => void;
}

export interface NotificationContextType {
  addToast: (message: string, type?: ToastType) => void;
  showConfirm: (options: Omit<ConfirmOptions, 'onConfirm' | 'onCancel'>) => Promise<boolean>;
  showChoice: (options: Omit<ChoiceOptions, 'onChoice'>) => Promise<string>;
  showPrompt: (options: Omit<PromptOptions, 'onSubmit' | 'onCancel'>) => Promise<string | null>;
  showAlert: (message: string, title?: string) => Promise<void>;
}

export type Notifier = NotificationContextType;

// Context
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifier = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifier must be used within a NotificationProvider');
  }
  return context;
};

// Toast Component
const Toast: React.FC<{ toast: ToastMessage; onDismiss: (id: number) => void }> = ({ toast, onDismiss }) => {
  const [leaving, setLeaving] = useState(false);

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 220);
  }, [toast.id, onDismiss]);

  useEffect(() => {
    const timer = setTimeout(() => {
      dismiss();
    }, 3500);
    return () => clearTimeout(timer);
  }, [dismiss]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />,
    error: <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
  };

  const borderColors = {
    success: 'border-l-green-400',
    error: 'border-l-red-400',
    info: 'border-l-blue-400',
  };

  return (
    <div
      className={`flex items-start gap-3 p-4 bg-white rounded-xl shadow-lg border border-gray-100 border-l-4 ${borderColors[toast.type]} transition-opacity duration-200 ${leaving ? 'animate-toast-out' : 'animate-fade-in-right'}`}
      style={leaving ? { animation: 'toast-pop-out 0.22s ease-in forwards' } : undefined}
    >
      {icons[toast.type]}
      <p className="flex-1 text-sm font-medium text-gray-900 leading-snug">{toast.message}</p>
      <button
        onClick={dismiss}
        className="shrink-0 rounded-md p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label="关闭"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

// Modal Component
const Modal: React.FC<{ isOpen: boolean; children: ReactNode; onClose?: () => void; }> = ({ isOpen, children, onClose }) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-10000 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-modal-in overflow-hidden"
        onMouseDown={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

// Provider
export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmOptions, setConfirmOptions] = useState<ConfirmOptions | null>(null);
  const [choiceOptions, setChoiceOptions] = useState<ChoiceOptions | null>(null);
  const [promptOptions, setPromptOptions] = useState<PromptOptions | null>(null);
  const [alertOptions, setAlertOptions] = useState<AlertOptions | null>(null);

  const [promptValue, setPromptValue] = useState('');


  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);
  
  const showConfirm = useCallback((options: Omit<ConfirmOptions, 'onConfirm' | 'onCancel'>) => {
      return new Promise<boolean>((resolve) => {
        setConfirmOptions({
            ...options,
            onConfirm: () => { setConfirmOptions(null); resolve(true); },
            onCancel: () => { setConfirmOptions(null); resolve(false); }
        });
      });
  }, []);

  const showChoice = useCallback((options: Omit<ChoiceOptions, 'onChoice'>) => {
    return new Promise<string>((resolve) => {
      setChoiceOptions({
        ...options,
        onChoice: (value: string) => { setChoiceOptions(null); resolve(value); }
      });
    });
  }, []);
  
  const handleConfirmClose = () => {
    if (confirmOptions) {
        confirmOptions.onCancel();
    }
  }

  const showPrompt = useCallback((options: Omit<PromptOptions, 'onSubmit' | 'onCancel'>) => {
    return new Promise<string | null>((resolve) => {
      setPromptValue(options.defaultValue || '');
      setPromptOptions({
        ...options,
        onSubmit: (value: string) => { setPromptOptions(null); resolve(value); },
        onCancel: () => { setPromptOptions(null); resolve(null); }
      });
    });
  }, []);
  
  const handlePromptClose = () => {
    if (promptOptions) {
        promptOptions.onCancel();
    }
  }

  const handlePromptSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(promptOptions) {
          promptOptions.onSubmit(promptValue);
      }
  }

  const showAlert = useCallback((message: string, title: string = '提示') => {
    return new Promise<void>((resolve) => {
      setAlertOptions({
        title,
        message,
        onClose: () => { setAlertOptions(null); resolve(); }
      });
    });
  }, []);

  const handleAlertClose = () => {
    if (alertOptions) {
      alertOptions.onClose();
    }
  };

  const value = { addToast, showConfirm, showChoice, showPrompt, showAlert };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      
      <div className="fixed top-14 left-1/2 -translate-x-1/2 z-10001 space-y-2 w-full max-w-sm px-4">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
      
      <Modal isOpen={!!confirmOptions} onClose={handleConfirmClose}>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-yellow-100">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-gray-900 leading-snug">{confirmOptions?.title}</h3>
              <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{confirmOptions?.message}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-row-reverse gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
            onClick={confirmOptions?.onConfirm}
          >
            确认
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            onClick={confirmOptions?.onCancel}
          >
            取消
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!choiceOptions} onClose={() => choiceOptions?.onChoice('cancel')}>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-yellow-100">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-gray-900 leading-snug">{choiceOptions?.title}</h3>
              <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{choiceOptions?.message}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-row-reverse gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
          {choiceOptions?.buttons.map((btn) => {
            const variantClass =
              btn.variant === 'primary'
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                : btn.variant === 'danger'
                ? 'bg-red-600 text-white hover:bg-red-700 shadow-sm'
                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50';
            return (
              <button
                key={btn.value}
                type="button"
                className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors ${variantClass}`}
                onClick={() => choiceOptions.onChoice(btn.value)}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
      </Modal>

      <Modal isOpen={!!promptOptions} onClose={handlePromptClose}>
        <form onSubmit={handlePromptSubmit}>
          <div className="p-6">
            <h3 className="text-base font-semibold text-gray-900 leading-snug">{promptOptions?.title}</h3>
            <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{promptOptions?.message}</p>
            <input
              type="text"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              className="mt-4 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              autoFocus
              required
            />
          </div>
          <div className="flex flex-row-reverse gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
            >
              提交
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={promptOptions?.onCancel}
            >
              取消
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!alertOptions} onClose={handleAlertClose}>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-blue-100">
              <Info className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-gray-900 leading-snug">{alertOptions?.title}</h3>
              <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{alertOptions?.message}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-row-reverse gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
            onClick={alertOptions?.onClose}
          >
            确定
          </button>
        </div>
      </Modal>
    </NotificationContext.Provider>
  );
};
