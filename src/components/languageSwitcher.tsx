// src/components/languageSwitcher.tsx
import { useTranslation } from 'react-i18next';
import { setLanguage, type SupportedLanguage } from '../i18n';

/**
 * Language switcher — extracted into its own component so both pre-login
 * screens (App.tsx's login screen, register.tsx, forgetpassword.tsx) and
 * post-login (navbar.tsx) can share the same control, instead of only
 * being reachable from the post-login Navbar. The earlier version lived
 * only inside navbar.tsx, which meant the login screen was permanently
 * stuck on the default language with no way to switch.
 */
export default function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();

  return (
    <select
      aria-label={t('navbar.language')}
      value={i18n.language}
      onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
      className={
        className ??
        'bg-slate-700 text-slate-200 text-xs rounded px-2 py-1.5 border border-slate-600 hover:bg-slate-600 transition-colors'
      }
    >
      <option value="zh-TW">繁體中文</option>
      <option value="en">English</option>
    </select>
  );
}
