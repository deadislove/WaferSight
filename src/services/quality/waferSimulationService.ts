import type { QualityDieRow } from '../../vite-env';

// Deterministic pseudo-random in [0, 1) from an integer seed — same
// formula used everywhere else in this project's mock data (qualityDataApi.ts),
// never Math.random(), so a given seed always reproduces the same wafer.
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export interface SimulationParams {
  /** Edge contamination coefficient 0..1 — biases defect density toward the outer ring. */
  edgeContamination: number;
  /** Center temperature deviation -1..1 — biases defect density toward/away from the center. */
  centerTempDeviation: number;
  /** Mechanical stress coefficient 0..1 — probability of injecting a linear scratch band. */
  mechanicalStress: number;
  /** Local yield variance 0..1 — probability of one localized defect cluster. */
  localYieldVariance: number;
  /** Baseline defect rate 0..0.2 — uniform background defect probability. */
  baselineDefectRate: number;
}

export const DEFAULT_SIMULATION_PARAMS: SimulationParams = {
  edgeContamination: 0.2,
  centerTempDeviation: 0,
  mechanicalStress: 0,
  localYieldVariance: 0.2,
  baselineDefectRate: 0.03,
};

/**
 * Hashes the current slider values + a run counter into one seed, so
 * clicking "Run Simulation" again with the same sliders reproduces the same
 * wafer (determinism), but changing any slider or the run counter
 * visibly changes the result — same discipline as qualityDataApi.ts's
 * syncSequence.
 */
export function hashSimulationSeed(params: SimulationParams, runSeed: number): number {
  return (
    runSeed * 1000003 +
    Math.round(params.edgeContamination * 1000) * 97 +
    Math.round((params.centerTempDeviation + 1) * 1000) * 89 +
    Math.round(params.mechanicalStress * 1000) * 83 +
    Math.round(params.localYieldVariance * 1000) * 79 +
    Math.round(params.baselineDefectRate * 1000) * 73
  );
}

/**
 * Generates a synthetic die grid from named process/material coefficients.
 * This is a deliberately simple, documented heuristic (see
 * spec/future/process-parameter-simulation.md §4) designed so each slider
 * visibly nudges the result toward the pattern class it's named after —
 * it is NOT a physical process model and must never be presented as one.
 */
export function synthesizeWaferMap(params: SimulationParams, gridSize: number, runSeed: number): QualityDieRow[] {
  const dies: QualityDieRow[] = [];
  const center = (gridSize - 1) / 2;
  const radius = gridSize / 2;
  const seedBase = hashSimulationSeed(params, runSeed);

  // One Bernoulli draw per simulation (not per die) decides whether a
  // scratch band appears at all, and where.
  const scratchRoll = pseudoRandom(seedBase + 11);
  const hasScratch = scratchRoll < params.mechanicalStress;
  const scratchAngle = pseudoRandom(seedBase + 13) * Math.PI;
  const scratchOffset = (pseudoRandom(seedBase + 17) - 0.5) * gridSize * 0.5;
  const scratchWidth = 0.45 + params.mechanicalStress * 0.15;

  // One Bernoulli draw decides whether a localized cluster appears, and
  // where its center is.
  const localRoll = pseudoRandom(seedBase + 19);
  const hasLocalCluster = localRoll < params.localYieldVariance;
  const localCenterCol = Math.floor(pseudoRandom(seedBase + 23) * gridSize);
  const localCenterRow = Math.floor(pseudoRandom(seedBase + 29) * gridSize);
  const localRadius = 1.5 + params.localYieldVariance * 2;

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const dx = col - center;
      const dy = row - center;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > radius - 0.5) continue; // outside the wafer's circular edge

      const seed = seedBase + row * 1000 + col;
      const edgeFactor = distance / radius;
      let isDefect = false;

      // 1. Scratch band: a line of dies near the chosen angle/offset.
      if (hasScratch) {
        const perpDist = Math.abs(dx * Math.sin(scratchAngle) - dy * Math.cos(scratchAngle) - scratchOffset);
        if (perpDist < scratchWidth) isDefect = true;
      }

      // 2. Edge contamination: probability rises with edgeFactor.
      if (!isDefect && edgeFactor > 0.6) {
        const edgeProb = params.baselineDefectRate + params.edgeContamination * (edgeFactor - 0.6) * 2.5;
        if (pseudoRandom(seed + 501) < edgeProb) isDefect = true;
      }

      // 3. Center temperature deviation: probability rises near the
      // center, magnitude (not sign) of the deviation drives strength.
      // A dense, near-saturated disc (not a diffuse gradient) is what
      // reads as "Center" to the classifier rather than "Loc".
      if (!isDefect) {
        const centerStrength = Math.abs(params.centerTempDeviation);
        const centerRadius = 1 + centerStrength * (radius * 0.5);
        if (distance < centerRadius) {
          const centerProb = params.baselineDefectRate + centerStrength * (0.95 - 0.3 * (distance / centerRadius));
          if (pseudoRandom(seed + 601) < centerProb) isDefect = true;
        }
      }

      // 4. Local cluster.
      if (!isDefect && hasLocalCluster) {
        const localDist = Math.sqrt((col - localCenterCol) ** 2 + (row - localCenterRow) ** 2);
        if (localDist < localRadius) {
          const localProb = params.baselineDefectRate + params.localYieldVariance * 0.7 * (1 - localDist / localRadius);
          if (pseudoRandom(seed + 701) < localProb) isDefect = true;
        }
      }

      // 5. Uniform background rate — applies everywhere, independent of
      // the layered effects above.
      if (!isDefect && pseudoRandom(seed + 801) < params.baselineDefectRate) {
        isDefect = true;
      }

      dies.push({
        id: `sim-d-${col}-${row}`,
        waferId: 'simulated',
        col,
        row,
        status: isDefect ? 'defect' : 'good',
        defectCode: null,
        category: null,
        confidence: null,
        processDeviation: isDefect ? 0.5 + pseudoRandom(seed + 901) * 0.5 : pseudoRandom(seed + 901) * 0.5,
      });
    }
  }

  return dies;
}
