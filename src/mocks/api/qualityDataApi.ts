export type DieStatus = 'good' | 'defect' | 'untested';
export type LotStatus = 'in-progress' | 'completed' | 'hold';

export interface RemoteLot {
  id: string;
  lotNumber: string;
  product: string;
  startTime: string; // ISO
  status: LotStatus;
}

export interface RemoteWafer {
  id: string;
  lotId: string;
  waferNumber: number;
  yieldPct: number;
  gridSize: number;
}

export interface RemoteDie {
  id: string;
  waferId: string;
  col: number;
  row: number;
  status: DieStatus;
  defectCode?: string;
  category?: string;
  confidence?: number;
  processDeviation: number;
}

export interface QualitySnapshot {
  lots: RemoteLot[];
  wafers: RemoteWafer[];
  dies: RemoteDie[];
  fetchedAt: string;
  syncSequence: number;
}

const DEFECT_TYPES = [
  { code: 'SC-01', category: '刮傷 (Scratch)' },
  { code: 'PT-02', category: '微粒 (Particle)' },
  { code: 'OP-03', category: '斷路 (Open)' },
  { code: 'SH-04', category: '短路 (Short)' },
];

const LOT_DEFS: { id: string; lotNumber: string; product: string; startOffsetDays: number; status: LotStatus }[] = [
  { id: 'lot-1', lotNumber: 'L-2026-1003', product: '5nm-LogicD', startOffsetDays: 5, status: 'completed' },
  { id: 'lot-2', lotNumber: 'L-2026-1005', product: '12nm-LogicA', startOffsetDays: 3, status: 'hold' },
  { id: 'lot-3', lotNumber: 'L-2026-1001', product: '7nm-RF-B', startOffsetDays: 8, status: 'completed' },
  { id: 'lot-4', lotNumber: 'L-2026-1009', product: '16nm-MixedE', startOffsetDays: 1, status: 'in-progress' },
];

// finalDisposition: simulates the "downstream final electrical-test/
// engineering confirmation" verdict — on a real line, this typically comes
// from electrical test or an engineering review, and doesn't necessarily
// match the wafer map's visual pattern exactly (that mismatch is precisely
// why the calibration layer exists: to catch the systematic gap between
// what the CNN sees visually and what downstream verification finds).
// Currently simulated with a fixed value; once real fab data is wired up
// (the "remote AI semiconductor quality" concept), this will be replaced
// with the real verdict streamed back live from the fab's MES/test
// systems — see autoFeedbackService.ts for details.
const WAFER_DEFS = [
  { id: 'wafer-1', lotId: 'lot-1', waferNumber: 1, baseYield: 97.0, finalDisposition: 'none' },
  { id: 'wafer-2', lotId: 'lot-2', waferNumber: 3, baseYield: 84.0, finalDisposition: 'Edge-Ring' },
  { id: 'wafer-3', lotId: 'lot-3', waferNumber: 2, baseYield: 95.0, finalDisposition: 'Loc' },
  { id: 'wafer-4', lotId: 'lot-4', waferNumber: 1, baseYield: 91.0, finalDisposition: 'Random' },
];

const FINAL_DISPOSITION_BY_WAFER_ID: Record<string, string> = Object.fromEntries(
  WAFER_DEFS.map((def) => [def.id, def.finalDisposition])
);

/**
 * Simulates a downstream final-disposition lookup — see the WAFER_DEFS
 * comment above. Returns null if the wafer has no known final disposition
 * (all current mock wafers do; the null branch exists for when real
 * external data is wired up and some wafers might not have a downstream
 * result back yet).
 */
export function getFinalDisposition(waferId: string): string | null {
  return FINAL_DISPOSITION_BY_WAFER_ID[waferId] ?? null;
}

const GRID_SIZE = 17;

// Deterministic pseudo-random in [0, 1) from an integer seed (no Math.random,
// matching this project's mock-data convention everywhere else).
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function isoDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function generateDies(waferId: string, waferIndex: number, sequence: number): RemoteDie[] {
  const dies: RemoteDie[] = [];
  const center = (GRID_SIZE - 1) / 2;
  const radius = GRID_SIZE / 2;
  const seedOffset = waferIndex * 100000;

  // One deterministic grid position per wafer flips status each sync —
  // simulates "a new inspection result came in" so a refresh visibly
  // changes the wafer, not just its metadata timestamp.
  const flipPosition = sequence % (GRID_SIZE * GRID_SIZE);

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const dx = col - center;
      const dy = row - center;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > radius - 0.5) continue; // outside the wafer's circular edge

      const seed = seedOffset + row * 1000 + col;
      const edgeFactor = distance / radius;
      const rand = pseudoRandom(seed);

      let status: DieStatus = 'good';
      if (edgeFactor > 0.82 && pseudoRandom(seed + 500) < 0.35) {
        status = 'untested';
      } else if (rand < 0.07) {
        status = 'defect';
      }

      const position = row * GRID_SIZE + col;
      if (position === flipPosition && status !== 'untested') {
        status = sequence % 2 === 0 ? 'defect' : 'good';
      }

      const die: RemoteDie = {
        id: `${waferId}-d-${col}-${row}`,
        waferId,
        col,
        row,
        status,
        processDeviation:
          status === 'defect'
            ? 0.5 + pseudoRandom(seed + 7777) * 0.5
            : pseudoRandom(seed + 7777) * 0.5,
      };

      if (status === 'defect') {
        const typeIndex = Math.floor(pseudoRandom(seed + 42) * DEFECT_TYPES.length);
        const defectType = DEFECT_TYPES[typeIndex];
        die.defectCode = defectType.code;
        die.category = defectType.category;
        die.confidence = Math.round((0.7 + pseudoRandom(seed + 99) * 0.3) * 100) / 100;
      }

      dies.push(die);
    }
  }

  return dies;
}

let syncSequence = 0;

/**
 * Simulates fetching the latest Lot → Wafer → Die snapshot from a remote
 * quality system. Each call bumps an internal sequence number so the
 * result visibly differs from the previous call (a nudged yield value, one
 * flipped die per wafer) — proving a "sync" actually did something, while
 * staying fully deterministic per sequence number (no `Math.random`).
 */
export async function fetchLatestQualitySnapshot(): Promise<QualitySnapshot> {
  syncSequence += 1;
  const sequence = syncSequence;

  const lots: RemoteLot[] = LOT_DEFS.map((def) => ({
    id: def.id,
    lotNumber: def.lotNumber,
    product: def.product,
    startTime: isoDaysAgo(def.startOffsetDays),
    status: def.status,
  }));

  const wafers: RemoteWafer[] = WAFER_DEFS.map((def, index) => {
    const drift = Math.sin(sequence * 0.9 + index * 1.3) * 1.2;
    const yieldPct = Math.min(100, Math.max(0, Math.round((def.baseYield + drift) * 10) / 10));
    return {
      id: def.id,
      lotId: def.lotId,
      waferNumber: def.waferNumber,
      yieldPct,
      gridSize: GRID_SIZE,
    };
  });

  const dies: RemoteDie[] = WAFER_DEFS.flatMap((def, index) => generateDies(def.id, index, sequence));

  return {
    lots,
    wafers,
    dies,
    fetchedAt: new Date().toISOString(),
    syncSequence: sequence,
  };
}
