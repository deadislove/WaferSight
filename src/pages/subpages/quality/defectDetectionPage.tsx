// src/pages/subpages/quality/defectDetectionPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQualityData } from '../../../contexts/qualityDataContext';
import { getDiesForWafer } from '../../../services/quality/lotFoundationService';
import {
  classifyWaferPattern,
  applyCalibration,
  toOrderedProbs,
  MODEL_INFO,
  type DefectClassificationResult,
} from '../../../services/quality/defectInferenceService';
import {
  getCalibrationState,
  submitModelFeedback,
  onCalibrationUpdated,
} from '../../../services/quality/calibrationService';
import { autoSubmitFeedbackForSync } from '../../../services/quality/autoFeedbackService';
import { exportServices } from '../../../services/export/exportServices';
import type { QualityWaferRow, CalibrationStateData } from '../../../vite-env';

const PATTERN_KEYS = ['none', 'Center', 'Donut', 'Edge-Loc', 'Edge-Ring', 'Loc', 'Random', 'Scratch', 'Near-full'];

interface WaferResult {
  wafer: QualityWaferRow;
  classification: DefectClassificationResult;
}

export default function DefectDetectionPage() {
  const { t } = useTranslation();
  const { wafers, lastSyncedAt } = useQualityData();
  const [selectedWaferId, setSelectedWaferId] = useState('');
  const [allResults, setAllResults] = useState<WaferResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [calibration, setCalibration] = useState<CalibrationStateData | null>(null);
  const [feedbackLabel, setFeedbackLabel] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle');
  const [autoFeedbackCount, setAutoFeedbackCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getCalibrationState()
        .then((state) => { if (!cancelled) setCalibration(state); })
        .catch((err) => console.error('[DefectDetection] 取得校正層狀態失敗:', err));
    };
    load();
    onCalibrationUpdated(load);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (wafers.length === 0) return;
    setSelectedWaferId((current) => (wafers.some((w) => w.id === current) ? current : wafers[0].id));
  }, [wafers]);

  useEffect(() => {
    if (wafers.length === 0) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const results: WaferResult[] = [];
        for (const wafer of wafers) {
          const dies = await getDiesForWafer(wafer.id);
          const classification = await classifyWaferPattern(dies, wafer.gridSize);
          results.push({ wafer, classification });
        }
        if (!cancelled) setAllResults(results);

        const { submittedCount } = await autoSubmitFeedbackForSync(lastSyncedAt, results);
        if (!cancelled && submittedCount > 0) {
          setAutoFeedbackCount((c) => c + submittedCount);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || t('defectDetection.inferenceFailedGeneric'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wafers, lastSyncedAt]);

  const calibratedResults = useMemo(() => {
    if (!calibration) return allResults;
    return allResults.map((r) => ({
      wafer: r.wafer,
      classification: applyCalibration(r.classification, calibration),
    }));
  }, [allResults, calibration]);

  const selectedResult = calibratedResults.find((r) => r.wafer.id === selectedWaferId) ?? null;
  const selectedRawResult = allResults.find((r) => r.wafer.id === selectedWaferId) ?? null;

  useEffect(() => {
    if (selectedResult) setFeedbackLabel(selectedResult.classification.label);
    setFeedbackStatus('idle');
  }, [selectedResult?.wafer.id, selectedResult?.classification.label]);

  const handleSubmitFeedback = async () => {
    if (!selectedRawResult || !feedbackLabel) return;
    setFeedbackStatus('submitting');
    try {
      await submitModelFeedback({
        waferId: selectedRawResult.wafer.id,
        predictedProbs: toOrderedProbs(selectedRawResult.classification.allScores),
        predictedLabel: selectedResult!.classification.label,
        confirmedLabel: feedbackLabel,
      });
      setFeedbackStatus('sent');
    } catch (err) {
      console.error('[DefectDetection] 送出回饋失敗:', err);
      setFeedbackStatus('error');
    }
  };

  const paretoData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of calibratedResults) {
      counts.set(r.classification.label, (counts.get(r.classification.label) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [calibratedResults]);

  const maxParetoCount = Math.max(1, ...paretoData.map((d) => d.count));

  const handleExportReport = async () => {
    setExporting(true);
    try {
      await exportServices.exportDefectDetectionReport({
        filename: `ai-defect-detection-report-${new Date().toISOString().slice(0, 10)}.pdf`,
        generatedAt: new Date().toLocaleString('zh-TW'),
        modelInfo: MODEL_INFO,
        waferResults: calibratedResults.map((r) => ({
          lotNumber: r.wafer.lotNumber,
          waferNumber: r.wafer.waferNumber,
          product: r.wafer.product,
          yieldPct: r.wafer.yieldPct,
          predictedPattern: t(`patterns.${r.classification.label}`),
          confidencePct: r.classification.confidence * 100,
        })),
        paretoData: paretoData.map((p) => ({ label: t(`patterns.${p.label}`), count: p.count })),
      });
    } finally {
      setExporting(false);
    }
  };

  if (wafers.length === 0) {
    return (
      <div className="w-full max-w-5xl mx-auto">
        <p className="text-slate-400">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-blue-400">{t('defectDetection.title')}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('defectDetection.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedWaferId}
            onChange={(e) => setSelectedWaferId(e.target.value)}
            className="px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-sm text-white"
          >
            {wafers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.lotNumber} · Wafer #{w.waferNumber} ({w.product})
              </option>
            ))}
          </select>
          <button
            onClick={handleExportReport}
            disabled={exporting || loading || allResults.length === 0}
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {exporting ? t('defectDetection.exporting') : t('defectDetection.exportReport')}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">
            {t('defectDetection.aiResult')}
            {selectedResult && (
              <span className="text-slate-500 font-normal">
                {' '}
                — {selectedResult.wafer.lotNumber} Wafer #{selectedResult.wafer.waferNumber}
              </span>
            )}
          </h4>

          {loading || !selectedResult ? (
            <p className="text-sm text-slate-400">{t('defectDetection.inferring')}</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-2xl font-bold text-white">{t(`patterns.${selectedResult.classification.label}`)}</p>
                <p className="text-sm text-slate-400 mt-1">
                  {t('defectDetection.confidenceScore')} {(selectedResult.classification.confidence * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  {t(`patternInfo.${selectedResult.classification.label}`, '')}
                </p>
              </div>
              <div className="space-y-1.5">
                {selectedResult.classification.allScores.slice(0, 5).map((s) => (
                  <div key={s.label} className="flex items-center gap-2 text-xs">
                    <span className="w-32 text-slate-400 flex-shrink-0 truncate">{t(`patterns.${s.label}`)}</span>
                    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          s.label === selectedResult.classification.label ? 'bg-blue-500' : 'bg-slate-500'
                        }`}
                        style={{ width: `${Math.max(2, s.probability * 100)}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-slate-400 tabular-nums">
                      {(s.probability * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-700">
                <p className="text-xs text-slate-400 mb-2">{t('defectDetection.feedbackPrompt')}</p>
                <div className="flex items-center gap-2">
                  <select
                    value={feedbackLabel}
                    onChange={(e) => setFeedbackLabel(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                  >
                    {PATTERN_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {t(`patterns.${key}`)}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleSubmitFeedback}
                    disabled={feedbackStatus === 'submitting'}
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {feedbackStatus === 'submitting' ? t('defectDetection.submitting') : t('defectDetection.submitFeedback')}
                  </button>
                </div>
                {feedbackStatus === 'sent' && <p className="text-xs text-emerald-400 mt-1.5">{t('defectDetection.feedbackSent')}</p>}
                {feedbackStatus === 'error' && <p className="text-xs text-red-400 mt-1.5">{t('defectDetection.feedbackError')}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">{t('defectDetection.paretoTitle')}</h4>
          {loading ? (
            <p className="text-sm text-slate-400">{t('defectDetection.analyzing')}</p>
          ) : (
            <div className="space-y-2">
              {paretoData.map((d) => (
                <div key={d.label} className="flex items-center gap-2 text-xs">
                  <span className="w-32 text-slate-300 flex-shrink-0 truncate">{t(`patterns.${d.label}`)}</span>
                  <div className="flex-1 h-4 bg-slate-700 rounded overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded"
                      style={{ width: `${(d.count / maxParetoCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-slate-300 tabular-nums">{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 overflow-x-auto">
        <h4 className="text-sm font-semibold text-slate-200 mb-3">{t('defectDetection.resultsTable')}</h4>
        {loading ? (
          <p className="text-sm text-slate-400">{t('common.loading')}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="py-2 pr-4">{t('defectDetection.colLot')}</th>
                <th className="py-2 pr-4">{t('defectDetection.colWafer')}</th>
                <th className="py-2 pr-4">{t('defectDetection.colProduct')}</th>
                <th className="py-2 pr-4">{t('defectDetection.colYield')}</th>
                <th className="py-2 pr-4">{t('defectDetection.colPattern')}</th>
                <th className="py-2 pr-4">{t('defectDetection.colConfidence')}</th>
              </tr>
            </thead>
            <tbody>
              {calibratedResults.map((r) => (
                <tr
                  key={r.wafer.id}
                  onClick={() => setSelectedWaferId(r.wafer.id)}
                  className={`border-b border-slate-700/50 cursor-pointer transition-colors ${
                    r.wafer.id === selectedWaferId ? 'bg-blue-500/10' : 'hover:bg-slate-700/30'
                  }`}
                >
                  <td className="py-2 pr-4 font-medium text-white">{r.wafer.lotNumber}</td>
                  <td className="py-2 pr-4 text-slate-300">#{r.wafer.waferNumber}</td>
                  <td className="py-2 pr-4 text-slate-300">{r.wafer.product}</td>
                  <td className="py-2 pr-4 text-slate-300 tabular-nums">{r.wafer.yieldPct.toFixed(1)}%</td>
                  <td className="py-2 pr-4 text-slate-200">{t(`patterns.${r.classification.label}`)}</td>
                  <td className="py-2 pr-4 text-slate-300 tabular-nums">
                    {(r.classification.confidence * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h4 className="text-sm font-semibold text-slate-200 mb-3">{t('defectDetection.modelInfo')}</h4>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-xs text-slate-500">{t('defectDetection.trainingDataset')}</dt>
            <dd className="text-slate-200 mt-0.5">{MODEL_INFO.datasetName}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{t('defectDetection.numClasses')}</dt>
            <dd className="text-slate-200 mt-0.5">{MODEL_INFO.numClasses}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{t('defectDetection.testAccuracy')}</dt>
            <dd className="text-slate-200 mt-0.5">{(MODEL_INFO.testAccuracy * 100).toFixed(1)}%</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{t('defectDetection.inferenceMethod')}</dt>
            <dd className="text-emerald-400 mt-0.5">{t('defectDetection.localInference')}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{t('defectDetection.calibrationLayer')}</dt>
            <dd className={`mt-0.5 ${calibration?.active ? 'text-emerald-400' : 'text-slate-400'}`}>
              {calibration
                ? calibration.active
                  ? `${t('defectDetection.calibrationActive')} (${calibration.sampleCount} ${t('defectDetection.feedbackCount')})`
                  : `${t('defectDetection.calibrationInactive')} (${calibration.sampleCount}/${calibration.minSamples} ${t('defectDetection.feedbackCount')})`
                : t('common.loading')}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-slate-500 mt-3">
          {t('defectDetection.modelFooterNote')}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          {t('defectDetection.autoFeedbackNote1')} {autoFeedbackCount} {t('defectDetection.autoFeedbackNote2')}
        </p>
      </div>
    </div>
  );
}
