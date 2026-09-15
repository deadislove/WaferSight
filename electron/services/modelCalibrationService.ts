import Database from 'better-sqlite3-multiple-ciphers';
import dbInstance from '../infra/db';
import { authService } from './authService';
import { getErrorMessage } from '../infra/errorMessage';

// Must match public/models/wafer-defect-classifier-labels.json's `classes`
// order exactly — that file is a frozen, shipped model artifact (its class
// order never changes without a full model re-export), so duplicating the
// order here (rather than reading the file from the main process) is safe
// and avoids an unnecessary cross-boundary file read on every request.
const CLASSES = ['none', 'Center', 'Donut', 'Edge-Loc', 'Edge-Ring', 'Loc', 'Random', 'Scratch', 'Near-full'];
const N = CLASSES.length;

export interface CalibrationStateRow {
  weights: number[][];
  bias: number[];
  sampleCount: number;
  learningRate: number;
  l2Reg: number;
  minSamples: number;
  updatedAt: string | null;
}

export interface CalibrationMetric {
  retrainedAt: string;
  holdoutAccuracy: number;
  sampleCount: number;
}

interface CalibrationStateDbRow {
  weights_json: string;
  bias_json: string;
  sample_count: number;
  learning_rate: number;
  l2_reg: number;
  min_samples: number;
  updated_at: string | null;
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

function matVecMul(W: number[][], x: number[]): number[] {
  return W.map((row) => row.reduce((sum, w, j) => sum + w * x[j], 0) + 0);
}

function argmax(arr: number[]): number {
  let best = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] > arr[best]) best = i;
  return best;
}

export class ModelCalibrationService {
  private db: Database.Database;

  constructor(database = dbInstance) {
    this.db = database;
  }

  private readState(): CalibrationStateRow {
    const row = this.db.prepare('SELECT * FROM calibration_state WHERE id = 1').get() as CalibrationStateDbRow;
    return {
      weights: JSON.parse(row.weights_json),
      bias: JSON.parse(row.bias_json),
      sampleCount: row.sample_count,
      learningRate: row.learning_rate,
      l2Reg: row.l2_reg,
      minSamples: row.min_samples,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Lets the renderer submit "engineer confirmed/corrected the AI
   * prediction" feedback. Any logged-in user can submit this (same role
   * model as the other quality pages) — no admin required.
   */
  public submitFeedback(data: {
    token?: string;
    waferId: string;
    predictedProbs: number[];
    predictedLabel: string;
    confirmedLabel: string;
  }): { success: boolean; error?: string } {
    const authCheck = authService.verifyToken(data.token);
    if (!authCheck.valid) return { success: false, error: authCheck.error };

    if (!Array.isArray(data.predictedProbs) || data.predictedProbs.length !== N) {
      return { success: false, error: '無效的預測機率向量' };
    }
    if (!CLASSES.includes(data.confirmedLabel)) {
      return { success: false, error: '無效的確認標籤' };
    }

    try {
      this.db
        .prepare(
          `INSERT INTO model_feedback (wafer_id, predicted_probs, predicted_label, confirmed_label)
           VALUES (?, ?, ?, ?)`
        )
        .run(data.waferId, JSON.stringify(data.predictedProbs), data.predictedLabel, data.confirmedLabel);
      return { success: true };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Gets the current calibration state + retrain history, used by the
   * renderer both to apply calibration at inference time and to display
   * the "AI Model Tuning" page. Readable by any logged-in user (needed at
   * inference time).
   */
  public getCalibrationState(data: { token?: string }): {
    success: boolean;
    data?: CalibrationStateRow & { active: boolean; metrics: CalibrationMetric[] };
    error?: string;
  } {
    const authCheck = authService.verifyToken(data.token);
    if (!authCheck.valid) return { success: false, error: authCheck.error };

    try {
      const state = this.readState();
      // state.sampleCount only updates when a retrain actually succeeds
      // (see retrainNow()), so it's stale between training cycles — using
      // it for "active" is correct (retraining requires >= minSamples in
      // the first place, so a non-zero stored value always satisfies the
      // check), but the UI's live "N feedback samples" progress display
      // needs the real, currently-pending count instead.
      const active = state.sampleCount >= state.minSamples;
      const liveSampleCount = (this.db.prepare('SELECT COUNT(*) as c FROM model_feedback').get() as { c: number }).c;
      const metricsRows = this.db
        .prepare('SELECT retrained_at as retrainedAt, holdout_accuracy as holdoutAccuracy, sample_count as sampleCount FROM calibration_metrics ORDER BY id ASC')
        .all() as CalibrationMetric[];
      return { success: true, data: { ...state, sampleCount: liveSampleCount, active, metrics: metricsRows } };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Updates hyperparameters (learning rate / regularization / activation
   * threshold, etc.) — admin only, since this affects the calibration
   * behavior every user sees, same admin requirement as user management.
   */
  public updateHyperparameters(data: {
    token?: string;
    learningRate?: number;
    l2Reg?: number;
    minSamples?: number;
  }): { success: boolean; error?: string } {
    const authCheck = authService.verifyAdmin(data.token);
    if (!authCheck.valid) return { success: false, error: authCheck.error };

    try {
      const current = this.readState();
      const learningRate = data.learningRate ?? current.learningRate;
      const l2Reg = data.l2Reg ?? current.l2Reg;
      const minSamples = data.minSamples ?? current.minSamples;
      this.db
        .prepare('UPDATE calibration_state SET learning_rate = ?, l2_reg = ?, min_samples = ? WHERE id = 1')
        .run(learningRate, l2Reg, minSamples);
      return { success: true };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * Resets the calibration layer back to an identity matrix (no
   * calibration) and clears retrain history. Deliberately keeps the
   * accumulated model_feedback data — after a reset, training can restart
   * immediately from existing feedback instead of waiting from zero samples.
   */
  public resetCalibration(data: { token?: string }): { success: boolean; error?: string } {
    const authCheck = authService.verifyAdmin(data.token);
    if (!authCheck.valid) return { success: false, error: authCheck.error };

    try {
      const identity = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => (i === j ? 1 : 0)));
      const zeros = Array.from({ length: N }, () => 0);
      const runTransaction = this.db.transaction(() => {
        this.db
          .prepare('UPDATE calibration_state SET weights_json = ?, bias_json = ?, sample_count = 0, updated_at = NULL WHERE id = 1')
          .run(JSON.stringify(identity), JSON.stringify(zeros));
        this.db.prepare('DELETE FROM calibration_metrics').run();
      });
      runTransaction();
      return { success: true };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) };
    }
  }

  /**
   * The actual retrain logic — pure local computation: reads
   * model_feedback, runs a few epochs of mini-batch gradient descent to
   * update the linear calibration layer, writes the result back to
   * calibration_state, and appends one history row to calibration_metrics.
   *
   * Deliberately takes no token: this method is called both by (a) the
   * background task's own 10-minute self-throttle timer, and (b) the
   * "retrain now" IPC handler. The former has no renderer/user context to
   * verify at all — same design principle as
   * qualityDataService.syncFromRemote(): verification belongs at the IPC
   * handler layer the renderer actually calls through, not inside this
   * internal method shared by both callers.
   */
  public retrainNow(): { success: boolean; skipped?: string; holdoutAccuracy?: number; sampleCount?: number } {
    const state = this.readState();
    const rows = this.db
      .prepare('SELECT predicted_probs as predictedProbs, confirmed_label as confirmedLabel FROM model_feedback ORDER BY id ASC')
      .all() as { predictedProbs: string; confirmedLabel: string }[];

    if (rows.length < state.minSamples) {
      return { success: false, skipped: '資料不足' };
    }

    const examples = rows.map((r) => ({
      x: JSON.parse(r.predictedProbs) as number[],
      y: CLASSES.indexOf(r.confirmedLabel),
    }));

    const holdoutCount = Math.max(1, Math.floor(examples.length * 0.2));
    const trainSet = examples.slice(0, examples.length - holdoutCount);
    const holdoutSet = examples.slice(examples.length - holdoutCount);

    const W = state.weights.map((row) => [...row]);
    const b = [...state.bias];

    const EPOCHS = 30;
    for (let epoch = 0; epoch < EPOCHS; epoch++) {
      const gradW = Array.from({ length: N }, () => Array.from({ length: N }, () => 0));
      const gradB = Array.from({ length: N }, () => 0);

      for (const ex of trainSet) {
        const logits = matVecMul(W, ex.x);
        const probs = softmax(logits);
        for (let i = 0; i < N; i++) {
          const err = probs[i] - (i === ex.y ? 1 : 0);
          gradB[i] += err;
          for (let j = 0; j < N; j++) {
            gradW[i][j] += err * ex.x[j];
          }
        }
      }

      const lr = state.learningRate;
      const l2 = state.l2Reg;
      const m = trainSet.length;
      for (let i = 0; i < N; i++) {
        b[i] -= lr * (gradB[i] / m);
        for (let j = 0; j < N; j++) {
          W[i][j] -= lr * (gradW[i][j] / m + l2 * W[i][j]);
        }
      }
    }

    let correct = 0;
    for (const ex of holdoutSet) {
      const probs = softmax(matVecMul(W, ex.x));
      if (argmax(probs) === ex.y) correct++;
    }
    const holdoutAccuracy = correct / holdoutSet.length;
    const retrainedAt = new Date().toISOString();

    const runTransaction = this.db.transaction(() => {
      this.db
        .prepare('UPDATE calibration_state SET weights_json = ?, bias_json = ?, sample_count = ?, updated_at = ? WHERE id = 1')
        .run(JSON.stringify(W), JSON.stringify(b), examples.length, retrainedAt);
      this.db
        .prepare('INSERT INTO calibration_metrics (retrained_at, holdout_accuracy, sample_count) VALUES (?, ?, ?)')
        .run(retrainedAt, holdoutAccuracy, examples.length);
    });
    runTransaction();

    return { success: true, holdoutAccuracy, sampleCount: examples.length };
  }
}

export const modelCalibrationService = new ModelCalibrationService();
