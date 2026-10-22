/**
 * Every language's words, for the phone apps (all inside the app, nothing to download). The web build uses
 * locales.web.ts, which loads a language only when it is used (website brief 4.4). English is in i18n.ts itself.
 */
import ar from '@/locales/ar.json';
import type en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import hi from '@/locales/hi.json';
import pt from '@/locales/pt.json';
import ur from '@/locales/ur.json';

export type Words = typeof en;
type OtherLanguage = 'ar' | 'hi' | 'ur' | 'es' | 'fr' | 'pt';

const ALL: Record<OtherLanguage, unknown> = { ar, hi, ur, es, fr, pt };

export async function loadWords(language: OtherLanguage): Promise<Words> {
  return ALL[language] as Words;
}
