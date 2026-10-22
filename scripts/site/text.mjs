/**
 * The website's words, from the app's own locale files (src/locales/*.json), so the home page and the app never say
 * different things. `t(lang)` works like the app's i18next calls: dotted keys, {{value}} placeholders, and plural
 * forms (`_one`, `_other`, … chosen by Intl.PluralRules), falling back to English.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** As src/lib/i18n.ts LANGUAGES; native names are never translated. English is the site's root. */
export const LANGUAGES = [
  { code: 'en', name: 'English', rtl: false },
  { code: 'ar', name: 'العربية', rtl: true },
  { code: 'hi', name: 'हिन्दी', rtl: false },
  { code: 'ur', name: 'اردو', rtl: true },
  { code: 'es', name: 'Español', rtl: false },
  { code: 'fr', name: 'Français', rtl: false },
  { code: 'pt', name: 'Português', rtl: false },
];

export const pathOf = (code) => (code === 'en' ? '/' : `/${code}`);

const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Text made safe for HTML. */
export const esc = (value) => String(value).replace(/[&<>"']/g, (c) => escapes[c]);

function lookup(tree, key) {
  return key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), tree);
}

/** A translator for one language: t(key, values) → plain text (escape it with esc() where it goes into HTML). */
export function translator(root, code) {
  const read = (lang) => JSON.parse(readFileSync(join(root, 'src', 'locales', `${lang}.json`), 'utf8'));
  const own = read(code);
  const english = code === 'en' ? own : read('en');
  const plural = new Intl.PluralRules(code);
  // As the app (isolateForRtl): values keep their own direction inside Arabic and Urdu sentences.
  const rtl = LANGUAGES.find((l) => l.code === code)?.rtl;
  const isolate = (value) => (rtl ? `\u2068${value}\u2069` : String(value));
  const find = (key, count) => {
    for (const tree of [own, english]) {
      if (count !== undefined) {
        const form = lookup(tree, `${key}_${plural.select(count)}`) ?? lookup(tree, `${key}_other`);
        if (typeof form === 'string') return form;
      }
      const plain = lookup(tree, key);
      if (typeof plain === 'string') return plain;
    }
    throw new Error(`Missing text: ${key}`);
  };
  return (key, values = {}) =>
    find(key, values.count).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) => {
      if (!(name in values)) throw new Error(`No value for {{${name}}} in ${key}`);
      return isolate(values[name]);
    });
}

/** Money as the app shows it ("AED 50.00", "USD 13.99"): the code, a no-break space, two decimals. */
export function money(minor, currency) {
  const amount = (minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency}\u00a0${amount}`;
}
