// src/components/toast.tsx
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

interface ToastStackProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  durationMs?: number;
}

const SEVERITY_BORDER: Record<ToastItem['severity'], string> = {
  info: 'border-slate-500/40',
  warning: 'border-amber-500/40',
  critical: 'border-red-500/40',
};
const SEVERITY_DOT: Record<ToastItem['severity'], string> = {
  info: 'bg-slate-400',
  warning: 'bg-amber-400',
  critical: 'bg-red-400',
};
const SEVERITY_LABEL_KEY: Record<ToastItem['severity'], string> = {
  info: 'severity.info',
  warning: 'severity.warning',
  critical: 'severity.critical',
};

function Toast({
  toast,
  onDismiss,
  durationMs,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
  durationMs: number;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), durationMs);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss, durationMs]);

  return (
    <div className={`w-80 rounded-lg border shadow-lg p-3 pointer-events-auto bg-slate-800 ${SEVERITY_BORDER[toast.severity]}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${SEVERITY_DOT[toast.severity]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-300">
              {t(SEVERITY_LABEL_KEY[toast.severity])} · {toast.title}
            </span>
            <button onClick={() => onDismiss(toast.id)} className="text-slate-500 hover:text-slate-300 text-xs">
              ✕
            </button>
          </div>
          <p className="text-sm text-white mt-0.5 break-words">{toast.message}</p>
        </div>
      </div>
    </div>
  );
}

export default function ToastStack({ toasts, onDismiss, durationMs = 5000 }: ToastStackProps) {
  return (
    <div className="fixed top-24 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} durationMs={durationMs} />
      ))}
    </div>
  );
}
