import type { QualityWaferRow, QualityDieRow } from '../../vite-env';
import { getErrorMessage } from '../../utils/errorMessage';

export type { QualityWaferRow, QualityDieRow };

export interface SyncResult {
  success: boolean;
  syncedAt: string;
  error?: string;
}

/**
 * Asks the main process to sync once, immediately, from the (simulated)
 * remote source and write it to SQLite. The main process is the one that
 * actually "goes and fetches the data" (both the periodic background sync
 * and the initial sync on startup live there); this is just the trigger
 * entry point for the manual refresh button.
 */
export async function syncQualityData(): Promise<SyncResult> {
  try {
    return await window.electronAPI.syncQualityData();
  } catch (err) {
    return { success: false, syncedAt: '', error: getErrorMessage(err) || '同步失敗' };
  }
}

/**
 * Gets the wafer list (read from SQLite, including lot info).
 */
export async function getWafers(): Promise<QualityWaferRow[]> {
  const res = await window.electronAPI.getQualityWafers();
  if (!res.success) throw new Error(res.error || '取得晶圓清單失敗');
  return res.data ?? [];
}

/**
 * Gets die-grid data for a given wafer (read from SQLite).
 */
export async function getDiesForWafer(waferId: string): Promise<QualityDieRow[]> {
  const res = await window.electronAPI.getQualityDies(waferId);
  if (!res.success) throw new Error(res.error || '取得晶粒資料失敗');
  return res.data ?? [];
}

/**
 * Gets the actual last-synced time from the database. Reads the DB
 * directly rather than relying only on the push notification — the app's
 * first sync on startup happens before the UI attaches its listener, so
 * relying on the push event alone would incorrectly show "not yet synced"
 * even though the data has actually arrived.
 */
export async function getLastSyncedAt(): Promise<string | null> {
  const res = await window.electronAPI.getQualityLastSyncedAt();
  if (!res.success) throw new Error(res.error || '取得同步時間失敗');
  return res.data ?? null;
}
