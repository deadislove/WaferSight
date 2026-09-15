// src/contexts/useQualityData.ts
import { createContext, useContext } from 'react';
import type { QualityWaferRow } from '../services/quality/lotFoundationService';

export interface QualityDataContextValue {
  wafers: QualityWaferRow[];
  lastSyncedAt: string | null;
  syncing: boolean;
  refreshNow: () => Promise<void>;
}

// Lives here (not in qualityDataContext.tsx) since a file that exports both
// a component and a context/hook breaks Vite Fast Refresh
// (react-refresh/only-export-components).
export const QualityDataContext = createContext<QualityDataContextValue | null>(null);

export function useQualityData(): QualityDataContextValue {
  const ctx = useContext(QualityDataContext);
  if (!ctx) {
    throw new Error('useQualityData must be used within a QualityDataProvider');
  }
  return ctx;
}
