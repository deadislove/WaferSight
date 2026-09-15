// src/contexts/qualityDataContext.tsx
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { syncQualityData, getWafers, getDiesForWafer, getLastSyncedAt, type QualityWaferRow } from '../services/quality/lotFoundationService';
import { classifyWaferPattern } from '../services/quality/defectInferenceService';
import { autoSubmitFeedbackForSync } from '../services/quality/autoFeedbackService';
import { QualityDataContext } from './useQualityData';

export function QualityDataProvider({ children }: { children: ReactNode }) {
  const [wafers, setWafers] = useState<QualityWaferRow[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const reload = useCallback(async () => {
    try {
      setWafers(await getWafers());
    } catch (err) {

      console.error('[QualityDataProvider] reload 失敗:', err);
    }
  }, []);

  useEffect(() => {
    // main process already syncs on its own startup; just read current state
    (async () => {
      await reload();
    })();

    getLastSyncedAt()
      .then((syncedAt) => {
        if (syncedAt) setLastSyncedAt(syncedAt);
      })
      .catch((err) => console.error('[QualityDataProvider] getLastSyncedAt 失敗:', err));

    window.electronAPI.onQualityDataSynced((syncedAt) => {
      setLastSyncedAt(syncedAt);
      reload();
    });
  }, [reload]);

  useEffect(() => {
    if (wafers.length === 0 || !lastSyncedAt) return;
    let cancelled = false;

    (async () => {
      try {
        const results = await Promise.all(
          wafers.map(async (wafer) => {
            const dies = await getDiesForWafer(wafer.id);
            const classification = await classifyWaferPattern(dies, wafer.gridSize);
            return { wafer, classification };
          })
        );
        if (cancelled) return;
        await autoSubmitFeedbackForSync(lastSyncedAt, results);
      } catch (err) {
        console.error('[QualityDataProvider] 自動回饋校正層失敗:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wafers, lastSyncedAt]);

  const refreshNow = useCallback(async () => {
    setSyncing(true);
    try {

      await syncQualityData();
    } finally {
      setSyncing(false);
    }
  }, []);

  return (
    <QualityDataContext.Provider value={{ wafers, lastSyncedAt, syncing, refreshNow }}>
      {children}
    </QualityDataContext.Provider>
  );
}
