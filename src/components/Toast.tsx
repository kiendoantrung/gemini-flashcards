import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import { ToastContext, type ToastType } from './toastContext';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

const ToastItem = ({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => setIsVisible(true), 10);

    // Auto remove after 4 seconds
    let removeTimer: ReturnType<typeof setTimeout>;
    const autoHideTimer = setTimeout(() => {
      setIsLeaving(true);
      removeTimer = setTimeout(() => onRemove(toast.id), 300);
    }, 4000);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(autoHideTimer);
      clearTimeout(removeTimer);
    };
  }, [toast.id, onRemove]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-duo-green flex-shrink-0" />,
    error: <XCircle className="w-5 h-5 text-duo-red flex-shrink-0" />,
    warning: <AlertCircle className="w-5 h-5 text-duo-gold-dark flex-shrink-0" />,
  };

  const bgColors = {
    success: 'bg-duo-green-subtle/90 border-duo-green',
    error: 'bg-duo-red-subtle/90 border-duo-red',
    warning: 'bg-duo-gold-subtle/90 border-duo-gold',
  };

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 shadow-duo-modal
        ${bgColors[toast.type]}
        transform transition-all duration-300 ease-out
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-full opacity-0 scale-95'}
      `}
    >
      {icons[toast.type]}
      <p className="flex-1 text-sm font-bold text-duo-charcoal">
        {toast.message}
      </p>
      <button
        onClick={handleClose}
        className="p-1 hover:bg-duo-charcoal/10 rounded-full transition-colors"
      >
        <X className="w-4 h-4 text-duo-pencil" />
      </button>
    </div>
  );
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
