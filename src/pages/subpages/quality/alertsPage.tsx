// src/pages/subpages/quality/alertsPage.tsx
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../../../contexts/notificationContext';
import { SEVERITY_DOT, SEVERITY_LABEL_KEY, SEVERITY_TEXT, SOURCE_LABEL_KEY } from '../../../constants/alertLabels';
import type { LiveAlert } from '../../../services/quality/alertsService';

type SeverityFilter = 'all' | LiveAlert['severity'];

export default function AlertsPage() {
  const { t } = useTranslation();

  const { notifications, unreadCount, connectionStatus, markRead, markAllRead } = useNotifications();
  const [filter, setFilter] = useState<SeverityFilter>('all');

  const filteredAlerts = useMemo(
    () => (filter === 'all' ? notifications : notifications.filter((a) => a.severity === filter)),
    [notifications, filter]
  );

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-blue-400">{t('alerts.title')}</h3>
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            {connectionStatus === 'connected' ? t('alerts.liveConnected') : t('alerts.connecting')}
          </span>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="px-3 py-1.5 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
          >
            {t('alerts.markAllReadCount', { count: unreadCount })}
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded p-1 w-fit">
        {(['all', 'critical', 'warning', 'info'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              filter === key ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
            }`}
          >
            {key === 'all' ? t('severity.all') : t(SEVERITY_LABEL_KEY[key])}
          </button>
        ))}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl divide-y divide-slate-700/50">
        {filteredAlerts.length === 0 ? (
          <p className="text-sm text-slate-400 p-5">{t('alerts.noResults')}</p>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => markRead(alert.id)}
              className={`p-4 cursor-pointer transition-colors ${
                alert.read ? 'hover:bg-slate-700/30' : 'bg-blue-500/5 hover:bg-blue-500/10'
              }`}
            >
              <div className="flex items-center gap-2">
                {!alert.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                <span className={`w-2 h-2 rounded-full ${SEVERITY_DOT[alert.severity]}`} />
                <span className={`text-xs font-semibold ${SEVERITY_TEXT[alert.severity]}`}>
                  {t(SEVERITY_LABEL_KEY[alert.severity])}
                </span>
                <span className="text-xs text-slate-500">· {t(SOURCE_LABEL_KEY[alert.source])}</span>
                {alert.lotNumber && <span className="text-xs text-slate-500">· {alert.lotNumber}</span>}
              </div>
              <p className="text-sm text-slate-200 mt-1">{t(alert.messageKey, alert.messageParams)}</p>
              <p className="text-xs text-slate-500 mt-0.5">{new Date(alert.createdAt).toLocaleTimeString('zh-TW')}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
