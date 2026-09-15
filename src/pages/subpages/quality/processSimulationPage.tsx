// src/pages/subpages/quality/processSimulationPage.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import WaferScene, { type DieRecord, type DieStatus } from '../../../components/three/waferScene';
import {
  synthesizeWaferMap,
  DEFAULT_SIMULATION_PARAMS,
  type SimulationParams,
} from '../../../services/quality/waferSimulationService';
import { classifyWaferPattern, type DefectClassificationResult } from '../../../services/quality/defectInferenceService';
import { exportServices } from '../../../services/export/exportServices';
import type { QualityDieRow } from '../../../vite-env';

const GRID_SIZE = 17;

function toDieRecord(row: QualityDieRow): DieRecord {
  return {
    id: row.id,
    waferId: row.waferId,
    col: row.col,
    row: row.row,
    status: row.status as DieStatus,
    processDeviation: row.processDeviation,
  };
}

interface SlideDef {
  key: keyof SimulationParams;
  labelKey: string;
  min: number;
  max: number;
  step: number;
  hintKey: string;
}

const SLIDERS: SlideDef[] = [
  { key: 'edgeContamination', labelKey: 'processSimulation.edgeContamination', min: 0, max: 1, step: 0.01, hintKey: 'processSimulation.edgeContaminationHint' },
  { key: 'centerTempDeviation', labelKey: 'processSimulation.centerTempDeviation', min: -1, max: 1, step: 0.01, hintKey: 'processSimulation.centerTempDeviationHint' },
  { key: 'mechanicalStress', labelKey: 'processSimulation.mechanicalStress', min: 0, max: 1, step: 0.01, hintKey: 'processSimulation.mechanicalStressHint' },
  { key: 'localYieldVariance', labelKey: 'processSimulation.localYieldVariance', min: 0, max: 1, step: 0.01, hintKey: 'processSimulation.localYieldVarianceHint' },
  { key: 'baselineDefectRate', labelKey: 'processSimulation.baselineDefectRate', min: 0, max: 0.2, step: 0.005, hintKey: 'processSimulation.baselineDefectRateHint' },
];

interface SimulationRun {
  params: SimulationParams;
  classification: DefectClassificationResult;
}

export default function ProcessSimulationPage() {
  const { t } = useTranslation();
  const [params, setParams] = useState<SimulationParams>(DEFAULT_SIMULATION_PARAMS);
  const [runSeed, setRunSeed] = useState(0);
  const [dies, setDies] = useState<DieRecord[]>([]);
  const [result, setResult] = useState<DefectClassificationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [history, setHistory] = useState<SimulationRun[]>([]);

  const handleSliderChange = (key: keyof SimulationParams, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      const nextSeed = runSeed + 1;
      setRunSeed(nextSeed);
      const synthDies = synthesizeWaferMap(params, GRID_SIZE, nextSeed);
      setDies(synthDies.map(toDieRecord));
      const classification = await classifyWaferPattern(synthDies, GRID_SIZE);
      setResult(classification);
      setHistory((prev) => [...prev, { params: { ...params }, classification }]);
    } finally {
      setRunning(false);
    }
  };

  const handleExport = async () => {
    if (history.length === 0) return;
    setExporting(true);
    try {
      await exportServices.exportDefectDetectionReport({
        filename: `process-simulation-report-${new Date().toISOString().slice(0, 10)}.pdf`,
        generatedAt: new Date().toLocaleString('zh-TW'),
        modelInfo: { datasetName: 'WM-811K (MIR-WM811K)', numClasses: 9, testAccuracy: 0.956 },
        waferResults: [],
        paretoData: [],
        simulationRuns: history.map((h) => ({
          params: h.params as unknown as Record<string, number>,
          predictedPattern: t(`patterns.${h.classification.label}`),
          confidencePct: h.classification.confidence * 100,
        })),
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-blue-400">{t('processSimulation.title')}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('processSimulation.subtitle')}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || history.length === 0}
          className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {exporting ? t('processSimulation.exporting') : `${t('processSimulation.addToReport')} (${history.length})`}
        </button>
      </div>

      <div className="bg-amber-950/40 border border-amber-800/60 rounded-lg px-4 py-2.5 text-xs text-amber-300">
        {t('processSimulation.disclaimer')}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-slate-200">{t('processSimulation.paramsTitle')}</h4>
          {SLIDERS.map((s) => (
            <div key={s.key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300">{t(s.labelKey)}</span>
                <span className="text-slate-400 tabular-nums">
                  {s.key === 'centerTempDeviation'
                    ? `${(params[s.key] * 100).toFixed(0)}%`
                    : `${(params[s.key] * 100).toFixed(1)}%`}
                </span>
              </div>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={params[s.key]}
                onChange={(e) => handleSliderChange(s.key, parseFloat(e.target.value))}
                className="w-full accent-blue-500"
              />
              <p className="text-[11px] text-slate-500 mt-0.5">{t(s.hintKey)}</p>
            </div>
          ))}

          <button
            onClick={handleRun}
            disabled={running}
            className="w-full px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {running ? t('processSimulation.running') : t('processSimulation.runButton')}
          </button>
        </div>

        <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-3">
          <div className="h-[420px] rounded-lg overflow-hidden">
            <WaferScene
              dies={dies}
              gridSize={GRID_SIZE}
              colorMode="heatmap"
              selectedDieId={null}
              onSelectDie={() => {}}
            />
          </div>
          {dies.length === 0 ? (
            <p className="text-sm text-slate-400 mt-2">{t('processSimulation.noResultYet')}</p>
          ) : !result ? (
            <p className="text-sm text-slate-400 mt-2">{t('processSimulation.inferring')}</p>
          ) : (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-lg font-bold text-white">
                  {t('processSimulation.predictedPattern')}: {t(`patterns.${result.label}`)}{' '}
                  <span className="text-sm font-normal text-slate-400">
                    ({t('processSimulation.confidenceScore')} {(result.confidence * 100).toFixed(1)}%)
                  </span>
                </p>
              </div>
              <div className="space-y-1.5">
                {result.allScores.slice(0, 5).map((s) => (
                  <div key={s.label} className="flex items-center gap-2 text-xs">
                    <span className="w-32 text-slate-400 flex-shrink-0 truncate">{t(`patterns.${s.label}`)}</span>
                    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${s.label === result.label ? 'bg-blue-500' : 'bg-slate-500'}`}
                        style={{ width: `${Math.max(2, s.probability * 100)}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-slate-400 tabular-nums">
                      {(s.probability * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
