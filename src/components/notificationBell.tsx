// src/components/notificationBell.tsx
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../contexts/useNotifications';
import { SEVERITY_DOT, SEVERITY_LABEL_KEY, SOURCE_LABEL_KEY } from '../constants/alertLabels';

interface NotificationBellProps {
  onViewAll?: () => void;
}

export default function NotificationBell({ onViewAll }: NotificationBellProps) {
  const { t } = useTranslation();
  const { notifications, unreadCount, connectionStatus, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const recent = notifications.slice(0, 8);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t('navbar.notificationsAria')}
        className="relative p-2 rounded hover:bg-slate-700 transition-colors"
      >
        <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        <span
          className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${
            connectionStatus === 'connected' ? 'bg-emerald-400' : 'bg-slate-500'
          }`}
        />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[10px] leading-4 text-white text-center font-semibold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
            <span className="text-sm font-semibold text-slate-200">{t('notifications.title')}</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-400 hover:underline">
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-700/50">
            {recent.length === 0 ? (
              <p className="text-sm text-slate-400 p-4">{t('notifications.empty')}</p>
            ) : (
              recent.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`p-3 cursor-pointer transition-colors ${
                    n.read ? 'hover:bg-slate-700/30' : 'bg-blue-500/5 hover:bg-blue-500/10'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${SEVERITY_DOT[n.severity]}`} />
                    <span className="text-xs font-semibold text-slate-300">{t(SEVERITY_LABEL_KEY[n.severity])}</span>
                    <span className="text-xs text-slate-500">· {t(SOURCE_LABEL_KEY[n.source])}</span>
                  </div>
                  <p className="text-sm text-slate-200 mt-0.5 line-clamp-2">{t(n.messageKey, n.messageParams)}</p>
                </div>
              ))
            )}
          </div>

          {onViewAll && (
            <button
              onClick={() => {
                setOpen(false);
                onViewAll();
              }}
              className="w-full text-center text-xs text-blue-400 hover:bg-slate-700/50 py-2 border-t border-slate-700"
            >
              {t('notifications.viewAll')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
