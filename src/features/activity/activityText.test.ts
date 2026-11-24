/**
 * Every activity sentence the server has ever written (each write_audit call in the migrations, old versions too, and
 * the staff-login edge function) is known to a rule in rules.ts and has its words in all 7 languages (owner's app
 * check E3). A new sentence in a migration fails here until it gets a rule.
 */
import { createInstance } from 'i18next';

import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import hi from '@/locales/hi.json';
import pt from '@/locales/pt.json';
import ur from '@/locales/ur.json';

import { matchActivity, translateActivity } from './activityText';
import { ACTIVITY_RULES } from './rules';
import { callArguments, samples } from './sqlSamples';

const LOCALES = { en, ar, hi, ur, es, fr, pt } as const;

/** The summary argument of every write_audit call in the migrations. */
const auditSummaries = () => callArguments('write_audit', 6);

const EDGE_FUNCTION_SENTENCES = ['Reset password for Sana', 'Enabled login for Sana', 'Disabled login for Sana'];

async function translator(lng: keyof typeof LOCALES) {
  const i18n = createInstance();
  await i18n.init({
    lng,
    fallbackLng: false,
    resources: { [lng]: { translation: LOCALES[lng] } },
    interpolation: { escapeValue: false },
  });
  return (summary: string) => translateActivity(summary, i18n.t, (d, p) => `${d}|${p}`);
}

describe('activity sentences (E3)', () => {
  const sentences = [...auditSummaries().flatMap(samples), ...EDGE_FUNCTION_SENTENCES];

  it('finds the sentences in the migrations', () => {
    expect(sentences.length).toBeGreaterThan(100);
  });

  it.each(sentences)('a rule knows "%s"', (sentence) => {
    expect(matchActivity(sentence)?.rule.key).toBeDefined();
  });

  it.each(Object.keys(LOCALES) as (keyof typeof LOCALES)[])('every sentence reads in %s, with nothing left out', async (lng) => {
    const text = await translator(lng);
    for (const sentence of sentences) {
      expect({ sentence, out: text(sentence) }).toEqual({ sentence, out: expect.not.stringMatching(/\{\{|activity\./) });
    }
  });

  it('each rule names the same values in English as it takes out', () => {
    const activity = en.activity as unknown as Record<string, Record<string, string>>;
    for (const rule of ACTIVITY_RULES) {
      const names = (s: string) => new Set([...s.matchAll(/\{(\w+)(?::(\w+))?\??\}/g)].filter((m) => m[2] !== 'items').map((m) => m[1]!));
      const taken = new Set([...names(rule.en), ...Object.values(rule.parts ?? {}).flatMap((p) => [...names(p)])]);
      const said = new Set(
        Object.values(activity[rule.key] ?? {}).flatMap((s) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!)),
      );
      expect([rule.key, [...said].sort()]).toEqual([rule.key, [...taken].sort()]);
    }
  });

  it('shows a sentence in Arabic with its values, and an unknown one as written', async () => {
    const text = await translator('ar');
    expect(text('Saved sale #1004 · QAR 40.00')).toBe('حُفظ البيع رقم 1004 · QAR 40.00');
    expect(text('Asked for the plan: 1 month(s)')).toBe('طلب الاشتراك: شهر واحد');
    expect(text('Marie clocked in at 09:37 (late 12 min) — recorded by Owner')).toBe(
      'Marie سجّل الحضور الساعة 09:37 (متأخر 12 د) — سجّله Owner',
    );
    expect(text('Something new happened')).toBe('Something new happened');
  });

  it('says how late in hours and minutes, as the attendance board does (owner’s brief A8)', async () => {
    const text = await translator('en');
    expect(text('Marie clocked in at 22:03 (late 723 min)')).toBe('Marie clocked in at 22:03 (late 12 h 3 min)');
    expect(text('Marie clocked in at 09:12 (late 12 min)')).toBe('Marie clocked in at 09:12 (late 12 min)');
    expect(text('Approved payroll 2026-11: net QAR 4,900.00')).toMatch(/^Approved payroll for 2026-11-01\|MMMM yyyy: net QAR 4,900\.00$/);
    // Approved before the month ended, with the owner's reason (A10).
    expect(text('Approved payroll 2026-11 before the month ended (Staff travelling): net QAR 4,900.00')).toMatch(
      /^Approved payroll for 2026-11-01\|MMMM yyyy before the month ended \(Staff travelling\): net QAR 4,900\.00$/,
    );
  });

  it('reads plural counts in English', async () => {
    const text = await translator('en');
    expect(text('Counted 1 items, 1 changed, value -AED 150.00')).toBe('Counted 1 item, 1 changed, value -AED 150.00');
    expect(text('Asked for the plan: 6 month(s)')).toBe('Asked for the plan: 6 months');
    expect(text('Paid 2026-10 salary AED 3,210.00 to Marie by bank on 2026-10-30')).toBe(
      'Paid 2026-10-01|MMMM yyyy salary AED 3,210.00 to Marie by bank transfer on 2026-10-30|d MMM yyyy',
    );
  });
});
