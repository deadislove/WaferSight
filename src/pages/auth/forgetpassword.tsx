// src/pages/forgetpassword.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSecurityQuestionService, resetPasswordService } from '../../services/auth/authService';
import LanguageSwitcher from '../../components/languageSwitcher';

interface ForgetPasswordProps {
  onBackToLogin: () => void;
}

export default function ForgetPassword({ onBackToLogin }: ForgetPasswordProps) {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [fetchedQuestion, setFetchedQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFetchQuestion = async () => {
    setError('');
    setSuccess('');

    const res = await getSecurityQuestionService(username);
    
    if (res.success && res.question) {
      setFetchedQuestion(res.question);
      setSuccess(t('auth.questionFetched'));
    } else {
      setFetchedQuestion('');
      setError(res.error || t('auth.fetchQuestionFailedGeneric'));
    }
  };

  // Step 2: call the service to reset the password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const res = await resetPasswordService({
      username,
      securityAnswer,
      newPassword,
    });

    if (res.success) {
      setSuccess(t('auth.resetSuccess'));
      setTimeout(() => {
        onBackToLogin();
      }, 1500);
    } else {
      setError(res.error || t('auth.resetFailedGeneric'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="bg-slate-800 p-8 rounded-xl shadow-lg border border-slate-700 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-blue-400">{t('auth.forgotTitle')}</h1>

        {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500 text-red-300 rounded text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500 text-emerald-300 rounded text-sm">{success}</div>}

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">{t('auth.username')}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setFetchedQuestion('');
              }}
              required
              disabled={fetchedQuestion !== ''}
              className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white disabled:opacity-50"
            />
          </div>

          {!fetchedQuestion ? (
            <button
              type="button"
              onClick={handleFetchQuestion}
              className="w-full py-2 bg-slate-600 hover:bg-slate-500 font-semibold rounded mt-2 transition-colors"
            >
              {t('auth.fetchQuestionButton')}
            </button>
          ) : (
            <>
              <div className="p-3 bg-slate-700 rounded text-sm text-blue-200">
                {t('auth.securityQuestionLabel')}{fetchedQuestion}
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">{t('auth.securityAnswer')}</label>
                <input
                  type="text"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">{t('auth.newPassword')}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 font-semibold rounded mt-2 transition-colors"
              >
                {t('auth.confirmResetButton')}
              </button>
            </>
          )}
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onBackToLogin}
            className="text-sm text-blue-400 hover:underline"
          >
            {t('auth.backToLogin')}
          </button>
        </div>
      </div>
    </div>
  );
}