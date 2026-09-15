import { submitModelFeedback } from './calibrationService';
import { toOrderedProbs, type DefectClassificationResult } from './defectInferenceService';
import { getFinalDisposition } from '../../mocks/api/qualityDataApi';
import type { QualityWaferRow } from '../../vite-env';

let lastProcessedSyncedAt: string | null = null;

export interface AutoFeedbackResult {
  submittedCount: number;
}

/**
 * Simulates "downstream final disposition (e.g. electrical test)
 * auto-feedback" into the AI calibration layer.
 *
 * Why this exists: the AI model calibration layer
 * (spec/done/continuous-model-improvement.md) was originally designed as
 * pure human-in-the-loop feedback (an engineer manually confirms/corrects
 * each wafer's classification on the AI Defect Detection page) — that was
 * a deliberate choice, since the mock data generator has no built-in
 * ground truth for "what defect pattern this wafer actually has" that
 * could be auto-graded, unlike the quality-data sync which has a clean
 * formula the main process can run periodically on its own. But that also
 * means reaching `minSamples` (default 20) requires a lot of manual
 * clicking — a poor experience, and hard to use for simply demonstrating/
 * testing whether the calibration layer works.
 *
 * This uses the `getFinalDisposition()` added to `qualityDataApi.ts` to
 * simulate a "downstream final electrical-test/engineering confirmation"
 * verdict, automatically submitting one feedback row after every quality
 * data sync + AI inference completes — this is the mock version of the
 * "eventually stream data indirectly from fab data to achieve remote AI
 * semiconductor quality" concept: once wired to a real fab MES/test
 * system, only `getFinalDisposition()` needs to be swapped for a real
 * remote query; the rest of this file's logic doesn't need to change.
 *
 * The manual "was the AI's call correct?" confirm/correct feature is
 * completely unaffected and still coexists — an engineer can still
 * manually submit a correction for any case they disagree with, on top of
 * the auto-feedback; both sources land in the same model_feedback table.
 *
 * Throttled with a module-level variable (auto-submits at most once per
 * syncedAt), so a user repeatedly switching pages on the same batch of
 * data doesn't keep resubmitting the same feedback rows.
 */
export async function autoSubmitFeedbackForSync(
  syncedAt: string | null,
  results: { wafer: QualityWaferRow; classification: DefectClassificationResult }[]
): Promise<AutoFeedbackResult> {
  if (!syncedAt || syncedAt === lastProcessedSyncedAt) return { submittedCount: 0 };
  lastProcessedSyncedAt = syncedAt;

  let submittedCount = 0;
  for (const r of results) {
    const finalDisposition = getFinalDisposition(r.wafer.id);
    if (!finalDisposition) continue;
    try {
      await submitModelFeedback({
        waferId: r.wafer.id,
        predictedProbs: toOrderedProbs(r.classification.allScores),
        predictedLabel: r.classification.label,
        confirmedLabel: finalDisposition,
      });
      submittedCount++;
    } catch (err) {
      console.error('[autoFeedbackService] 自動回饋送出失敗:', err);
    }
  }
  return { submittedCount };
}
