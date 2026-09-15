import { modelCalibrationService } from '../services/modelCalibrationService';

const RETRAIN_INTERVAL_MS = 10 * 60 * 1000;
let lastRetrainAt = 0;


export function createCalibrationRetrainTask(onRetrained: () => void): () => void {
  return () => {
    const now = Date.now();
    if (now - lastRetrainAt < RETRAIN_INTERVAL_MS) return;
    lastRetrainAt = now;

    const result = modelCalibrationService.retrainNow();
    if (result.success) {
      console.log(
        `[Calibration] Retrain complete — holdout accuracy ${(result.holdoutAccuracy! * 100).toFixed(1)}%, sample count ${result.sampleCount}`
      );
      onRetrained();
    } else if (result.skipped) {
      console.log(`[Calibration] Retrain skipped: ${result.skipped}`);
    }
  };
}


export function markCalibrationRetrainedNow(): void {
  lastRetrainAt = Date.now();
}
