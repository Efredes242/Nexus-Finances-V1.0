import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Sistema de notificaciones unificado para reemplazar `alert()` (que bloquea el thread y
// rompe la accesibilidad mobile). El toast es no-bloqueante, auto-dismiss, y se apila si hay varios.

export type ToastVariant = 'success' | 'error' | 'info' | 'warn';

interface Toast {
  id: string;
  variant: ToastVariant;
  message: string;
  durationMs: number;
}

interface ToastContextValue {
  show: (message: string, opts?: { variant?: ToastVariant; durationMs?: number }) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; icon: string; iconColor: string }> = {
  success: { bg: 'bg-emerald-900/90', border: 'border-emerald-500/40', icon: 'fa-check-circle', iconColor: 'text-emerald-400' },
  error: { bg: 'bg-rose-900/90', border: 'border-rose-500/40', icon: 'fa-circle-exclamation', iconColor: 'text-rose-400' },
  warn: { bg: 'bg-amber-900/90', border: 'border-amber-500/40', icon: 'fa-triangle-exclamation', iconColor: 'text-amber-400' },
  info: { bg: 'bg-slate-900/90', border: 'border-slate-500/40', icon: 'fa-circle-info', iconColor: 'text-slate-300' },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((message: string, opts?: { variant?: ToastVariant; durationMs?: number }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const toast: Toast = {
      id,
      variant: opts?.variant || 'info',
      message,
      durationMs: opts?.durationMs ?? 4000,
    };
    setToasts(prev => [...prev, toast]);
    if (toast.durationMs > 0) {
      setTimeout(() => remove(id), toast.durationMs);
    }
  }, [remove]);

  const value: ToastContextValue = {
    show,
    success: (m) => show(m, { variant: 'success' }),
    error: (m) => show(m, { variant: 'error', durationMs: 6000 }),
    info: (m) => show(m, { variant: 'info' }),
    warn: (m) => show(m, { variant: 'warn', durationMs: 5000 }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[300] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map(t => {
          const s = VARIANT_STYLES[t.variant];
          return (
            <div
              key={t.id}
              role="alert"
              className={`pointer-events-auto ${s.bg} ${s.border} border backdrop-blur-md rounded-xl px-4 py-3 shadow-2xl flex items-start gap-3 animate-in slide-in-from-right-4 fade-in duration-200`}
            >
              <i className={`fas ${s.icon} ${s.iconColor} text-base mt-0.5 shrink-0`}></i>
              <p className="text-sm font-bold text-white leading-snug flex-1">{t.message}</p>
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="text-slate-400 hover:text-white transition-colors text-xs ml-1"
                aria-label="Cerrar notificación"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback para componentes que se pueden renderizar fuera del provider durante hot reload
    // o tests. Usa `console` en lugar de romper la app.
    return {
      show: (m) => console.log('[toast]', m),
      success: (m) => console.log('[toast.success]', m),
      error: (m) => console.error('[toast.error]', m),
      info: (m) => console.log('[toast.info]', m),
      warn: (m) => console.warn('[toast.warn]', m),
    };
  }
  return ctx;
};
