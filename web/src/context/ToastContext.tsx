import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import IconCircleCheck from '@tabler/icons-react/dist/esm/icons/IconCircleCheck.mjs';
import IconAlertCircle from '@tabler/icons-react/dist/esm/icons/IconAlertCircle.mjs';
import IconInfoCircle from '@tabler/icons-react/dist/esm/icons/IconInfoCircle.mjs';
import IconX from '@tabler/icons-react/dist/esm/icons/IconX.mjs';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastContextValue {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 3000;
const ERROR_DURATION = 0;

const TOAST_ICONS: Record<ToastType, ReactNode> = {
  success: <IconCircleCheck size={18} />,
  error: <IconAlertCircle size={18} />,
  info: <IconInfoCircle size={18} />,
};

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((type: ToastType, message: string, duration?: number) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const dur = duration ?? (type === 'error' ? ERROR_DURATION : DEFAULT_DURATION);
    setToasts((prev) => [...prev, { id, type, message, duration: dur }]);
    if (dur > 0) {
      setTimeout(() => dismiss(id), dur);
    }
  }, [dismiss]);

  const success = useCallback((msg: string, dur?: number) => show('success', msg, dur), [show]);
  const error = useCallback((msg: string, dur?: number) => show('error', msg, dur), [show]);
  const info = useCallback((msg: string, dur?: number) => show('info', msg, dur), [show]);

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span className="toast-icon">{TOAST_ICONS[t.type]}</span>
            <span className="toast-content">{t.message}</span>
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              <IconX size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}