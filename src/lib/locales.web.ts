/**
 * The website loads a language's words only when it is used (website brief 4.4): one language instead of seven in
 * the first download. The phone apps use locales.ts. English is in i18n.ts itself.
 */
import type en from '@/locales/en.json';

export type Words = typeof en;
type OtherLanguage = 'ar' | 'hi' | 'ur' | 'es' | 'fr' | 'pt';

const LOADERS: Record<OtherLanguage, () => Promise<unknown>> = {
  ar: () => import('@/locales/ar.json'),
  hi: () => import('@/locales/hi.json'),
  ur: () => import('@/locales/ur.json'),
  es: () => import('@/locales/es.json'),
  fr: () => import('@/locales/fr.json'),
  pt: () => import('@/locales/pt.json'),
};

export async function loadWords(language: OtherLanguage): Promise<Words> {
  const loaded = (await LOADERS[language]()) as { default?: Words };
  return loaded.default ?? (loaded as Words);
}
