import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhTW from './locales/zh-TW.json';
import en from './locales/en.json';

const STORAGE_KEY = 'app_language';

export type SupportedLanguage = 'zh-TW' | 'en';

function getInitialLanguage(): SupportedLanguage {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'en' ? 'en' : 'zh-TW';
}

i18n.use(initReactI18next).init({
  resources: {
    'zh-TW': { translation: zhTW },
    en: { translation: en },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'zh-TW',
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: SupportedLanguage): void {
  localStorage.setItem(STORAGE_KEY, lang);
  i18n.changeLanguage(lang);
}

export default i18n;
