// src/pages/subpages/UserProfilePage.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface UserProfilePageProps {
  currentUser: string | null;
}

export default function UserProfilePage({ currentUser }: UserProfilePageProps) {
  const { t } = useTranslation();
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // const res = await window.electronAPI.updatePassword({ username: currentUser, newPassword });
    setSuccess(t('userProfile.updatingNotice'));
  };

  return (
    <div className="w-full max-w-xl bg-slate-800 p-8 rounded-xl shadow-lg border border-slate-700">
      <h3 className="text-2xl font-bold mb-6 text-blue-400">{t('userProfile.title')}</h3>

      {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500 text-red-300 rounded text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500 text-emerald-300 rounded text-sm">{success}</div>}

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm text-slate-400 mb-1">{t('userProfile.currentAccount')}</label>
          <div className="px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white font-medium">
            {currentUser || t('userProfile.unknownUser')}
          </div>
        </div>
      </div>

      <hr className="border-slate-700 my-6" />

      <form onSubmit={handleUpdatePassword} className="space-y-4">
        <h4 className="text-lg font-semibold text-white">{t('userProfile.changePassword')}</h4>
        <div>
          <label className="block text-sm text-slate-300 mb-1">{t('userProfile.newPassword')}</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t('userProfile.newPasswordPlaceholder')}
            className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white"
          />
        </div>
        <button
          type="submit"
          className="w-full py-2 bg-blue-600 hover:bg-blue-500 font-semibold rounded transition-colors"
        >
          {t('userProfile.updateButton')}
        </button>
      </form>
    </div>
  );
}