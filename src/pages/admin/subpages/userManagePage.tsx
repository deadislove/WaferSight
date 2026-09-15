// src/pages/admin/subpages/UserManagePage.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../../components/modal';
import ErrorModal from '../../../components/errorModal';
import {
  getUsersService,
  createUserService,
  updateUserService,
  deleteUserService,
} from '../../../services/user/userManageServices';
import type { ManagedUser } from '../../../vite-env';

interface UserManagePageProps {
  currentUser: string | null;
  onForceLogout: () => void;
}

const SECURITY_QUESTIONS = [
  '你的第一隻寵物叫什麼名字？',
  '你畢業的國小名稱？',
  '你最喜歡的城市？',
];
const SECURITY_QUESTION_KEYS = ['auth.securityQ1', 'auth.securityQ2', 'auth.securityQ3'];

type ModalMode = null | 'create' | 'reset-password' | 'delete';

export default function UserManagePage({ currentUser, onForceLogout }: UserManagePageProps) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [targetUser, setTargetUser] = useState<ManagedUser | null>(null);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [newSecurityQuestion, setNewSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [newSecurityAnswer, setNewSecurityAnswer] = useState('');

  const [resetPasswordValue, setResetPasswordValue] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const res = await getUsersService();

    if (res.success && res.data) {
      setUsers(res.data);
    } else {
      setErrorMessage(res.error || t('userManage.loadFailedGeneric'));
      if (res.error?.includes('憑證') || res.error?.includes('Token') || res.error?.includes('權限')) {
        onForceLogout();
      }
    }
    setLoading(false);
  };

  const closeModal = () => {
    setModalMode(null);
    setTargetUser(null);
    setNewUsername('');
    setNewPassword('');
    setNewRole('user');
    setNewSecurityQuestion(SECURITY_QUESTIONS[0]);
    setNewSecurityAnswer('');
    setResetPasswordValue('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await createUserService({
      username: newUsername,
      password: newPassword,
      role: newRole,
      securityQuestion: newSecurityQuestion,
      securityAnswer: newSecurityAnswer,
    });
    setSubmitting(false);

    if (res.success) {
      closeModal();
      loadUsers();
    } else {
      setErrorMessage(res.error || t('userManage.createFailedGeneric'));
    }
  };

  const handleToggleRole = async (user: ManagedUser) => {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    const res = await updateUserService({ id: user.id, role: nextRole });

    if (res.success) {
      loadUsers();
    } else {
      setErrorMessage(res.error || t('userManage.roleChangeFailedGeneric'));
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;

    setSubmitting(true);
    const res = await updateUserService({ id: targetUser.id, newPassword: resetPasswordValue });
    setSubmitting(false);

    if (res.success) {
      closeModal();
    } else {
      setErrorMessage(res.error || t('userManage.resetFailedGeneric'));
    }
  };

  const handleDelete = async () => {
    if (!targetUser) return;

    setSubmitting(true);
    const res = await deleteUserService(targetUser.id);
    setSubmitting(false);

    if (res.success) {
      closeModal();
      loadUsers();
    } else {
      setErrorMessage(res.error || t('userManage.deleteFailedGeneric'));
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-blue-400">{t('userManage.title')}</h3>
        <button
          onClick={() => setModalMode('create')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-sm font-semibold rounded transition-colors"
        >
          {t('userManage.addUser')}
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">{t('common.loading')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-sm">
                <th className="py-2 px-4">{t('userManage.colId')}</th>
                <th className="py-2 px-4">{t('userManage.colUsername')}</th>
                <th className="py-2 px-4">{t('userManage.colRole')}</th>
                <th className="py-2 px-4">{t('userManage.colSecurityQ')}</th>
                <th className="py-2 px-4">{t('userManage.colCreatedAt')}</th>
                <th className="py-2 px-4">{t('userManage.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.username === currentUser;
                return (
                  <tr key={user.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-2 px-4">{user.id}</td>
                    <td className="py-2 px-4 text-white font-medium">
                      {user.username}
                      {isSelf && <span className="ml-2 text-xs text-slate-500">{t('userManage.you')}</span>}
                    </td>
                    <td className="py-2 px-4">
                      <span
                        className={`inline-block whitespace-nowrap px-2 py-0.5 rounded text-xs font-semibold ${
                          user.role === 'admin'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {user.role === 'admin' ? t('userManage.roleAdmin') : t('userManage.roleUser')}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-slate-300 text-sm">{user.security_question}</td>
                    <td className="py-2 px-4 text-slate-400 text-sm">{user.created_at || 'N/A'}</td>
                    <td className="py-2 px-4">
                      <div className="flex gap-2">
                        <button
                          disabled={isSelf}
                          onClick={() => handleToggleRole(user)}
                          className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        >
                          {user.role === 'admin' ? t('userManage.setAsUser') : t('userManage.setAsAdmin')}
                        </button>
                        <button
                          onClick={() => {
                            setTargetUser(user);
                            setModalMode('reset-password');
                          }}
                          className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors whitespace-nowrap"
                        >
                          {t('userManage.resetPassword')}
                        </button>
                        <button
                          disabled={isSelf}
                          onClick={() => {
                            setTargetUser(user);
                            setModalMode('delete');
                          }}
                          className="px-2 py-1 text-xs rounded bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        >
                          {t('userManage.deleteButton')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalMode === 'create'} onClose={closeModal} title={t('userManage.createUserTitle')}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">{t('auth.username')}</label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              required
              className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">{t('userManage.password')}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">{t('userManage.role')}</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white"
            >
              <option value="user">{t('userManage.roleUser')}</option>
              <option value="admin">{t('userManage.roleAdmin')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">{t('auth.securityQuestion')}</label>
            <select
              value={newSecurityQuestion}
              onChange={(e) => setNewSecurityQuestion(e.target.value)}
              className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white"
            >
              {SECURITY_QUESTIONS.map((q, i) => (
                <option key={q} value={q}>
                  {t(SECURITY_QUESTION_KEYS[i])}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">{t('userManage.securityAnswer')}</label>
            <input
              type="text"
              value={newSecurityAnswer}
              onChange={(e) => setNewSecurityAnswer(e.target.value)}
              required
              className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-sm rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm rounded bg-blue-600 hover:bg-blue-500 font-semibold transition-colors disabled:opacity-50"
            >
              {t('userManage.createButton')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={modalMode === 'reset-password'}
        onClose={closeModal}
        title={`${t('userManage.resetPasswordTitle')}${targetUser?.username ?? ''}`}
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">{t('auth.newPassword')}</label>
            <input
              type="password"
              value={resetPasswordValue}
              onChange={(e) => setResetPasswordValue(e.target.value)}
              required
              className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-sm rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm rounded bg-blue-600 hover:bg-blue-500 font-semibold transition-colors disabled:opacity-50"
            >
              {t('userManage.confirmResetButton')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={modalMode === 'delete'} onClose={closeModal} title={t('userManage.deleteTitle')}>
        <div className="space-y-4">
          <p className="text-slate-200">
            {t('userManage.confirmDeleteText1')} <span className="font-semibold text-white">{targetUser?.username}</span>{' '}
            {t('userManage.confirmDeleteText2')}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-sm rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleDelete}
              className="px-4 py-2 text-sm rounded bg-red-600 hover:bg-red-500 font-semibold transition-colors disabled:opacity-50"
            >
              {t('userManage.confirmDeleteButton')}
            </button>
          </div>
        </div>
      </Modal>

      <ErrorModal isOpen={errorMessage !== ''} onClose={() => setErrorMessage('')} message={errorMessage} />
    </div>
  );
}
