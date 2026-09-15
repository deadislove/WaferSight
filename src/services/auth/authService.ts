// src/services/authService.ts
import i18n from '../../i18n';
import { getErrorMessage } from '../../utils/errorMessage';

export interface AuthResult {
  success: boolean;
  token?: string;
  user?: { id: number; username: string; role?: string };
  question?: string;
  error?: string;
}

/**
 * Looks up the user's security question.
 */
export async function getSecurityQuestionService(username: string): Promise<AuthResult> {
  if (!username.trim()) {
    return { success: false, error: i18n.t('auth.enterUsernameFirst') };
  }

  try {
    const res = await window.electronAPI.getSecurityQuestion(username);
    return res;
  } catch (err) {
    return { success: false, error: getErrorMessage(err) || i18n.t('auth.fetchQuestionRetryGeneric') };
  }
}

/**
 * Login service.
 */
export async function loginService(credentials: { username: string; password: string }): Promise<AuthResult> {
  try {
    const res = await window.electronAPI.login(credentials);
    return res as AuthResult;
  } catch (err) {
    return { success: false, error: getErrorMessage(err) || i18n.t('auth.loginFailedGeneric') };
  }
}

/**
 * Registration service.
 */
export async function registerService(data: Parameters<typeof window.electronAPI.register>[0]): Promise<AuthResult> {
  try {
    const res = await window.electronAPI.register(data);
    return res as AuthResult;
  } catch (err) {
    return { success: false, error: getErrorMessage(err) || i18n.t('auth.registerFailedGeneric') };
  }
}

/**
 * Password-reset service.
 */
export async function resetPasswordService(data: Parameters<typeof window.electronAPI.resetPassword>[0]): Promise<AuthResult> {
  try {
    const res = await window.electronAPI.resetPassword(data);
    return res as AuthResult;
  } catch (err) {
    return { success: false, error: getErrorMessage(err) || i18n.t('auth.resetFailedGeneric') };
  }
}