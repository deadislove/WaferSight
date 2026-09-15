import Database from 'better-sqlite3-multiple-ciphers';
import path from 'path';
import { app } from 'electron';
import bcrypt from 'bcryptjs';
import { getAppConfig } from './configManager';

// Store the SQLite file in the user data folder (e.g., AppData on Windows, Application Support on macOS)
const dbPath = path.join(app.getPath('userData'), 'app_database.db');

const db = new Database(dbPath);

const config = getAppConfig();
db.pragma(`key = '${config.dbEncryptionKey}'`);

// Initialize table schemas
export function initDatabase() {
    db.exec(`
        -- 1. User auth & roles table
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            security_question TEXT NOT NULL,
            security_answer TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- 2. Lot table — shared data foundation for the quality module, sourced from the simulated remote sync
        CREATE TABLE IF NOT EXISTS lots (
            id TEXT PRIMARY KEY,
            lot_number TEXT UNIQUE NOT NULL,
            product TEXT NOT NULL,
            start_time TEXT NOT NULL,
            status TEXT NOT NULL,
            synced_at TEXT NOT NULL
        );

        -- 3. Wafer table
        CREATE TABLE IF NOT EXISTS wafers (
            id TEXT PRIMARY KEY,
            lot_id TEXT NOT NULL REFERENCES lots(id),
            wafer_number INTEGER NOT NULL,
            yield_pct REAL NOT NULL,
            grid_size INTEGER NOT NULL,
            synced_at TEXT NOT NULL
        );

        -- 4. Die table
        CREATE TABLE IF NOT EXISTS dies (
            id TEXT PRIMARY KEY,
            wafer_id TEXT NOT NULL REFERENCES wafers(id),
            col INTEGER NOT NULL,
            row INTEGER NOT NULL,
            status TEXT NOT NULL,
            defect_code TEXT,
            category TEXT,
            confidence REAL,
            process_deviation REAL NOT NULL,
            synced_at TEXT NOT NULL
        );

        -- 5. AI model human-in-the-loop feedback table — engineer confirmations/
        --    corrections of AI predictions; the real-label source the
        --    calibration layer learns from
        CREATE TABLE IF NOT EXISTS model_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wafer_id TEXT NOT NULL,
            predicted_probs TEXT NOT NULL, -- JSON: raw CNN probabilities for all 9 classes
            predicted_label TEXT NOT NULL,
            confirmed_label TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        -- 6. Calibration layer state table (single row, id fixed at 1) — linear calibration layer weights and hyperparameters
        CREATE TABLE IF NOT EXISTS calibration_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            weights_json TEXT NOT NULL,
            bias_json TEXT NOT NULL,
            sample_count INTEGER NOT NULL DEFAULT 0,
            learning_rate REAL NOT NULL DEFAULT 0.05,
            l2_reg REAL NOT NULL DEFAULT 0.001,
            min_samples INTEGER NOT NULL DEFAULT 20,
            updated_at TEXT
        );

        -- 7. History of each retrain — drives the "learning curve" chart
        CREATE TABLE IF NOT EXISTS calibration_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            retrained_at TEXT NOT NULL,
            holdout_accuracy REAL NOT NULL,
            sample_count INTEGER NOT NULL
        );
    `);

    dropLegacyTemplateTables();
    ensureUserRoleColumn();
    ensureCalibrationState();

    console.log('Database initialized at:', dbPath);

    initData();
}

const CALIBRATION_CLASS_COUNT = 9;

/**
 * Ensures calibration_state has an initial row: identity weight matrix,
 * zero bias — i.e. "no calibration applied." A freshly installed app with
 * no feedback data yet must behave identically to the raw, uncalibrated
 * CNN output.
 */
function ensureCalibrationState() {
    try {
        const existing = db.prepare('SELECT id FROM calibration_state WHERE id = 1').get();
        if (!existing) {
            const identity: number[][] = Array.from({ length: CALIBRATION_CLASS_COUNT }, (_, i) =>
                Array.from({ length: CALIBRATION_CLASS_COUNT }, (_, j) => (i === j ? 1 : 0))
            );
            const zeros = Array.from({ length: CALIBRATION_CLASS_COUNT }, () => 0);
            db.prepare(
                `INSERT INTO calibration_state (id, weights_json, bias_json, sample_count, updated_at)
                 VALUES (1, ?, ?, 0, NULL)`
            ).run(JSON.stringify(identity), JSON.stringify(zeros));
        }
    } catch (err) {
        console.error('calibration_state initialization failed:', err);
    }
}

/**
 * Drops the legacy radio-dispatch template tables (ARSEvent/DispatchTable/
 * RadioDevice/RadioEvent) — unrelated to this product (wafer quality);
 * the users table is untouched.
 */
function dropLegacyTemplateTables() {
    try {
        db.exec(`
            DROP TABLE IF EXISTS ARSEvent;
            DROP TABLE IF EXISTS DispatchTable;
            DROP TABLE IF EXISTS RadioDevice;
            DROP TABLE IF EXISTS RadioEvent;
        `);
    } catch (err) {
        console.error('Failed to drop legacy tables:', err);
    }
}

/**
 * Migrates older databases that predate the role column, and ensures the
 * admin account's role is correct.
 */
function ensureUserRoleColumn() {
    try {
        const columns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
        const hasRole = columns.some((col) => col.name === 'role');
        if (!hasRole) {
            db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
        }
        db.prepare("UPDATE users SET role = 'admin' WHERE username = 'admin' AND role != 'admin'").run();
    } catch (err) {
        console.error('users.role column migration failed:', err);
    }
}

/**
 * Creates the default admin account (if it doesn't already exist).
 */
function initData() {
    try {
        const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
        const adminUser = stmt.get('admin');

        if (!adminUser) {
            const hashedPassword = bcrypt.hashSync('123', 10);

            const insertStmt = db.prepare(`
                INSERT INTO users (username, password, security_question, security_answer, role)
                VALUES (?, ?, ?, ?, ?)
            `);

            insertStmt.run(
                'admin',
                hashedPassword,
                '你的第一隻寵物叫什麼名字？',
                'admin',
                'admin'
            );

            console.log('Default admin account created (username: admin / password: 123)');
        }
    } catch (err) {
        console.error('Failed to create the default admin account:', err);
    }
}

export default db;