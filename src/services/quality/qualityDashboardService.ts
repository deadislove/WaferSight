import {
  mockLots,
  mockYieldTrend,
  mockDefectRateTrend,
  mockAlerts,
  type LotSummary,
  type TrendPoint,
  type QualityAlert,
} from '../../mocks/data/quality/qualityDashboardMocks';

export type { LotSummary, TrendPoint, QualityAlert };

export interface DashboardSummary {
  avgYieldPct: number;
  avgYieldDeltaPct: number;
  avgDefectRatePct: number;
  avgDefectRateDeltaPct: number;
  activeAlarmCount: number;
  lotsReviewedCount: number;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function windowDelta(points: TrendPoint[]): number {
  const half = Math.floor(points.length / 2);
  const previous = average(points.slice(0, half).map((p) => p.value));
  const current = average(points.slice(half).map((p) => p.value));
  return Math.round((current - previous) * 100) / 100;
}

/**
 * Gets the quality dashboard summary (for the KPI cards).
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const avgYieldPct = Math.round(average(mockLots.map((l) => l.yieldPct)) * 10) / 10;
  const avgDefectRatePct = Math.round(average(mockLots.map((l) => l.defectRatePct)) * 100) / 100;

  return {
    avgYieldPct,
    avgYieldDeltaPct: windowDelta(mockYieldTrend),
    avgDefectRatePct,
    avgDefectRateDeltaPct: windowDelta(mockDefectRateTrend),
    activeAlarmCount: mockAlerts.filter((a) => a.severity === 'warning' || a.severity === 'critical').length,
    lotsReviewedCount: mockLots.filter((l) => l.status === 'completed').length,
  };
}

/**
 * Gets the lot list.
 */
export async function getLots(): Promise<LotSummary[]> {
  return [...mockLots];
}

/**
 * Gets the yield trend (last 30 days).
 */
export async function getYieldTrend(): Promise<TrendPoint[]> {
  return [...mockYieldTrend];
}

/**
 * Gets the defect rate trend (last 30 days).
 */
export async function getDefectRateTrend(): Promise<TrendPoint[]> {
  return [...mockDefectRateTrend];
}

/**
 * Gets the list of currently active alerts.
 */
export async function getActiveAlerts(): Promise<QualityAlert[]> {
  return mockAlerts.filter((a) => a.severity === 'warning' || a.severity === 'critical');
}
