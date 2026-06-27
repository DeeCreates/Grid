// src/components/ui/Toaster.tsx
import { useState, useEffect } from 'react';
import { Toast, ToastType } from './Toast';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

let toastId = 0;

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    // @ts-ignore - Add global toast function
    window.showToast = (type: ToastType, title: string, message?: string) => {
      const id = String(toastId++);
      setToasts(prev => [...prev, { id, type, title, message }]);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          onClose={removeToast}
        />
      ))}
    </div>
  );
}