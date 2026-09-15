import Database from 'better-sqlite3-multiple-ciphers';
import dbInstance from '../infra/db';
import { fetchLatestQualitySnapshot } from '../../src/mocks/api/qualityDataApi';
import { authService } from './authService';

// The shape produced by src/mocks/api/qualityDataApi.ts. This service
// deliberately imports that fake-remote-fetch module directly rather than
// duplicating a second generator here: the main process is the one
// actually responsible for "going and getting the latest data" (per the
// stakeholder's original design — background sync belongs in the
// long-lived main process, not tied to whether a renderer window happens
// to be mounted), reusing this project's existing `backgroundWorker.ts`
// periodic-task pattern.
interface IncomingLot {
    id: string;
    lotNumber: string;
    product: string;
    startTime: string;
    status: string;
}

interface IncomingWafer {
    id: string;
    lotId: string;
    waferNumber: number;
    yieldPct: number;
    gridSize: number;
}

interface IncomingDie {
    id: string;
    waferId: string;
    col: number;
    row: number;
    status: string;
    defectCode?: string;
    category?: string;
    confidence?: number;
    processDeviation: number;
}

export interface QualitySnapshotInput {
    lots: IncomingLot[];
    wafers: IncomingWafer[];
    dies: IncomingDie[];
    fetchedAt: string;
}

export interface WaferRow {
    id: string;
    lotNumber: string;
    waferNumber: number;
    product: string;
    yieldPct: number;
    gridSize: number;
}

export interface DieRow {
    id: string;
    waferId: string;
    col: number;
    row: number;
    status: string;
    defectCode: string | null;
    category: string | null;
    confidence: number | null;
    processDeviation: number;
}

export class QualityDataService {
    private db: Database.Database;

    constructor(database = dbInstance) {
        this.db = database;
    }

    /**
     * Pulls the latest snapshot from the (simulated) remote source and
     * writes it to SQLite. The main process actively fetches this itself —
     * not dependent on whether a renderer happens to be mounted, matching
     * the lifecycle a background sync task should have. Shared by
     * main.ts's startup flow, the periodic background task, and the
     * manual-refresh IPC call.
     */
    public async syncFromRemote(): Promise<{ success: boolean; syncedAt: string; error?: string }> {
        try {
            const snapshot = await fetchLatestQualitySnapshot();
            return this.saveSnapshot(snapshot);
        } catch (err: any) {
            console.error('[QualityDataService] syncFromRemote failed:', err);
            return { success: false, syncedAt: '', error: err.message };
        }
    }

    /**
     * Writes a whole "snapshot" into SQLite as a batch: full replace
     * (clear then insert), wrapped in a single transaction so a mid-write
     * failure can never leave partial data behind.
     */
    public saveSnapshot(snapshot: QualitySnapshotInput): { success: boolean; syncedAt: string; error?: string } {
        const syncedAt = snapshot.fetchedAt;

        const insertLot = this.db.prepare(`
            INSERT INTO lots (id, lot_number, product, start_time, status, synced_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const insertWafer = this.db.prepare(`
            INSERT INTO wafers (id, lot_id, wafer_number, yield_pct, grid_size, synced_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const insertDie = this.db.prepare(`
            INSERT INTO dies (id, wafer_id, col, row, status, defect_code, category, confidence, process_deviation, synced_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const runTransaction = this.db.transaction((snap: QualitySnapshotInput) => {
            this.db.prepare('DELETE FROM dies').run();
            this.db.prepare('DELETE FROM wafers').run();
            this.db.prepare('DELETE FROM lots').run();

            for (const lot of snap.lots) {
                insertLot.run(lot.id, lot.lotNumber, lot.product, lot.startTime, lot.status, syncedAt);
            }
            for (const wafer of snap.wafers) {
                insertWafer.run(wafer.id, wafer.lotId, wafer.waferNumber, wafer.yieldPct, wafer.gridSize, syncedAt);
            }
            for (const die of snap.dies) {
                insertDie.run(
                    die.id,
                    die.waferId,
                    die.col,
                    die.row,
                    die.status,
                    die.defectCode ?? null,
                    die.category ?? null,
                    die.confidence ?? null,
                    die.processDeviation,
                    syncedAt
                );
            }
        });

        try {
            runTransaction(snapshot);
            return { success: true, syncedAt };
        } catch (err: any) {
            console.error('[QualityDataService] saveSnapshot failed:', err);
            return { success: false, syncedAt, error: err.message };
        }
    }

    /**
     * Gets the wafer list (with lot info), used by the wafer selector.
     * These three getters are only ever called by the renderer over IPC
     * (main.ts internals never call them directly), so verification lives
     * here — same approach as userService.getUsers.
     */
    public getWafers(data: { token?: string }): { success: boolean; data?: WaferRow[]; error?: string } {
        const authCheck = authService.verifyToken(data.token);
        if (!authCheck.valid) {
            return { success: false, error: authCheck.error };
        }

        const rows = this.db
            .prepare(
                `
                SELECT w.id as id, l.lot_number as lotNumber, w.wafer_number as waferNumber,
                       l.product as product, w.yield_pct as yieldPct, w.grid_size as gridSize
                FROM wafers w
                JOIN lots l ON w.lot_id = l.id
                ORDER BY l.lot_number, w.wafer_number
            `
            )
            .all() as WaferRow[];
        return { success: true, data: rows };
    }

    /**
     * Gets die-grid data for a given wafer.
     */
    public getDies(data: { token?: string; waferId: string }): { success: boolean; data?: DieRow[]; error?: string } {
        const authCheck = authService.verifyToken(data.token);
        if (!authCheck.valid) {
            return { success: false, error: authCheck.error };
        }

        const rows = this.db
            .prepare(
                `
                SELECT id, wafer_id as waferId, col, row, status,
                       defect_code as defectCode, category, confidence,
                       process_deviation as processDeviation
                FROM dies
                WHERE wafer_id = ?
                ORDER BY row, col
            `
            )
            .all(data.waferId) as DieRow[];
        return { success: true, data: rows };
    }

    /**
     * Gets the actual last-synced time from the database (reads the
     * synced_at column itself, rather than relying on "did we receive a
     * push notification" — the app's first sync on startup happens before
     * the renderer has attached its listener, so relying on the push
     * event alone would incorrectly show "not yet synced").
     */
    public getLastSyncedAt(data: { token?: string }): { success: boolean; data?: string | null; error?: string } {
        const authCheck = authService.verifyToken(data.token);
        if (!authCheck.valid) {
            return { success: false, error: authCheck.error };
        }

        const row = this.db.prepare('SELECT synced_at as syncedAt FROM lots ORDER BY synced_at DESC LIMIT 1').get() as
            | { syncedAt: string }
            | undefined;
        return { success: true, data: row?.syncedAt ?? null };
    }
}

export const qualityDataService = new QualityDataService();
