import 'intl-pluralrules'; // Hermes lacks full Intl.PluralRules; Arabic has six plural forms.
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import hi from '@/locales/hi.json';
import ur from '@/locales/ur.json';

/** Native names are shown untranslated so people can always find their own language. */
export const LANGUAGES = [
  { code: 'en', nativeName: 'English', rtl: false },
  { code: 'ar', nativeName: 'العربية', rtl: true },
  { code: 'hi', nativeName: 'हिन्दी', rtl: false },
  { code: 'ur', nativeName: 'اردو', rtl: true },
] as const;

export type Language = (typeof LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE: Language = 'en';

/** The app's single i18next instance (also registered with react-i18next on init). */
export const i18n = createInstance();

export const resources = {
  en: { translation: en },
  ar: { translation: ar },
  hi: { translation: hi },
  ur: { translation: ur },
} as const;

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((l) => l.code === value);
}

export function isRtlLanguage(language: Language): boolean {
  return LANGUAGES.find((l) => l.code === language)?.rtl ?? false;
}

export async function initI18n(language: Language): Promise<typeof i18n> {
  if (i18n.isInitialized) {
    await i18n.changeLanguage(language);
    return i18n;
  }
  await i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
  });
  return i18n;
}
