// The 'onnxruntime-web/wasm' subpath (not the package root) — the root
// entry point references webgl/webgpu/jsep backends too, which pulled in
// an extra ~27MB unused WASM binary (jsep/WebGPU) into the build. This
// model only ever runs on the plain WASM backend.
import * as ort from 'onnxruntime-web/wasm';
import type { QualityDieRow } from '../../vite-env';

// Root-relative paths ("/ort/...") would break in the packaged app: Electron
// loads the built app via `loadFile()` — a file:// URL — where a
// leading-slash path resolves against the filesystem root, not the app's
// own directory (Vite's dev server masks this since it serves everything
// from an HTTP root, so this only breaks in the packaged build). Resolving
// against `document.baseURI` instead works correctly in both dev
// (http://localhost:.../) and packaged (file:///.../dist/index.html) contexts.
const BASE_URL = new URL('.', document.baseURI).href;

// Force a fully local, single-threaded WASM backend:
// - wasmPaths points at our own copy of the runtime (public/ort/), never a
//   CDN — this is the whole point of this feature (zero external calls).
// - numThreads = 1 avoids the SharedArrayBuffer / cross-origin-isolation
//   headers multi-threaded WASM needs, which Electron's default file
//   loading doesn't set up.
ort.env.wasm.wasmPaths = new URL('ort/', BASE_URL).href;
ort.env.wasm.numThreads = 1;

const MODEL_URL = new URL('models/wafer-defect-classifier.onnx', BASE_URL).href;
const LABELS_URL = new URL('models/wafer-defect-classifier-labels.json', BASE_URL).href;

// Real, measured numbers from the actual training run — see
// spec/done/ai-defect-detection.md §7 for the full per-class
// precision/recall/F1 breakdown. Not placeholders.
export const MODEL_INFO = {
  datasetName: 'WM-811K (MIR-WM811K)',
  numClasses: 9,
  testAccuracy: 0.956,
  testSetSize: 118595,
} as const;

interface LabelsFile {
  classes: string[];
  imgSize: number;
}

export interface DefectScore {
  label: string;
  probability: number;
}

export interface DefectClassificationResult {
  label: string;
  confidence: number;
  allScores: DefectScore[];
}

let sessionPromise: Promise<ort.InferenceSession> | null = null;
let labelsPromise: Promise<LabelsFile> | null = null;

function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(MODEL_URL, { executionProviders: ['wasm'] });
  }
  return sessionPromise;
}

function getLabels(): Promise<LabelsFile> {
  if (!labelsPromise) {
    labelsPromise = fetch(LABELS_URL).then((r) => r.json());
  }
  return labelsPromise;
}

/**
 * Resizes a 0..1 mask from srcSize x srcSize to dstSize x dstSize via the
 * Canvas 2D API's built-in smoothing. Not bit-identical to the Python
 * training script's PIL BILINEAR resize, but both are smooth linear-ish
 * interpolations of a small binary mask — close enough that the model
 * (trained to be somewhat resize-method-agnostic by nature of downsampling
 * many different wafer sizes to begin with) is not sensitive to the
 * difference in practice.
 */
function resizeMask(mask: Float32Array, srcSize: number, dstSize: number): Float32Array {
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = srcSize;
  srcCanvas.height = srcSize;
  const srcCtx = srcCanvas.getContext('2d')!;
  const imageData = srcCtx.createImageData(srcSize, srcSize);
  for (let i = 0; i < mask.length; i++) {
    const v = Math.round(mask[i] * 255);
    imageData.data[i * 4] = v;
    imageData.data[i * 4 + 1] = v;
    imageData.data[i * 4 + 2] = v;
    imageData.data[i * 4 + 3] = 255;
  }
  srcCtx.putImageData(imageData, 0, 0);

  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = dstSize;
  dstCanvas.height = dstSize;
  const dstCtx = dstCanvas.getContext('2d')!;
  dstCtx.imageSmoothingEnabled = true;
  dstCtx.imageSmoothingQuality = 'high';
  dstCtx.drawImage(srcCanvas, 0, 0, srcSize, srcSize, 0, 0, dstSize, dstSize);

  const resized = dstCtx.getImageData(0, 0, dstSize, dstSize);
  const out = new Float32Array(dstSize * dstSize);
  for (let i = 0; i < out.length; i++) {
    out[i] = resized.data[i * 4] / 255;
  }
  return out;
}

function softmax(logits: Float32Array): number[] {
  const maxLogit = Math.max(...logits);
  const exps = Array.from(logits, (l) => Math.exp(l - maxLogit));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/**
 * Classifies a wafer's overall defect pattern from its die grid, using the
 * CNN trained in scripts/train-defect-model/ (see that folder's README for
 * dataset provenance). Runs 100% locally via onnxruntime-web/WASM — no
 * network call happens here.
 *
 * Encoding matches train.py's encode_wafer_map: a 2-channel (die-exists,
 * fail) image. This app's 'untested' die status has no equivalent in the
 * training data (WM-811K only has "no die" / "pass" / "fail") — untested
 * dies are treated as "no die" (die-exists = 0), the closest available
 * approximation, not a bug.
 */
export async function classifyWaferPattern(
  dies: QualityDieRow[],
  gridSize: number
): Promise<DefectClassificationResult> {
  const [{ classes, imgSize }, session] = await Promise.all([getLabels(), getSession()]);

  const dieExists = new Float32Array(gridSize * gridSize);
  const fail = new Float32Array(gridSize * gridSize);
  for (const die of dies) {
    const idx = die.row * gridSize + die.col;
    if (die.status !== 'untested') dieExists[idx] = 1;
    if (die.status === 'defect') fail[idx] = 1;
  }

  const dieExistsResized = resizeMask(dieExists, gridSize, imgSize);
  const failResized = resizeMask(fail, gridSize, imgSize);

  const inputData = new Float32Array(2 * imgSize * imgSize);
  inputData.set(dieExistsResized, 0);
  inputData.set(failResized, imgSize * imgSize);

  const tensor = new ort.Tensor('float32', inputData, [1, 2, imgSize, imgSize]);
  const results = await session.run({ wafer_image: tensor });
  const logits = results.logits.data as Float32Array;
  const probs = softmax(logits);

  const allScores: DefectScore[] = classes
    .map((label, i) => ({ label, probability: probs[i] }))
    .sort((a, b) => b.probability - a.probability);

  return { label: allScores[0].label, confidence: allScores[0].probability, allScores };
}

// Must match public/models/wafer-defect-classifier-labels.json's `classes`
// order exactly, and electron/services/modelCalibrationService.ts's
// duplicated copy of the same order — see that file's comment for why
// duplicating a frozen, shipped model artifact's class order is safe here.
const CALIBRATION_CLASSES = ['none', 'Center', 'Donut', 'Edge-Loc', 'Edge-Ring', 'Loc', 'Random', 'Scratch', 'Near-full'];

/**
 * classifyWaferPattern()'s allScores is sorted by probability, so it loses
 * the fixed class-index order the calibration layer's weight matrix
 * expects. Reconstructs that fixed-order vector — used both to feed the
 * calibration layer (below) and as the `predictedProbs` sent with
 * engineer feedback (spec/done/continuous-model-improvement.md §3), which
 * must always be the RAW, uncalibrated CNN output — training the
 * calibration layer on its own already-corrected output would create a
 * feedback loop that drifts rather than converges.
 */
export function toOrderedProbs(allScores: DefectScore[]): number[] {
  const byLabel = new Map(allScores.map((s) => [s.label, s.probability]));
  return CALIBRATION_CLASSES.map((c) => byLabel.get(c) ?? 0);
}

export interface CalibrationWeights {
  weights: number[][];
  bias: number[];
  active: boolean;
}

/**
 * Applies the human-in-the-loop calibration layer on top of the frozen
 * CNN's raw output. A no-op (returns rawResult unchanged) whenever the
 * layer isn't active yet (identity weights / too few feedback samples) —
 * a fresh install must behave identically to the uncalibrated model.
 */
export function applyCalibration(
  rawResult: DefectClassificationResult,
  calibration: CalibrationWeights
): DefectClassificationResult {
  if (!calibration.active) return rawResult;

  const x = toOrderedProbs(rawResult.allScores);
  const logits = calibration.weights.map(
    (row, i) => row.reduce((sum, w, j) => sum + w * x[j], 0) + calibration.bias[i]
  );
  const correctedProbs = softmax(new Float32Array(logits));

  const allScores: DefectScore[] = CALIBRATION_CLASSES.map((label, i) => ({
    label,
    probability: correctedProbs[i],
  })).sort((a, b) => b.probability - a.probability);

  return { label: allScores[0].label, confidence: allScores[0].probability, allScores };
}
