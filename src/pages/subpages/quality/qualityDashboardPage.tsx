// src/pages/subpages/quality/qualityDashboardPage.tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import StatTile from '../../../components/charts/statTile';
import LineChart from '../../../components/charts/lineChart';
import {
  getDashboardSummary,
  getLots,
  getYieldTrend,
  getDefectRateTrend,
  getActiveAlerts,
  type DashboardSummary,
  type LotSummary,
  type TrendPoint,
  type QualityAlert,
} from '../../../services/quality/qualityDashboardService';

const STATUS_LABEL_KEY: Record<LotSummary['status'], string> = {
  'in-progress': 'lotStatus.in-progress',
  completed: 'lotStatus.completed',
  hold: 'lotStatus.hold',
};

const STATUS_TONE: Record<LotSummary['status'], string> = {
  'in-progress': 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  hold: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
};

const SEVERITY_LABEL_KEY: Record<QualityAlert['severity'], string> = {
  info: 'severity.info',
  warning: 'severity.warning',
  critical: 'severity.critical',
};

const SEVERITY_DOT: Record<QualityAlert['severity'], string> = {
  info: 'bg-slate-400',
  warning: 'bg-amber-400',
  critical: 'bg-red-400',
};

const SEVERITY_TEXT: Record<QualityAlert['severity'], string> = {
  info: 'text-slate-300',
  warning: 'text-amber-300',
  critical: 'text-red-300',
};

export default function QualityDashboardPage() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [lots, setLots] = useState<LotSummary[]>([]);
  const [yieldTrend, setYieldTrend] = useState<TrendPoint[]>([]);
  const [defectRateTrend, setDefectRateTrend] = useState<TrendPoint[]>([]);
  const [alerts, setAlerts] = useState<QualityAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [summaryRes, lotsRes, yieldRes, defectRes, alertsRes] = await Promise.all([
        getDashboardSummary(),
        getLots(),
        getYieldTrend(),
        getDefectRateTrend(),
        getActiveAlerts(),
      ]);
      setSummary(summaryRes);
      setLots(lotsRes);
      setYieldTrend(yieldRes);
      setDefectRateTrend(defectRes);
      setAlerts(alertsRes);
      setLoading(false);
    })();
  }, []);

  if (loading || !summary) {
    return (
      <div className="w-full max-w-6xl mx-auto">
        <p className="text-slate-400">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <h3 className="text-xl font-bold text-blue-400">{t('qualityDashboard.title')}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label={t('qualityDashboard.avgYield')}
          value={`${summary.avgYieldPct.toFixed(1)}%`}
          delta={{
            rawValue: summary.avgYieldDeltaPct,
            formatted: `${Math.abs(summary.avgYieldDeltaPct).toFixed(1)}%`,
            isGood: summary.avgYieldDeltaPct >= 0,
          }}
        />
        <StatTile
          label={t('qualityDashboard.avgDefectRate')}
          value={`${summary.avgDefectRatePct.toFixed(2)}%`}
          delta={{
            rawValue: summary.avgDefectRateDeltaPct,
            formatted: `${Math.abs(summary.avgDefectRateDeltaPct).toFixed(2)}%`,
            isGood: summary.avgDefectRateDeltaPct <= 0,
          }}
        />
        <StatTile
          label={t('qualityDashboard.activeAlarms')}
          value={String(summary.activeAlarmCount)}
          tone={summary.activeAlarmCount === 0 ? 'good' : summary.activeAlarmCount >= 3 ? 'critical' : 'warning'}
        />
        <StatTile label={t('qualityDashboard.reviewedLots')} value={String(summary.lotsReviewedCount)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LineChart
          title={t('qualityDashboard.yieldTrend')}
          data={yieldTrend}
          color="#3b82f6"
          valueFormatter={(v) => `${v.toFixed(1)}%`}
        />
        <LineChart
          title={t('qualityDashboard.defectRateTrend')}
          data={defectRateTrend}
          color="#0d9488"
          valueFormatter={(v) => `${v.toFixed(2)}%`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">{t('qualityDashboard.activeAlertsPanel')}</h4>
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-400">{t('qualityDashboard.noActiveAlerts')}</p>
          ) : (
            <ul className="space-y-3">
              {alerts.map((alert) => (
                <li key={alert.id} className="text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${SEVERITY_DOT[alert.severity]}`} />
                    <span className={`text-xs font-semibold ${SEVERITY_TEXT[alert.severity]}`}>
                      {t(SEVERITY_LABEL_KEY[alert.severity])}
                    </span>
                    <span className="text-xs text-slate-500">· {alert.lotNumber}</span>
                  </div>
                  <p className="text-slate-300 mt-0.5">{t(alert.messageKey, alert.messageParams)}</p>
                  <p className="text-xs text-slate-500">{alert.createdAt}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-5 overflow-x-auto">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">{t('qualityDashboard.lotList')}</h4>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="py-2 pr-4">{t('qualityDashboard.colLot')}</th>
                <th className="py-2 pr-4">{t('qualityDashboard.colProduct')}</th>
                <th className="py-2 pr-4">{t('qualityDashboard.colStatus')}</th>
                <th className="py-2 pr-4">{t('qualityDashboard.colYield')}</th>
                <th className="py-2 pr-4">{t('qualityDashboard.colDefectRate')}</th>
                <th className="py-2 pr-4">{t('qualityDashboard.colStartTime')}</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => (
                <tr key={lot.id} className="border-b border-slate-700/50 text-slate-200">
                  <td className="py-2 pr-4 font-medium">{lot.lotNumber}</td>
                  <td className="py-2 pr-4 text-slate-300">{lot.product}</td>
                  <td className="py-2 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${STATUS_TONE[lot.status]}`}>
                      {t(STATUS_LABEL_KEY[lot.status])}
                    </span>
                  </td>
                  <td className="py-2 pr-4 tabular-nums">{lot.yieldPct.toFixed(1)}%</td>
                  <td className="py-2 pr-4 tabular-nums">{lot.defectRatePct.toFixed(1)}%</td>
                  <td className="py-2 pr-4 text-slate-400">{lot.startTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
