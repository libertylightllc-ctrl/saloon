import 'intl-pluralrules'; // Hermes lacks full Intl.PluralRules; Arabic has six plural forms.
import { createInstance, type FormatterModule } from 'i18next';
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

const FIRST_STRONG_ISOLATE = '\u2068';
const POP_DIRECTIONAL_ISOLATE = '\u2069';

/**
 * In Arabic and Urdu, wrap each inserted value (names, amounts, "#1043", stock lists) in a
 * Unicode isolate so Latin text and numbers keep their own direction inside the RTL sentence.
 * Without it "(Neck strips 1, …)" and "#1043" come out scrambled.
 */
export function isolateForRtl<T>(value: T, language?: string): T | string {
  if (value === undefined || value === null || typeof value === 'object') return value;
  if (!isLanguage(language) || !isRtlLanguage(language)) return value;
  return `${FIRST_STRONG_ISOLATE}${String(value)}${POP_DIRECTIONAL_ISOLATE}`;
}

/** Replaces i18next's built-in formatter (we use no named formats) to isolate RTL values. */
const rtlIsolation: FormatterModule = {
  type: 'formatter',
  init: () => {},
  // Non-string values (undefined = missing variable) pass through untouched.
  format: (value, _format, lng) => isolateForRtl(value, lng) as string,
  add: () => {},
  addCached: () => {},
};

export async function initI18n(language: Language): Promise<typeof i18n> {
  if (i18n.isInitialized) {
    await i18n.changeLanguage(language);
    return i18n;
  }
  await i18n
    .use(initReactI18next)
    .use(rtlIsolation)
    .init({
      resources,
      lng: language,
      fallbackLng: DEFAULT_LANGUAGE,
      interpolation: {
        escapeValue: false, // React already escapes
        alwaysFormat: true, // run every value through rtlIsolation
      },
      returnNull: false,
    });
  return i18n;
}
