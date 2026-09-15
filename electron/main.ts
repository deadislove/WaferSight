import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import { initDatabase } from './infra/db';
import { fileURLToPath } from 'url';
import { registerBackgroundWorker, startBackgroundWorker, checkingDb } from './workers/backgroundWorker';
import { registerNetworkBackgroundWorker, startNetworkBackgroundWorker } from './workers/networkBackgroundWorker';
import { createNetStatusTask } from './workers/netStatusWorker';
import { createCalibrationRetrainTask, markCalibrationRetrainedNow } from './workers/calibrationWorker';
import { createQualitySyncTask } from './workers/qualitySyncWorker';
import { getErrorMessage } from './infra/errorMessage';
// Service
import { authService } from './services/authService';
import { userService } from './services/userService';
import { qualityDataService } from './services/qualityDataService';
import { modelCalibrationService } from './services/modelCalibrationService';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;


function isWindowUsable(win: BrowserWindow | null): win is BrowserWindow {
    return !!win && !win.isDestroyed() && !win.webContents.isDestroyed();
}

function createWindow() {
    mainWindow = new BrowserWindow({

        width: 1680,
        height: 860,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    mainWindow.on('close', () => {
        if (isWindowUsable(mainWindow)) {
            mainWindow.webContents.send('force-logout');
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow?.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        mainWindow?.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

// Reads the CURRENT mainWindow (via closure over the module-level variable,
// not a frozen value passed in as a parameter) so the broadcast always
// reaches the actual window regardless of when it's called.
function broadcastQualityDataSynced(syncedAt: string) {
    if (isWindowUsable(mainWindow)) {
        mainWindow.webContents.send('quality-data-synced', syncedAt);
    }
}

function broadcastCalibrationUpdated() {
    if (isWindowUsable(mainWindow)) {
        mainWindow.webContents.send('calibration-updated');
    }
}

function broadcastNetStatusChanged(isOnline: boolean) {
    if (isWindowUsable(mainWindow)) {
        mainWindow.webContents.send('net-status-changed', isOnline);
    }
}

app.whenReady().then(() => {
    try {
        initDatabase();
    } catch (error) {
        dialog.showErrorBox(
            '資料庫初始化失敗 (Database Error)',
            `系統無法載入或解密本地資料庫。\n\n詳細錯誤原因：\n${getErrorMessage(error)}\n\n這通常發生在資料庫加密金鑰不符，或舊資料未清除。應用程式將即將關閉。`
        );
    }

    ipcMain.handle('auth-register', async (_, data) => authService.register(data));
    ipcMain.handle('auth-login', async (_, data) => authService.login(data));
    ipcMain.handle('auth-reset-password', async (_, data) => authService.resetPassword(data));
    ipcMain.handle('get-security-question', async (_, username) => authService.getSecurityQuestion(username));

    ipcMain.handle('get-users', async (_, { token }) => {
        return userService.getUsers({ token });
    });

    ipcMain.handle('create-user', async (_, data) => userService.createUser(data));
    ipcMain.handle('update-user', async (_, data) => userService.updateUser(data));
    ipcMain.handle('delete-user', async (_, data) => userService.deleteUser(data));

    // Quality
    ipcMain.handle('quality-sync', async (_, data) => {
        const authCheck = authService.verifyToken(data?.token);
        if (!authCheck.valid) {
            return { success: false, syncedAt: '', error: authCheck.error };
        }
        const result = await qualityDataService.syncFromRemote();
        if (result.success) broadcastQualityDataSynced(result.syncedAt);
        return result;
    });
    ipcMain.handle('quality-get-wafers', async (_, data) => qualityDataService.getWafers({ token: data?.token }));
    ipcMain.handle('quality-get-dies', async (_, data) => qualityDataService.getDies({ token: data?.token, waferId: data?.waferId }));
    ipcMain.handle('quality-get-last-synced', async (_, data) => qualityDataService.getLastSyncedAt({ token: data?.token }));

    // AI model
    ipcMain.handle('submit-model-feedback', async (_, data) => modelCalibrationService.submitFeedback(data ?? {}));
    ipcMain.handle('get-calibration-state', async (_, data) => modelCalibrationService.getCalibrationState({ token: data?.token }));
    ipcMain.handle('update-calibration-config', async (_, data) => modelCalibrationService.updateHyperparameters(data ?? {}));
    ipcMain.handle('reset-calibration', async (_, data) => modelCalibrationService.resetCalibration({ token: data?.token }));
    ipcMain.handle('retrain-calibration-now', async (_, data) => {
        const authCheck = authService.verifyAdmin(data?.token);
        if (!authCheck.valid) return { success: false, error: authCheck.error };
        const result = modelCalibrationService.retrainNow();
        if (result.success) {
            markCalibrationRetrainedNow();
            broadcastCalibrationUpdated();
        }
        return result;
    });

    createWindow();

    const runQualitySync = createQualitySyncTask(broadcastQualityDataSynced);

    runQualitySync();

    registerBackgroundWorker(checkingDb);
    registerBackgroundWorker(runQualitySync);

    registerBackgroundWorker(createCalibrationRetrainTask(broadcastCalibrationUpdated));
    startBackgroundWorker();

    registerNetworkBackgroundWorker(createNetStatusTask(broadcastNetStatusChanged));
    startNetworkBackgroundWorker();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
