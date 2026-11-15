/**
 * Every activity sentence the server has ever written (each write_audit call in the migrations, old versions too, and
 * the staff-login edge function) is known to a rule in rules.ts and has its words in all 7 languages (owner's app
 * check E3). A new sentence in a migration fails here until it gets a rule.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

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

const LOCALES = { en, ar, hi, ur, es, fr, pt } as const;
const dir = join(__dirname, '../../../supabase/migrations');

/** Splits at a separator outside quotes, brackets and case … end. */
function splitTop(expr: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cases = 0;
  let quote = false;
  let cur = '';
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i]!;
    if (quote) {
      cur += c;
      if (c === "'") {
        if (expr[i + 1] === "'") {
          cur += "'";
          i++;
        } else quote = false;
      }
      continue;
    }
    if (c === "'") quote = true;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    const word = /^[a-z_]/i.test(c) && !/[a-z0-9_.]/i.test(expr[i - 1] ?? ' ') ? /^[a-z_]+/i.exec(expr.slice(i))![0] : '';
    if (word.toLowerCase() === 'case') cases++;
    if (word.toLowerCase() === 'end') cases--;
    if (depth === 0 && cases === 0 && expr.startsWith(sep, i)) {
      out.push(cur.trim());
      cur = '';
      i += sep.length - 1;
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

const literal = (s: string) => (/^'(?:[^']|'')*'$/.test(s) ? s.slice(1, -1).replace(/''/g, "'") : null);

/** A value a SQL expression could give, close enough to the real thing to be matched. */
function atom(expr: string): string {
  const e = expr.toLowerCase();
  if (e.includes('fmt_money')) return 'AED 12.50';
  if (e.startsWith('to_char')) {
    const fmt = [...expr.matchAll(/'([^']*)'/g)].pop()?.[1] ?? '';
    const sample: Record<string, string> = {
      'HH24:MI': '09:30',
      'DD Mon': '05 Oct',
      'FMDD Mon': '5 Oct',
      'DD Mon YYYY': '05 Oct 2026',
      'YYYY-MM-DD': '2026-10-05',
      'FM999999990.00': '50.00',
    };
    if (!(fmt in sample)) throw new Error(`no sample for to_char format ${fmt}`);
    return sample[fmt]!;
  }
  if (e.includes('purchase_no')) return 'PUR-00012';
  if (e.includes('doc_label')) return 'Trade licence';
  if (e.startsWith('initcap')) return 'Bonus';
  if (/\bperiod\b|p_month\b|p_period\b/.test(e)) return '2026-10';
  if (e.includes('v_method')) return 'bank';
  if (/\.kind\b|\bv_kind\b/.test(e)) return 'bonus';
  if (e.includes('role::text')) return 'manager';
  if (e.includes('mode::text')) return 'ladies';
  if (e.includes('free_until')) return '2026-12-31';
  if (e.includes('trim_scale')) return '-2';
  if (/number|v_items|v_changed|v_sort|minutes|count\(|array_length|floor\(|p_months|::int/.test(e)) return '3';
  return 'Sample Name';
}

/** Every sentence a summary expression can make (each branch of a case, each side of a coalesce). */
function samples(expr: string): string[] {
  let variants = [''];
  for (const part of splitTop(expr.trim(), '||')) {
    const options = pieces(part);
    variants = variants.flatMap((v) => options.map((o) => v + o)).slice(0, 64);
  }
  return variants;
}

function pieces(part: string): string[] {
  const lit = literal(part);
  if (lit !== null) return [lit];
  const lower = part.toLowerCase();
  if (lower.startsWith('(') && lower.endsWith(')') && splitTop(part.slice(1, -1), '||').length > 1) return samples(part.slice(1, -1));
  if (/^case\b/.test(lower)) {
    const body = part.replace(/^case\b/i, '').replace(/\bend$/i, '');
    return splitTop(body.replace(/\b(when|then|else)\b/gi, '\u0001$1'), '\u0001')
      .filter((b) => /^(then|else)\b/i.test(b))
      .flatMap((b) => samples(b.replace(/^(then|else)\b/i, '')));
  }
  if (lower.startsWith('coalesce(')) {
    const args = splitTop(part.slice('coalesce('.length, -1), ',');
    return [...samples(args[0]!), ...samples(args[args.length - 1]!)];
  }
  if (lower.startsWith('nullif(')) return samples(splitTop(part.slice('nullif('.length, -1), ',')[0]!);
  return [atom(part)];
}

/** The summary argument of every write_audit call in the migrations. */
function auditSummaries(): string[] {
  const found = new Set<string>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(dir, file), 'utf8').replace(/--[^\n]*/g, '');
    for (const m of sql.matchAll(/write_audit\s*\(/g)) {
      if (/function\s+public\.$/i.test(sql.slice(Math.max(0, m.index - 20), m.index))) continue;
      let depth = 0;
      let end = m.index + m[0].length - 1;
      let quote = false;
      for (; end < sql.length; end++) {
        const c = sql[end]!;
        if (c === "'") quote = !quote;
        if (quote) continue;
        if (c === '(') depth++;
        if (c === ')' && --depth === 0) break;
      }
      const args = splitTop(sql.slice(m.index + m[0].length, end), ',');
      // A list of argument types (grant, revoke), not a call.
      if (args.length >= 7 && !/^(uuid|text)$/i.test(args[0]!)) found.add(args[6]!.replace(/\s+/g, ' '));
    }
  }
  return [...found];
}

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

  it('reads plural counts in English', async () => {
    const text = await translator('en');
    expect(text('Counted 1 items, 1 changed, value -AED 150.00')).toBe('Counted 1 item, 1 changed, value -AED 150.00');
    expect(text('Asked for the plan: 6 month(s)')).toBe('Asked for the plan: 6 months');
    expect(text('Paid 2026-10 salary AED 3,210.00 to Marie by bank on 2026-10-30')).toBe(
      'Paid 2026-10-01|MMMM yyyy salary AED 3,210.00 to Marie by bank transfer on 2026-10-30|d MMM yyyy',
    );
  });
});
