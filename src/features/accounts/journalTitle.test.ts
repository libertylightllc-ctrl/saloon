/**
 * Every journal note the server writes (each post_journal and post_stock_change call in the migrations) is known to a
 * rule and reads in all 7 languages (owner's app check E8). A new note fails here until it gets a rule.
 */
import { createInstance } from 'i18next';

import { callArguments, samples } from '@/features/activity/sqlSamples';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import hi from '@/locales/hi.json';
import pt from '@/locales/pt.json';
import ur from '@/locales/ur.json';

import { journalRule, journalTitle } from './journalTitle';

const LOCALES = { en, ar, hi, ur, es, fr, pt } as const;

// p_memo is the note handed to post_stock_change, read from its own callers.
const notes = [...callArguments('post_journal', 5), ...callArguments('post_stock_change', 4)]
  .filter((expr) => expr !== 'p_memo')
  .flatMap(samples);
// "PUR-00012 · Supplier" has no words to translate.
const worded = notes.filter((n) => !/^PUR-\d+ · /.test(n));

async function translator(lng: keyof typeof LOCALES) {
  const i18n = createInstance();
  await i18n.init({ lng, fallbackLng: false, resources: { [lng]: { translation: LOCALES[lng] } }, interpolation: { escapeValue: false } });
  return (memo: string) => journalTitle(memo, i18n.t, (d, p) => `${d}|${p}`);
}

describe('journal titles (E8)', () => {
  it('finds the notes in the migrations', () => {
    expect(worded.length).toBeGreaterThan(20);
  });

  it.each(worded)('a rule knows "%s"', (note) => {
    expect(journalRule(note)).not.toBeNull();
  });

  it.each(Object.keys(LOCALES) as (keyof typeof LOCALES)[])('every note reads in %s', async (lng) => {
    const title = await translator(lng);
    for (const note of worded) expect({ note, out: title(note) }).toEqual({ note, out: expect.not.stringMatching(/\{\{|accounts\.memo/) });
  });

  it('names the month and the day (the owner’s examples)', async () => {
    const title = await translator('en');
    expect(title('Payroll 2026-10')).toBe('2026-10-01|MMMM yyyy payroll');
    expect(title('Cash close 2026-10-25')).toBe('Cash close · 2026-10-25|d MMM yyyy');
    expect(title('Cash added · from the owner · Change for the day')).toBe('Cash added from the owner · Change for the day');
    expect(title('Paid Gulf Salon Supplies · bill #12')).toBe('Paid Gulf Salon Supplies · bill #12');
    expect(title('Something else')).toBe('Something else');
    const arabic = await translator('ar');
    expect(arabic('Sale #1004')).toBe('البيع رقم 1004');
    expect(arabic('Expense · Tea & Food')).toBe('مصروف · Tea & Food');
  });
});
