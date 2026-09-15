// src/pages/auth/register.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { registerService } from '../../services/auth/authService';
import LanguageSwitcher from '../../components/languageSwitcher';

interface RegisterProps {
  onBackToLogin: () => void;
}

const SECURITY_QUESTIONS = [
  '你的第一隻寵物叫什麼名字？',
  '你畢業的國小名稱？',
  '你最喜歡的城市？',
];
const SECURITY_QUESTION_KEYS = ['auth.securityQ1', 'auth.securityQ2', 'auth.securityQ3'];

export default function Register({ onBackToLogin }: RegisterProps) {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const res = await registerService({
      username,
      password,
      securityQuestion,
      securityAnswer,
    });

    if (res.success) {
      setSuccess(t('auth.registerSuccess'));
      setTimeout(() => {
        onBackToLogin();
      }, 1500);
    } else {
      setError(res.error || t('auth.registerFailedGeneric'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="bg-slate-800 p-8 rounded-xl shadow-lg border border-slate-700 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-blue-400">{t('auth.registerTitle')}</h1>

        {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500 text-red-300 rounded text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500 text-emerald-300 rounded text-sm">{success}</div>}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">{t('auth.username')}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">{t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">{t('auth.securityQuestion')}</label>
            <select
              value={securityQuestion}
              onChange={(e) => setSecurityQuestion(e.target.value)}
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
            <label className="block text-sm text-slate-300 mb-1">{t('auth.securityAnswer')}</label>
            <input
              type="text"
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
              required
              className="w-full px-4 py-2 rounded bg-slate-900 border border-slate-700 text-white"
            />
          </div>

          <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-500 font-semibold rounded mt-2 transition-colors">
            {t('auth.registerButton')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button type="button" onClick={onBackToLogin} className="text-sm text-blue-400 hover:underline">
            {t('auth.hasAccount')}
          </button>
        </div>
      </div>
    </div>
  );
}