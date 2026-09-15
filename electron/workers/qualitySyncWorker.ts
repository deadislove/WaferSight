import { qualityDataService } from '../services/qualityDataService';

export function createQualitySyncTask(onSynced: (syncedAt: string) => void): () => Promise<void> {
  return async () => {
    const result = await qualityDataService.syncFromRemote();
    if (result.success) onSynced(result.syncedAt);
  };
}
