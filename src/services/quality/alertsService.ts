import { alertsRealtimeApi, type LiveAlert } from '../../mocks/api/alertsApi';

export type { LiveAlert };

/**
 * Gets the current alert snapshot (simulates GET /alerts).
 */
export async function getInitialAlerts(): Promise<LiveAlert[]> {
  return alertsRealtimeApi.fetchInitialAlerts();
}

/**
 * Subscribes to real-time alert pushes (simulates WebSocket/SSE). Returns
 * an unsubscribe function — must be called on component unmount, or the
 * background push will never stop.
 */
export function subscribeToAlerts(onAlert: (alert: LiveAlert) => void): () => void {
  return alertsRealtimeApi.subscribe(onAlert);
}
