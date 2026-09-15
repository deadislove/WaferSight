// src/pages/admin/subpages/modelTuningPage.tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LineChart from '../../../components/charts/lineChart';
import {
  getCalibrationState,
  updateCalibrationConfig,
  resetCalibration,
  retrainCalibrationNow,
  onCalibrationUpdated,
} from '../../../services/quality/calibrationService';
import type { CalibrationStateData } from '../../../vite-env';
import { getErrorMessage } from '../../../utils/errorMessage';

export default function ModelTuningPage() {
  const { t } = useTranslation();
  const [state, setState] = useState<CalibrationStateData | null>(null);
  const [learningRate, setLearningRate] = useState('0.05');
  const [l2Reg, setL2Reg] = useState('0.001');
  const [minSamples, setMinSamples] = useState('20');
  const [savingConfig, setSavingConfig] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState('');

  function formatDateTime(iso: string | null): string {
    if (!iso) return t('modelTuning.neverRetrained');
    return new Date(iso).toLocaleString('zh-TW');
  }

  const load = () => {
    getCalibrationState()
      .then((s) => {
        setState(s);
        setLearningRate(String(s.learningRate));
        setL2Reg(String(s.l2Reg));
        setMinSamples(String(s.minSamples));
      })
      .catch((err) => console.error('[ModelTuning] 取得校正層狀態失敗:', err));
  };

  useEffect(() => {
    load();
    onCalibrationUpdated(load);
  }, []);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setMessage('');
    try {
      await updateCalibrationConfig({
        learningRate: parseFloat(learningRate),
        l2Reg: parseFloat(l2Reg),
        minSamples: parseInt(minSamples, 10),
      });
      setMessage(t('modelTuning.configSaved'));
      load();
    } catch (err) {
      setMessage(getErrorMessage(err) || t('modelTuning.saving'));
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRetrainNow = async () => {
    setRetraining(true);
    setMessage('');
    try {
      const result = await retrainCalibrationNow();
      if (result.skipped) {
        setMessage(`${t('modelTuning.retrainSkipped')}${result.skipped}`);
      } else {
        setMessage(`${t('modelTuning.retrainDone')}${((result.holdoutAccuracy ?? 0) * 100).toFixed(1)}% (${t('modelTuning.sampleCount')}: ${result.sampleCount})`);
      }
      load();
    } catch (err) {
      setMessage(getErrorMessage(err) || t('modelTuning.retraining'));
    } finally {
      setRetraining(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    setMessage('');
    try {
      await resetCalibration();
      setMessage(t('modelTuning.resetDone'));
      load();
    } catch (err) {
      setMessage(getErrorMessage(err) || t('modelTuning.resetting'));
    } finally {
      setResetting(false);
    }
  };

  if (!state) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <p className="text-slate-400">{t('common.loading')}</p>
      </div>
    );
  }

  const chartData = state.metrics.map((m) => ({
    date: m.retrainedAt.slice(0, 10),
    value: Math.round(m.holdoutAccuracy * 1000) / 10,
  }));

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <div>
        <h3 className="text-xl font-bold text-blue-400">{t('modelTuning.title')}</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {t('modelTuning.subtitle')}
        </p>
      </div>

      {message && <p className="text-sm text-blue-300">{message}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-800 border border-slate-700 rounded-xl p-5">
        <div>
          <dt className="text-xs text-slate-500">{t('modelTuning.sampleCount')}</dt>
          <dd className="text-white text-lg font-semibold mt-0.5">{state.sampleCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">{t('modelTuning.calibrationStatus')}</dt>
          <dd className={`text-lg font-semibold mt-0.5 ${state.active ? 'text-emerald-400' : 'text-slate-400'}`}>
            {state.active ? t('modelTuning.active') : t('modelTuning.inactive')}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">{t('modelTuning.lastRetrainTime')}</dt>
          <dd className="text-white text-sm mt-1.5">{formatDateTime(state.updatedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">{t('modelTuning.latestAccuracy')}</dt>
          <dd className="text-white text-lg font-semibold mt-0.5">
            {state.metrics.length > 0 ? `${(state.metrics[state.metrics.length - 1].holdoutAccuracy * 100).toFixed(1)}%` : '—'}
          </dd>
        </div>
      </div>

      {chartData.length > 0 ? (
        <LineChart title={t('modelTuning.learningCurve')} data={chartData} color="#3b82f6" valueFormatter={(v) => `${v}%`} />
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <p className="text-sm text-slate-400">{t('modelTuning.noMetrics')}</p>
        </div>
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
        <h4 className="text-sm font-semibold text-slate-200">{t('modelTuning.hyperparamsTitle')}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('modelTuning.learningRate')}</label>
            <input
              type="number"
              step="0.001"
              value={learningRate}
              onChange={(e) => setLearningRate(e.target.value)}
              className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('modelTuning.l2Reg')}</label>
            <input
              type="number"
              step="0.0001"
              value={l2Reg}
              onChange={(e) => setL2Reg(e.target.value)}
              className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('modelTuning.minSamples')}</label>
            <input
              type="number"
              step="1"
              value={minSamples}
              onChange={(e) => setMinSamples(e.target.value)}
              className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-sm text-white"
            />
          </div>
        </div>
        <button
          onClick={handleSaveConfig}
          disabled={savingConfig}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {savingConfig ? t('modelTuning.saving') : t('modelTuning.saveButton')}
        </button>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-wrap gap-3">
        <button
          onClick={handleRetrainNow}
          disabled={retraining}
          className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {retraining ? t('modelTuning.retraining') : t('modelTuning.retrainNow')}
        </button>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="px-4 py-2 rounded bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {resetting ? t('modelTuning.resetting') : t('modelTuning.resetLayer')}
        </button>
        <p className="text-xs text-slate-500 self-center">
          {t('modelTuning.autoRetrainNote')}
        </p>
      </div>
    </div>
  );
}
