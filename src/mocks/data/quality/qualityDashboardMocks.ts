export interface LotSummary {
  id: string;
  lotNumber: string;
  product: string;
  startTime: string; // ISO date
  status: 'in-progress' | 'completed' | 'hold';
  yieldPct: number; // 0-100
  defectRatePct: number; // 0-100
}

export interface TrendPoint {
  date: string; // ISO date (day)
  value: number;
}

export interface QualityAlert {
  id: string;
  lotNumber: string;
  // i18next key + interpolation params, same convention as LiveAlert in
  // src/mocks/api/alertsApi.ts — resolve with t(messageKey, messageParams).
  messageKey: string;
  messageParams?: Record<string, string | number>;
  createdAt: string;
  severity: 'info' | 'warning' | 'critical';
}

const PRODUCTS = ['12nm-LogicA', '7nm-RF-B', '28nm-PowerC', '5nm-LogicD', '16nm-MixedE'];
const STATUSES: LotSummary['status'][] = ['completed', 'in-progress', 'hold'];

function isoDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// 30-day mock trend, deterministic (no Math.random) so the dashboard looks
// the same across reloads: a gentle upward drift with a weekly wobble.
function buildYieldTrend(days: number): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayIndex = days - 1 - i;
    const value = 90 + dayIndex * 0.15 + 2 * Math.sin(dayIndex / 3);
    points.push({ date: isoDaysAgo(i), value: Math.round(Math.min(100, Math.max(0, value)) * 10) / 10 });
  }
  return points;
}

function buildDefectRateTrend(days: number): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayIndex = days - 1 - i;
    const value = 4 - dayIndex * 0.03 + 0.8 * Math.sin(dayIndex / 4 + 1);
    points.push({ date: isoDaysAgo(i), value: Math.round(Math.max(0, value) * 100) / 100 });
  }
  return points;
}

export const mockYieldTrend: TrendPoint[] = buildYieldTrend(30);
export const mockDefectRateTrend: TrendPoint[] = buildDefectRateTrend(30);

export const mockLots: LotSummary[] = Array.from({ length: 15 }, (_, i) => {
  const status = STATUSES[i % 3 === 0 ? 0 : i % 5 === 0 ? 2 : i % 7 === 0 ? 1 : 0];
  const yieldPct = Math.round((88 + ((i * 7) % 12) - (status === 'hold' ? 15 : 0)) * 10) / 10;
  const defectRatePct = Math.round((100 - yieldPct) * 0.35 * 10) / 10;
  return {
    id: `lot-${i + 1}`,
    lotNumber: `L-2026-${String(1000 + i)}`,
    product: PRODUCTS[i % PRODUCTS.length],
    startTime: isoDaysAgo(29 - i * 2),
    status,
    yieldPct,
    defectRatePct,
  };
});

export const mockAlerts: QualityAlert[] = [
  {
    id: 'alert-1',
    lotNumber: 'L-2026-1004',
    messageKey: 'alerts.mock.spcTempRun8',
    createdAt: isoDaysAgo(0),
    severity: 'critical',
  },
  {
    id: 'alert-2',
    lotNumber: 'L-2026-1009',
    messageKey: 'alerts.mock.defectRateExceeded',
    messageParams: { pct: 5.2 },
    createdAt: isoDaysAgo(1),
    severity: 'warning',
  },
  {
    id: 'alert-3',
    lotNumber: 'L-2026-1002',
    messageKey: 'alerts.mock.spcPressureBeyond3Sigma',
    createdAt: isoDaysAgo(2),
    severity: 'critical',
  },
  {
    id: 'alert-4',
    lotNumber: 'L-2026-1012',
    messageKey: 'alerts.mock.yieldDroppedFromPrevious',
    messageParams: { pct: 4.1 },
    createdAt: isoDaysAgo(3),
    severity: 'warning',
  },
  {
    id: 'alert-5',
    lotNumber: 'L-2026-1007',
    messageKey: 'alerts.mock.processParamsNormal',
    createdAt: isoDaysAgo(4),
    severity: 'info',
  },
];
