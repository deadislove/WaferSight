import type { CalibrationStateData } from '../../vite-env';

export type { CalibrationStateData, CalibrationMetric } from '../../vite-env';

/**
 * Submits an engineer's confirmation/correction of an AI prediction — the
 * real-label source the calibration layer learns from, see
 * spec/done/continuous-model-improvement.md §3.
 */
export async function submitModelFeedback(data: {
  waferId: string;
  predictedProbs: number[];
  predictedLabel: string;
  confirmedLabel: string;
}): Promise<void> {
  const res = await window.electronAPI.submitModelFeedback(data);
  if (!res.success) throw new Error(res.error || '送出回饋失敗');
}

/**
 * Gets the current calibration layer state (weights, hyperparameters,
 * whether active, retrain history).
 */
export async function getCalibrationState(): Promise<CalibrationStateData> {
  const res = await window.electronAPI.getCalibrationState();
  if (!res.success || !res.data) throw new Error(res.error || '取得校正層狀態失敗');
  return res.data;
}

export async function updateCalibrationConfig(data: {
  learningRate?: number;
  l2Reg?: number;
  minSamples?: number;
}): Promise<void> {
  const res = await window.electronAPI.updateCalibrationConfig(data);
  if (!res.success) throw new Error(res.error || '更新超參數失敗');
}

export async function resetCalibration(): Promise<void> {
  const res = await window.electronAPI.resetCalibration();
  if (!res.success) throw new Error(res.error || '重設校正層失敗');
}

export interface RetrainResult {
  skipped?: string;
  holdoutAccuracy?: number;
  sampleCount?: number;
}

export async function retrainCalibrationNow(): Promise<RetrainResult> {
  const res = await window.electronAPI.retrainCalibrationNow();
  if (!res.success && !res.skipped) throw new Error(res.error || '重訓失敗');
  return { skipped: res.skipped, holdoutAccuracy: res.holdoutAccuracy, sampleCount: res.sampleCount };
}

export function onCalibrationUpdated(callback: () => void): void {
  window.electronAPI.onCalibrationUpdated(callback);
}
