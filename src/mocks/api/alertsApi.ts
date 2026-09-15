export interface LiveAlert {
  id: string;
  source: 'spc' | 'defect-rate' | 'yield' | 'system';
  lotNumber?: string;
  // i18next key + interpolation params (instead of a resolved string) so the
  // message re-renders correctly if the UI language changes after this
  // alert was already received. Resolve with t(messageKey, messageParams).
  messageKey: string;
  messageParams?: Record<string, string | number>;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string; // ISO
}

type AlertListener = (alert: LiveAlert) => void;

const PUSH_INTERVAL_MS = 6000;

// The "history" a real GET /alerts endpoint would return on first load.
const INITIAL_ALERTS: LiveAlert[] = [
  {
    id: 'init-1',
    source: 'spc',
    lotNumber: 'L-2026-1004',
    messageKey: 'alerts.mock.spcTempRun8',
    severity: 'critical',
    createdAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
  },
  {
    id: 'init-2',
    source: 'spc',
    lotNumber: 'L-2026-1002',
    messageKey: 'alerts.mock.spcPressureBeyond3Sigma',
    severity: 'critical',
    createdAt: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
  },
  {
    id: 'init-3',
    source: 'defect-rate',
    lotNumber: 'L-2026-1009',
    messageKey: 'alerts.mock.defectRateExceeded',
    messageParams: { pct: 5.2 },
    severity: 'warning',
    createdAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
  },
];

// New events fired one at a time on the push interval while there's at
// least one subscriber — cycles deterministically (no Math.random content),
// only the delivery timing is "live," matching this project's mock-data
// convention of reproducible content.
const LIVE_ALERT_POOL: Omit<LiveAlert, 'id' | 'createdAt'>[] = [
  { source: 'yield', lotNumber: 'L-2026-1011', messageKey: 'alerts.mock.yieldBelowExpected', messageParams: { pct: 86.5 }, severity: 'warning' },
  { source: 'spc', lotNumber: 'L-2026-1006', messageKey: 'alerts.mock.spcEtch2of3Beyond2Sigma', severity: 'warning' },
  { source: 'system', messageKey: 'alerts.mock.processDataSyncComplete', severity: 'info' },
  { source: 'defect-rate', lotNumber: 'L-2026-1013', messageKey: 'alerts.mock.defectRateExceeded', messageParams: { pct: 6.1 }, severity: 'critical' },
  { source: 'spc', lotNumber: 'L-2026-1000', messageKey: 'alerts.mock.spcTempBeyond3Sigma', severity: 'critical' },
  { source: 'yield', lotNumber: 'L-2026-1005', messageKey: 'alerts.mock.yieldRecovered', messageParams: { pct: 91.2 }, severity: 'info' },
  { source: 'system', messageKey: 'alerts.mock.equipmentCalibrationComplete', messageParams: { equipment: 'T-02' }, severity: 'info' },
  { source: 'defect-rate', lotNumber: 'L-2026-1007', messageKey: 'alerts.mock.defectRateNormal', severity: 'info' },
];

class AlertsRealtimeApi {
  private listeners = new Set<AlertListener>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private cursor = 0;

  /** Simulates GET /alerts — the catch-up snapshot on first load. */
  async fetchInitialAlerts(): Promise<LiveAlert[]> {
    return [...INITIAL_ALERTS];
  }

  /**
   * Simulates opening a WebSocket/SSE subscription. The underlying "connection"
   * (interval timer) is created lazily on the first subscriber and torn down
   * when the last one unsubscribes, mirroring real connection lifecycle rules.
   */
  subscribe(listener: AlertListener): () => void {
    this.listeners.add(listener);
    this.ensureStreamStarted();

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stopStream();
    };
  }

  private ensureStreamStarted() {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => this.emitNextAlert(), PUSH_INTERVAL_MS);
  }

  private stopStream() {
    if (this.intervalId === null) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  private emitNextAlert() {
    const template = LIVE_ALERT_POOL[this.cursor % LIVE_ALERT_POOL.length];
    this.cursor += 1;

    const alert: LiveAlert = {
      ...template,
      id: `live-${Date.now()}-${this.cursor}`,
      createdAt: new Date().toISOString(),
    };

    this.listeners.forEach((listener) => listener(alert));
  }
}

export const alertsRealtimeApi = new AlertsRealtimeApi();
