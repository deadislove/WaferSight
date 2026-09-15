import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onNetStatusChange: (callback: (isOnline: boolean) => void) => {
    ipcRenderer.on('net-status-changed', (_, isOnline) => callback(isOnline));
  },
  getUsers: () => {
    const token = localStorage.getItem('jwt_token');
    return ipcRenderer.invoke('get-users', { token });
  },
  createUser: (data: any) => {
    const token = localStorage.getItem('jwt_token');
    return ipcRenderer.invoke('create-user', { token, ...data });
  },
  updateUser: (data: any) => {
    const token = localStorage.getItem('jwt_token');
    return ipcRenderer.invoke('update-user', { token, ...data });
  },
  deleteUser: (id: number) => {
    const token = localStorage.getItem('jwt_token');
    return ipcRenderer.invoke('delete-user', { token, id });
  },
  syncQualityData: () => {
    const token = localStorage.getItem('jwt_token');
    return ipcRenderer.invoke('quality-sync', { token });
  },
  getQualityWafers: () => {
    const token = localStorage.getItem('jwt_token');
    return ipcRenderer.invoke('quality-get-wafers', { token });
  },
  getQualityDies: (waferId: string) => {
    const token = localStorage.getItem('jwt_token');
    return ipcRenderer.invoke('quality-get-dies', { token, waferId });
  },
  getQualityLastSyncedAt: () => {
    const token = localStorage.getItem('jwt_token');
    return ipcRenderer.invoke('quality-get-last-synced', { token });
  },
  onQualityDataSynced: (callback: (syncedAt: string) => void) => {
    ipcRenderer.on('quality-data-synced', (_, syncedAt) => callback(syncedAt));
  },
  submitModelFeedback: (data: { waferId: string; predictedProbs: number[]; predictedLabel: string; confirmedLabel: string }) => {
    const token = localStorage.getItem('jwt_token');
    return ipcRenderer.invoke('submit-model-feedback', { token, ...data });
  },
  getCalibrationState: () => {
    const token = localStorage.getItem('jwt_token');
    return ipcRenderer.invoke('get-calibration-state', { token });
  },
  updateCalibrationConfig: (data: { learningRate?: number; l2Reg?: number; minSamples?: number }) => {
    const token = localStorage.getItem('jwt_token');
    return ipcRenderer.invoke('update-calibration-config', { token, ...data });
  },
  resetCalibration: () => {
    const token = localStorage.getItem('jwt_token');
    return ipcRenderer.invoke('reset-calibration', { token });
  },
  retrainCalibrationNow: () => {
    const token = localStorage.getItem('jwt_token');
    return ipcRenderer.invoke('retrain-calibration-now', { token });
  },
  onCalibrationUpdated: (callback: () => void) => {
    ipcRenderer.on('calibration-updated', () => callback());
  },
  register: (data: any) => ipcRenderer.invoke('auth-register', data),
  login: (data: any) => ipcRenderer.invoke('auth-login', data),
  resetPassword: (data: any) => ipcRenderer.invoke('auth-reset-password', data),
  getSecurityQuestion: (username: string) => ipcRenderer.invoke('get-security-question', username),
  onForceLogout: (callback: () => void) => { ipcRenderer.on('force-logout', () => callback()); },
});