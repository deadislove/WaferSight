// src/components/BottomBar.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function BottomBar() {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    window.electronAPI?.onNetStatusChange((status) => {
      setIsOnline(status);
    });
  }, []);

  return (
    <footer className="bg-slate-950 border-t border-slate-800 px-6 py-2 text-xs flex justify-between items-center text-slate-400">
      <div className="flex items-center gap-2">
        {/* Status indicator dot: green = online, red = offline */}
        <span 
          className={`w-2.5 h-2.5 rounded-full transition-colors ${
            isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
          }`} 
        />
        <span className="font-medium">
          {isOnline ? t('bottombar.online') : t('bottombar.offline')}
        </span>
      </div>
      <div>
        <span className="text-slate-500">{t('bottombar.protecting')}</span>
      </div>
    </footer>
  );
}