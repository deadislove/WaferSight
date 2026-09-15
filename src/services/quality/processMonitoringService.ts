import {
  PARAMETERS,
  MONITORED_LOTS,
  getMockReadings,
  type ParameterDef,
  type ProcessReading,
  type MonitoredLot,
} from '../../mocks/data/quality/processMonitoringMocks';

export type { ParameterDef, ProcessReading, MonitoredLot };

export interface ControlLimits {
  mean: number;
  sigma: number;
  ucl: number;
  lcl: number;
}

export type RuleId = 'rule1' | 'rule2' | 'rule3' | 'rule4';

export interface SPCViolation {
  id: string;
  lotNumber: string;
  parameter: string;
  rule: RuleId;
  ruleLabel: string;
  pointIndices: number[];
  timestamp: string;
}

const RULE_LABELS: Record<RuleId, string> = {
  rule1: '單點超出 3σ 界限',
  rule2: '連續 3 點中有 2 點超出 2σ (同側)',
  rule3: '連續 5 點中有 4 點超出 1σ (同側)',
  rule4: '連續 8 點位於中心線同側',
};

/**
 * Gets the list of monitorable lots.
 */
export async function getMonitoredLots(): Promise<MonitoredLot[]> {
  return [...MONITORED_LOTS];
}

/**
 * Gets the list of monitorable process parameters.
 */
export async function getParameters(): Promise<ParameterDef[]> {
  return [...PARAMETERS];
}

/**
 * Gets the reading series for a given lot/parameter.
 */
export async function getReadings(lotNumber: string, parameterKey: string): Promise<ProcessReading[]> {
  return getMockReadings(lotNumber, parameterKey);
}

/**
 * Computes control limits (I-MR: estimates sigma from the moving range, d2 = 1.128).
 */
export function getControlLimits(readings: ProcessReading[]): ControlLimits {
  const values = readings.map((r) => r.value);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;

  const movingRanges = values.slice(1).map((v, i) => Math.abs(v - values[i]));
  const mrBar = movingRanges.reduce((sum, v) => sum + v, 0) / movingRanges.length;
  const sigma = mrBar / 1.128;

  return { mean, sigma, ucl: mean + 3 * sigma, lcl: mean - 3 * sigma };
}

/**
 * Gets the moving-range series (for the MR control chart), with its own control limits attached.
 */
export function getMovingRangeSeries(readings: ProcessReading[]): {
  points: ProcessReading[];
  limits: ControlLimits;
} {
  const values = readings.map((r) => r.value);
  const mrValues = values.slice(1).map((v, i) => Math.abs(v - values[i]));
  const mrBar = mrValues.reduce((sum, v) => sum + v, 0) / mrValues.length;

  const points: ProcessReading[] = mrValues.map((v, i) => ({
    index: i + 1,
    timestamp: readings[i + 1].timestamp,
    value: Math.round(v * 100) / 100,
  }));

  // D3 = 0, D4 = 3.267 for n = 2 (individuals/moving-range chart constants)
  return { points, limits: { mean: mrBar, sigma: 0, ucl: mrBar * 3.267, lcl: 0 } };
}

function zoneOf(value: number, mean: number, sigma: number): { zone: 0 | 1 | 2 | 3; side: 1 | -1 | 0 } {
  const diff = value - mean;
  if (diff === 0) return { zone: 0, side: 0 };
  const side = diff > 0 ? 1 : -1;
  const absZ = Math.abs(diff) / sigma;
  if (absZ > 3) return { zone: 3, side };
  if (absZ > 2) return { zone: 2, side };
  if (absZ > 1) return { zone: 1, side };
  return { zone: 0, side };
}

/**
 * Western Electric rule engine: applies the four classic rules to a
 * reading series, returning the detected violation events (with the
 * triggering reading indices).
 */
export function detectViolations(
  lotNumber: string,
  parameterKey: string,
  readings: ProcessReading[],
  limits: ControlLimits
): SPCViolation[] {
  const violations: SPCViolation[] = [];
  const classified = readings.map((r) => zoneOf(r.value, limits.mean, limits.sigma));

  const pushViolation = (rule: RuleId, indices: number[]) => {
    violations.push({
      id: `${lotNumber}-${parameterKey}-${rule}-${indices[indices.length - 1]}`,
      lotNumber,
      parameter: parameterKey,
      rule,
      ruleLabel: RULE_LABELS[rule],
      pointIndices: indices,
      timestamp: readings[indices[indices.length - 1]].timestamp,
    });
  };

  // Rule 1: any single point beyond 3-sigma.
  classified.forEach((c, i) => {
    if (c.zone === 3) pushViolation('rule1', [i]);
  });

  // Rule 2 / Rule 3 / Rule 4: sliding windows, same-side same-zone-or-beyond counts.
  // Each rule scans independently and skips past a found window to avoid
  // reporting every overlapping sub-window of the same anomaly.
  const scanWindow = (windowSize: number, minCount: number, minZone: 0 | 1 | 2, rule: RuleId) => {
    let i = 0;
    while (i <= classified.length - windowSize) {
      const window = classified.slice(i, i + windowSize);
      for (const side of [1, -1] as const) {
        const count = window.filter((c) => c.side === side && c.zone >= minZone).length;
        if (count >= minCount) {
          const indices = Array.from({ length: windowSize }, (_, k) => i + k);
          pushViolation(rule, indices);
          i += windowSize - 1; // skip ahead past this window
          break;
        }
      }
      i++;
    }
  };

  scanWindow(3, 2, 2, 'rule2'); // 2 of 3 beyond 2-sigma, same side
  scanWindow(5, 4, 1, 'rule3'); // 4 of 5 beyond 1-sigma, same side

  // Rule 4: run of >=8 consecutive points on the same side of centerline.
  let runStart = 0;
  let runSide: 1 | -1 | 0 = 0;
  for (let i = 0; i <= classified.length; i++) {
    const side = i < classified.length ? classified[i].side : 0;
    if (side !== 0 && side === runSide) continue;
    const runLength = i - runStart;
    if (runSide !== 0 && runLength >= 8) {
      pushViolation(
        'rule4',
        Array.from({ length: runLength }, (_, k) => runStart + k)
      );
    }
    runStart = i;
    runSide = side;
  }

  return violations;
}

/**
 * Gets the violation list across all lots × all parameters (for the dashboard/overview).
 */
export async function getAllViolations(): Promise<SPCViolation[]> {
  const all: SPCViolation[] = [];
  for (const lot of MONITORED_LOTS) {
    for (const param of PARAMETERS) {
      const readings = getMockReadings(lot.lotNumber, param.key);
      const limits = getControlLimits(readings);
      all.push(...detectViolations(lot.lotNumber, param.key, readings, limits));
    }
  }
  return all;
}
