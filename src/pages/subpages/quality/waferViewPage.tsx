// src/pages/subpages/quality/waferViewPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import WaferScene, { type ColorMode, type DieRecord, type DieStatus } from '../../../components/three/waferScene';
import { getDiesForWafer } from '../../../services/quality/lotFoundationService';
import { useQualityData } from '../../../contexts/qualityDataContext';
import type { QualityDieRow } from '../../../vite-env';

const STATUS_LABEL_KEY: Record<DieStatus, string> = {
  good: 'dieStatus.good',
  defect: 'dieStatus.defect',
  untested: 'dieStatus.untested',
};

function toDieRecord(row: QualityDieRow): DieRecord {
  return {
    id: row.id,
    waferId: row.waferId,
    col: row.col,
    row: row.row,
    status: row.status as DieStatus,
    defectCode: row.defectCode ?? undefined,
    category: row.category ?? undefined,
    confidence: row.confidence ?? undefined,
    processDeviation: row.processDeviation,
  };
}

function formatSyncedAt(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('zh-TW');
}

export default function WaferViewPage() {
  const { t } = useTranslation();
  const { wafers, lastSyncedAt, syncing, refreshNow } = useQualityData();
  const [selectedWaferId, setSelectedWaferId] = useState<string>('');
  const [dies, setDies] = useState<DieRecord[]>([]);
  const [colorMode, setColorMode] = useState<ColorMode>('heatmap');
  const [selectedDie, setSelectedDie] = useState<DieRecord | null>(null);

  // Wafer list comes from the shared data foundation (SQLite); defaults to
  // the first wafer, and re-selects the first wafer if the previously
  // selected one no longer exists after a list refresh.
  useEffect(() => {
    if (wafers.length === 0) return;
    setSelectedWaferId((current) => (wafers.some((w) => w.id === current) ? current : wafers[0].id));
  }, [wafers]);

  useEffect(() => {
    if (!selectedWaferId) return;
    setSelectedDie(null);
    (async () => {
      try {
        const rows = await getDiesForWafer(selectedWaferId);
        setDies(rows.map(toDieRecord));
      } catch (err) {
        console.error('[WaferView] 取得晶粒資料失敗:', err);
      }
    })();
  }, [selectedWaferId]);

  const selectedWafer = wafers.find((w) => w.id === selectedWaferId) ?? null;

  const stats = useMemo(() => {
    const good = dies.filter((d) => d.status === 'good').length;
    const defect = dies.filter((d) => d.status === 'defect').length;
    const untested = dies.filter((d) => d.status === 'untested').length;
    return { good, defect, untested, total: dies.length };
  }, [dies]);

  if (wafers.length === 0) {
    return (
      <div className="w-full max-w-6xl mx-auto">
        <p className="text-slate-400">{t('waferView.loadingInitial')}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-bold text-blue-400">{t('waferView.title')}</h3>

        <div className="flex flex-wrap items-center gap-3">
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

          <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded p-1">
            <button
              onClick={() => setColorMode('heatmap')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                colorMode === 'heatmap' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              {t('waferView.heatmapView')}
            </button>
            <button
              onClick={() => setColorMode('process')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                colorMode === 'process' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              {t('waferView.processView')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {selectedWafer && (
          <div className="flex flex-wrap gap-4 text-sm text-slate-400">
            <span>
              {t('waferView.yield')} <span className="text-white font-semibold">{selectedWafer.yieldPct.toFixed(1)}%</span>
            </span>
            <span>
              {t('waferView.good')} <span className="text-emerald-400 font-semibold">{stats.good}</span>
            </span>
            <span>
              {t('waferView.defect')} <span className="text-red-400 font-semibold">{stats.defect}</span>
            </span>
            <span>
              {t('waferView.untested')} <span className="text-slate-300 font-semibold">{stats.untested}</span>
            </span>
            <span>
              {t('waferView.totalDies')} <span className="text-white font-semibold">{stats.total}</span>
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{t('waferView.lastSynced')}: {formatSyncedAt(lastSyncedAt) ?? t('waferView.notSyncedYet')}</span>
          <button
            onClick={refreshNow}
            disabled={syncing}
            className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors disabled:opacity-50"
          >
            {syncing ? t('waferView.syncing') : t('waferView.forceRefresh')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-3">
          <div className="h-[480px] rounded-lg overflow-hidden">
            <WaferScene
              dies={dies}
              gridSize={selectedWafer?.gridSize ?? 17}
              colorMode={colorMode}
              selectedDieId={selectedDie?.id ?? null}
              onSelectDie={setSelectedDie}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">{t('waferView.dragHint')}</p>

          {colorMode === 'heatmap' ? (
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> {t('waferView.good')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> {t('waferView.defect')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-500" /> {t('waferView.untested')}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-300">
              <span>{t('waferView.normal')}</span>
              <span
                className="h-2.5 w-32 rounded-sm"
                style={{ background: 'linear-gradient(to right, #bfdbfe, #1e3a8a)' }}
              />
              <span>{t('waferView.abnormal')}</span>
            </div>
          )}
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-slate-200 mb-3">{t('waferView.dieDetail')}</h4>
          {!selectedDie ? (
            <p className="text-sm text-slate-400">{t('waferView.selectDiePrompt')}</p>
          ) : (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">{t('waferView.coordinates')}</dt>
                <dd className="text-white font-medium tabular-nums">
                  (col {selectedDie.col}, row {selectedDie.row})
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">{t('waferView.status')}</dt>
                <dd className="text-white font-medium">{t(STATUS_LABEL_KEY[selectedDie.status])}</dd>
              </div>
              {selectedDie.status === 'defect' && (
                <>
                  <div>
                    <dt className="text-slate-500">{t('waferView.defectCode')}</dt>
                    <dd className="text-red-300 font-medium">{selectedDie.defectCode}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{t('waferView.defectType')}</dt>
                    <dd className="text-slate-200">{selectedDie.category}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{t('waferView.confidence')}</dt>
                    <dd className="text-slate-200 tabular-nums">
                      {((selectedDie.confidence ?? 0) * 100).toFixed(0)}%
                    </dd>
                  </div>
                </>
              )}
              <div>
                <dt className="text-slate-500">{t('waferView.processDeviation')}</dt>
                <dd className="text-slate-200 tabular-nums">
                  {(selectedDie.processDeviation * 100).toFixed(0)}%
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
