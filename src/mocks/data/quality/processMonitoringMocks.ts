export interface ParameterDef {
  key: string;
  label: string;
  unit: string;
}

export interface ProcessReading {
  index: number;
  timestamp: string; // ISO datetime
  value: number;
}

export interface MonitoredLot {
  lotNumber: string;
  toolId: string;
  product: string;
}

export const PARAMETERS: ParameterDef[] = [
  { key: 'temperature', label: '溫度', unit: '°C' },
  { key: 'pressure', label: '壓力', unit: 'Torr' },
  { key: 'etchTime', label: '蝕刻時間', unit: 's' },
];

export const MONITORED_LOTS: MonitoredLot[] = [
  { lotNumber: 'L-2026-1000', toolId: 'T-01', product: '12nm-LogicA' },
  { lotNumber: 'L-2026-1002', toolId: 'T-02', product: '28nm-PowerC' },
  { lotNumber: 'L-2026-1004', toolId: 'T-01', product: '16nm-MixedE' },
  { lotNumber: 'L-2026-1006', toolId: 'T-03', product: '7nm-RF-B' },
];

const NOMINAL: Record<string, { mean: number; sigma: number }> = {
  temperature: { mean: 220, sigma: 2 },
  pressure: { mean: 5.0, sigma: 0.15 },
  etchTime: { mean: 60, sigma: 1.2 },
};

const POINT_COUNT = 28;

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Sum of 3 uniforms approximates a bell-shaped distribution (crude Irwin-Hall),
// centered at 0, roughly in [-1.5, 1.5] — good enough for believable mock noise.
function pseudoNormal(seed: number): number {
  return pseudoRandom(seed) + pseudoRandom(seed + 1) + pseudoRandom(seed + 2) - 1.5;
}

function isoMinutesAgo(minutesAgo: number): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - minutesAgo);
  return d.toISOString();
}

function generateReadings(lotNumber: string, parameterKey: string, seedOffset: number): ProcessReading[] {
  const { mean, sigma } = NOMINAL[parameterKey];
  const readings: ProcessReading[] = [];

  for (let i = 0; i < POINT_COUNT; i++) {
    const seed = seedOffset + i * 10;
    let value = mean + pseudoNormal(seed) * sigma;

    // Two intentionally engineered anomalies, kept consistent with the
    // matching mock alerts in qualityDashboardMocks.ts.
    if (lotNumber === 'L-2026-1002' && parameterKey === 'pressure' && i === 20) {
      value = mean + 4.2 * sigma; // single point beyond 3-sigma
    }
    if (lotNumber === 'L-2026-1004' && parameterKey === 'temperature' && i >= 10 && i <= 17) {
      value = mean + (1.1 + pseudoRandom(seed + 3) * 0.3) * sigma; // run of 8, same side
    }

    readings.push({
      index: i,
      timestamp: isoMinutesAgo((POINT_COUNT - i) * 15),
      value: Math.round(value * 100) / 100,
    });
  }

  return readings;
}

const readingsCache = new Map<string, ProcessReading[]>();

export function getMockReadings(lotNumber: string, parameterKey: string): ProcessReading[] {
  const cacheKey = `${lotNumber}:${parameterKey}`;
  if (readingsCache.has(cacheKey)) return readingsCache.get(cacheKey)!;

  const lotIndex = MONITORED_LOTS.findIndex((l) => l.lotNumber === lotNumber);
  const paramIndex = PARAMETERS.findIndex((p) => p.key === parameterKey);
  if (lotIndex === -1 || paramIndex === -1) return [];

  const readings = generateReadings(lotNumber, parameterKey, lotIndex * 100000 + paramIndex * 1000);
  readingsCache.set(cacheKey, readings);
  return readings;
}
