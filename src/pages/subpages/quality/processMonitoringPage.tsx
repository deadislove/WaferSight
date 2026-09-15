// src/pages/subpages/quality/processMonitoringPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ControlChart from '../../../components/charts/controlChart';
import {
  getMonitoredLots,
  getParameters,
  getReadings,
  getControlLimits,
  getMovingRangeSeries,
  detectViolations,
  getAllViolations,
  type MonitoredLot,
  type ParameterDef,
  type ProcessReading,
  type SPCViolation,
} from '../../../services/quality/processMonitoringService';

const PARAM_LABEL_KEY: Record<string, string> = {
  temperature: 'processMonitoring.params.temperature',
  pressure: 'processMonitoring.params.pressure',
  etchTime: 'processMonitoring.params.etchTime',
};

const SPC_RULE_LABEL_KEY: Record<string, string> = {
  rule1: 'spcRules.rule1',
  rule2: 'spcRules.rule2',
  rule3: 'spcRules.rule3',
  rule4: 'spcRules.rule4',
};

export default function ProcessMonitoringPage() {
  const { t } = useTranslation();
  const [lots, setLots] = useState<MonitoredLot[]>([]);
  const [parameters, setParameters] = useState<ParameterDef[]>([]);
  const [selectedLot, setSelectedLot] = useState('');
  const [selectedParam, setSelectedParam] = useState('');
  const [readings, setReadings] = useState<ProcessReading[]>([]);
  const [allViolations, setAllViolations] = useState<SPCViolation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [lotList, paramList, violations] = await Promise.all([
        getMonitoredLots(),
        getParameters(),
        getAllViolations(),
      ]);
      setLots(lotList);
      setParameters(paramList);
      setAllViolations(violations);
      if (lotList.length > 0) setSelectedLot(lotList[0].lotNumber);
      if (paramList.length > 0) setSelectedParam(paramList[0].key);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedLot || !selectedParam) return;
    (async () => {
      const result = await getReadings(selectedLot, selectedParam);
      setReadings(result);
    })();
  }, [selectedLot, selectedParam]);

  const parameterDef = parameters.find((p) => p.key === selectedParam) ?? null;

  const { limits, violations, mrSeries } = useMemo(() => {
    if (readings.length === 0) {
      return { limits: null, violations: [] as SPCViolation[], mrSeries: null };
    }
    const limits = getControlLimits(readings);
    const violations = detectViolations(selectedLot, selectedParam, readings, limits);
    const mrSeries = getMovingRangeSeries(readings);
    return { limits, violations, mrSeries };
  }, [readings, selectedLot, selectedParam]);

  const violatingIndices = useMemo(() => {
    const set = new Set<number>();
    violations.forEach((v) => v.pointIndices.forEach((i) => set.add(i)));
    return set;
  }, [violations]);

  const currentLotViolationCount = allViolations.filter((v) => v.lotNumber === selectedLot).length;

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto">
        <p className="text-slate-400">{t('processMonitoring.loading')}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-bold text-blue-400">{t('processMonitoring.title')}</h3>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedLot}
            onChange={(e) => setSelectedLot(e.target.value)}
            className="px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-sm text-white"
          >
            {lots.map((l) => (
              <option key={l.lotNumber} value={l.lotNumber}>
                {l.lotNumber} · {l.toolId} ({l.product})
              </option>
            ))}
          </select>

          <select
            value={selectedParam}
            onChange={(e) => setSelectedParam(e.target.value)}
            className="px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-sm text-white"
          >
            {parameters.map((p) => (
              <option key={p.key} value={p.key}>
                {t(PARAM_LABEL_KEY[p.key] ?? p.label)} ({p.unit})
              </option>
            ))}
          </select>
        </div>
      </div>

      {readings.length > 0 && parameterDef && limits && mrSeries && (
        <>
          <div className="flex flex-wrap gap-4 text-sm text-slate-400">
            <span>
              {t('processMonitoring.centerline')} <span className="text-white font-semibold">{limits.mean.toFixed(2)} {parameterDef.unit}</span>
            </span>
            <span>
              UCL <span className="text-amber-400 font-semibold">{limits.ucl.toFixed(2)}</span>
            </span>
            <span>
              LCL <span className="text-amber-400 font-semibold">{limits.lcl.toFixed(2)}</span>
            </span>
            <span>
              {t('processMonitoring.violationCount')} <span className={violations.length > 0 ? 'text-red-400 font-semibold' : 'text-emerald-400 font-semibold'}>{violations.length}</span>
            </span>
          </div>

          <ControlChart
            title={`${t('processMonitoring.iChartTitle')}${t(PARAM_LABEL_KEY[parameterDef.key] ?? parameterDef.label)}`}
            points={readings}
            mean={limits.mean}
            ucl={limits.ucl}
            lcl={limits.lcl}
            violatingIndices={violatingIndices}
            valueFormatter={(v) => `${v.toFixed(2)} ${parameterDef.unit}`}
          />

          <ControlChart
            title={t('processMonitoring.mrChartTitle')}
            points={mrSeries.points}
            mean={mrSeries.limits.mean}
            ucl={mrSeries.limits.ucl}
            lcl={mrSeries.limits.lcl}
            violatingIndices={new Set()}
            valueFormatter={(v) => `${v.toFixed(2)} ${parameterDef.unit}`}
          />
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">
            {t('processMonitoring.violationsForThis')} {currentLotViolationCount > 0 && `(${t('processMonitoring.violationsForThisCount', { count: currentLotViolationCount })})`}
          </h4>
          {violations.length === 0 ? (
            <p className="text-sm text-emerald-400">{t('processMonitoring.noViolations')}</p>
          ) : (
            <ul className="space-y-2">
              {violations.map((v) => (
                <li key={v.id} className="text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-xs font-semibold text-red-300">{v.rule.toUpperCase()}</span>
                  </div>
                  <p className="text-slate-300 mt-0.5">{t(SPC_RULE_LABEL_KEY[v.rule] ?? v.ruleLabel)}</p>
                  <p className="text-xs text-slate-500">{t('processMonitoring.triggeredPoints')}: {v.pointIndices.length}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">{t('processMonitoring.allViolationsTitle')}</h4>
          {allViolations.length === 0 ? (
            <p className="text-sm text-slate-400">{t('processMonitoring.noAllViolations')}</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {allViolations.map((v) => {
                const param = parameters.find((p) => p.key === v.parameter);
                return (
                  <li key={v.id} className="text-sm border-b border-slate-700/50 pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-400" />
                      <span className="text-xs font-semibold text-red-300">{v.lotNumber}</span>
                      <span className="text-xs text-slate-500">· {param ? t(PARAM_LABEL_KEY[param.key] ?? param.label) : v.parameter}</span>
                    </div>
                    <p className="text-slate-300 mt-0.5">{t(SPC_RULE_LABEL_KEY[v.rule] ?? v.ruleLabel)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
