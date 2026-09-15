/// <reference types="vite/client" />

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    username: string;
    role?: string;
  };
  error?: string;
}

export interface ManagedUser {
  id: number;
  username: string;
  role: string;
  security_question: string;
  created_at: string;
}

export interface QualityWaferRow {
  id: string;
  lotNumber: string;
  waferNumber: number;
  product: string;
  yieldPct: number;
  gridSize: number;
}

export interface QualityDieRow {
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

export interface CalibrationMetric {
  retrainedAt: string;
  holdoutAccuracy: number;
  sampleCount: number;
}

export interface CalibrationStateData {
  weights: number[][];
  bias: number[];
  sampleCount: number;
  learningRate: number;
  l2Reg: number;
  minSamples: number;
  updatedAt: string | null;
  active: boolean;
  metrics: CalibrationMetric[];
}

export interface ElectronAPI {
  getUsers: () => Promise<{ success: boolean; data?: ManagedUser[]; error?: string }>;
  createUser: (data: {
    username: string;
    password: string;
    role?: string;
    securityQuestion: string;
    securityAnswer: string;
  }) => Promise<{ success: boolean; error?: string }>;
  updateUser: (data: {
    id: number;
    role?: string;
    newPassword?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (id: number) => Promise<{ success: boolean; error?: string }>;
  syncQualityData: () => Promise<{ success: boolean; syncedAt: string; error?: string }>;
  getQualityWafers: () => Promise<{ success: boolean; data?: QualityWaferRow[]; error?: string }>;
  getQualityDies: (waferId: string) => Promise<{ success: boolean; data?: QualityDieRow[]; error?: string }>;
  getQualityLastSyncedAt: () => Promise<{ success: boolean; data?: string | null; error?: string }>;
  onQualityDataSynced: (callback: (syncedAt: string) => void) => void;
  submitModelFeedback: (data: {
    waferId: string;
    predictedProbs: number[];
    predictedLabel: string;
    confirmedLabel: string;
  }) => Promise<{ success: boolean; error?: string }>;
  getCalibrationState: () => Promise<{ success: boolean; data?: CalibrationStateData; error?: string }>;
  updateCalibrationConfig: (data: {
    learningRate?: number;
    l2Reg?: number;
    minSamples?: number;
  }) => Promise<{ success: boolean; error?: string }>;
  resetCalibration: () => Promise<{ success: boolean; error?: string }>;
  retrainCalibrationNow: () => Promise<{ success: boolean; skipped?: string; holdoutAccuracy?: number; sampleCount?: number; error?: string }>;
  onCalibrationUpdated: (callback: () => void) => void;
  register: (data: {
    username: string;
    password?: string;
    securityQuestion?: string;
    securityAnswer?: string;
  }) => Promise<AuthResponse>;
  login: (data: {
    username: string;
    password?: string;
  }) => Promise<AuthResponse>;
  resetPassword: (data: {
    username: string;
    securityAnswer: string;
    newPassword: string;
  }) => Promise<AuthResponse>;
  getSecurityQuestion: (username: string) => Promise<{
    success: boolean;
    question?: string;
    error?: string
  }>;
  onForceLogout: (callback: () => void) => void;
}



declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}