import type { ManagedUser } from '../../vite-env';
import i18n from '../../i18n';

export interface UserListResult {
  success: boolean;
  data?: ManagedUser[];
  error?: string;
}

export interface UserActionResult {
  success: boolean;
  error?: string;
}

/**
 * Gets the user list (admin only).
 */
export async function getUsersService(): Promise<UserListResult> {
  try {
    const res = await window.electronAPI.getUsers();
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || i18n.t('userManage.loadListFailedGeneric') };
  }
}

/**
 * Creates a user (admin only).
 */
export async function createUserService(data: {
  username: string;
  password: string;
  role?: string;
  securityQuestion: string;
  securityAnswer: string;
}): Promise<UserActionResult> {
  try {
    const res = await window.electronAPI.createUser(data);
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || i18n.t('userManage.createFailedGeneric') };
  }
}

/**
 * Updates a user's role and/or resets their password (admin only).
 */
export async function updateUserService(data: {
  id: number;
  role?: string;
  newPassword?: string;
}): Promise<UserActionResult> {
  try {
    const res = await window.electronAPI.updateUser(data);
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || i18n.t('userManage.updateFailedGeneric') };
  }
}

/**
 * Deletes a user (admin only).
 */
export async function deleteUserService(id: number): Promise<UserActionResult> {
  try {
    const res = await window.electronAPI.deleteUser(id);
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || i18n.t('userManage.deleteFailedGeneric') };
  }
}
