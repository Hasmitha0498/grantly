'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

type Tone = 'success' | 'error';
interface ToastMsg {
  id: number;
  message: string;
  tone: Tone;
  retry?: () => void;
}

const ToastContext = createContext<{ notify: (message: string, tone?: Tone, retry?: () => void) => void }>({
  notify: () => undefined,
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const notify = useCallback((message: string, tone: Tone = 'success', retry?: () => void) => {
    seq.current += 1;
    const id = seq.current;
    setToasts((t) => [...t.slice(-2), { id, message, tone, retry }]);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:pr-6"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMsg; onDismiss: (id: number) => void }) {
  useEffect(() => {
    if (toast.tone === 'error') return;
    const t = setTimeout(() => onDismiss(toast.id), 4500);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  const Icon = toast.tone === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div
      className={`animate-rise pointer-events-auto flex max-w-md items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${
        toast.tone === 'success' ? 'bg-forest text-white' : 'bg-danger text-white'
      }`}
    >
      <Icon aria-hidden="true" size={18} />
      <span>{toast.message}</span>
      {toast.retry ? (
        <button
          type="button"
          className="rounded-md bg-white/15 px-2 py-1 underline-offset-2 hover:bg-white/25"
          onClick={() => {
            onDismiss(toast.id);
            toast.retry?.();
          }}
        >
          Retry
        </button>
      ) : null}
      <button type="button" aria-label="Dismiss message" className="rounded-md p-1 hover:bg-white/15" onClick={() => onDismiss(toast.id)}>
        <X aria-hidden="true" size={16} />
      </button>
    </div>
  );
}
