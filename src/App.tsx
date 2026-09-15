// src/App.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { loginService } from './services/auth/authService';
import { NotificationProvider } from './contexts/notificationContext';
import { QualityDataProvider } from './contexts/qualityDataContext';
import LanguageSwitcher from './components/languageSwitcher';
import Home from './pages/home';
import AdminHome from './pages/admin/adminHome';
import ForgetPassword from './pages/auth/forgetpassword';
import Register from './pages/auth/register';

type AuthMode = 'login' | 'register' | 'forgot';

export default function App() {
  const { t } = useTranslation();
  const [authMode, setAuthMode] = useState<AuthMode>('login');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [token, setToken] = useState<string | null>(localStorage.getItem('jwt_token'));
  const [currentUser, setCurrentUser] = useState<string | null>(localStorage.getItem('current_user'));
  const [currentRole, setCurrentRole] = useState<string | null>(localStorage.getItem('current_role'));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const res = await loginService({ username, password });
    if (res.success && res.token) {
      const role = res.user?.role || 'user';
      setToken(res.token);
      setCurrentUser(res.user?.username || username);
      setCurrentRole(role);
      localStorage.setItem('jwt_token', res.token);
      localStorage.setItem('current_user', res.user?.username || username);
      localStorage.setItem('current_role', role);
    } else {
      setError(res.error || t('auth.loginFailedGeneric'));
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    setCurrentRole(null);

    localStorage.removeItem('jwt_token');
    localStorage.removeItem('current_user');
    localStorage.removeItem('current_role');
    setUsername('');
    setPassword('');
  };

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onForceLogout) {
      window.electronAPI.onForceLogout(() => {
        handleLogout();
      });
    }
  }, []);

  if (token) {
    if (currentRole === 'admin') {
      return (
        <NotificationProvider>
          <QualityDataProvider>
            <AdminHome currentUser={currentUser} token={token} onLogout={handleLogout} />
          </QualityDataProvider>
        </NotificationProvider>
      );
    }
    return (
      <NotificationProvider>
        <QualityDataProvider>
          <Home currentUser={currentUser} token={token} onLogout={handleLogout} />
        </QualityDataProvider>
      </NotificationProvider>
    );
  }

  if (authMode === 'forgot') {
    return <ForgetPassword onBackToLogin={() => setAuthMode('login')} />;
  }

  if (authMode === 'register') {
    return <Register onBackToLogin={() => setAuthMode('login')} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="bg-slate-800 p-8 rounded-xl shadow-lg border border-slate-700 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-blue-400">{t('auth.systemLogin')}</h1>

        {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500 text-red-300 rounded text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500 text-emerald-300 rounded text-sm">{success}</div>}

        <form onSubmit={handleLogin} className="space-y-4">
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

          <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-500 font-semibold rounded mt-2 transition-colors">
            {t('auth.loginButton')}
          </button>
        </form>

        <div className="mt-6 flex justify-between text-sm text-blue-400">
          <button type="button" onClick={() => { setAuthMode('register'); setError(''); setSuccess(''); }} className="hover:underline">{t('auth.registerLink')}</button>
          <button type="button" onClick={() => { setAuthMode('forgot'); setError(''); setSuccess(''); }} className="hover:underline">{t('auth.forgotLink')}</button>
        </div>
      </div>
    </div>
  );
}