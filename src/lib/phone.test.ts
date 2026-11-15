import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { COUNTRIES } from './countries';
import { normalizePhone, PHONE_RULES, phoneOk, phoneToSave } from './phone';

/** Typed, salon country → saved (null: refused). The database test (85_phone_numbers) checks the same numbers. */
const CASES: [string, string | null, string | null][] = [
  ['55512345', 'QA', '+974 5551 2345'],
  ['5551 2345', 'QA', '+974 5551 2345'],
  ['+974 5551 2345', 'QA', '+974 5551 2345'],
  ['97455512345', 'QA', '+974 5551 2345'],
  ['0501234567', 'AE', '+971 50 123 4567'],
  ['050 123 4567', 'AE', '+971 50 123 4567'],
  ['501234567', 'AE', '+971 50 123 4567'],
  ['+971 050 123 4567', 'AE', '+971 50 123 4567'],
  ['00971501234567', 'AE', '+971 50 123 4567'],
  ['043214567', 'AE', '+971 4321 4567'],
  ['+44 7911 123456', 'AE', '+44 791 112 3456'],
  ['(202) 555-0123', 'US', '+1 202 555 0123'],
  ['1 202 555 0123', 'US', '+1 202 555 0123'],
  ['+1 416 555 0123', 'CA', '+1 416 555 0123'],
  ['06 1234 5678', 'IT', '+39 061 234 5678'],
  ['+880 1712 345678', 'AE', '+880 171 234 5678'],
  ['000000000', 'AE', null],
  ['555555555', 'AE', null],
  ['+971 555 555 555', 'AE', null],
  ['12345', 'QA', null],
  ['555123456', 'QA', null],
  ['abc', 'AE', null],
  ['50-123-4567x', 'AE', null],
  ['55512345', null, null],
  ['+99912345678', null, '+99912345678'],
];

describe('phone numbers (F1)', () => {
  it.each(CASES)('"%s" in %s → %s', (typed, country, saved) => {
    expect(normalizePhone(typed, country)).toEqual(saved === null ? { ok: false } : { ok: true, phone: saved });
  });

  it('takes no number as no number', () => {
    expect(normalizePhone('  ', 'AE')).toEqual({ ok: true, phone: null });
    expect(phoneOk('', 'AE')).toBe(true);
    expect(phoneToSave('', 'AE')).toBeNull();
    expect(phoneToSave('55512345', 'QA')).toBe('+974 5551 2345');
  });

  it('has a rule for every country the app offers', () => {
    for (const c of COUNTRIES) {
      expect([c.code, PHONE_RULES[c.code]?.dial]).toEqual([c.code, c.dial.replace(/\D/g, '')]);
    }
  });

  it('has the same rules as the database (migration 106)', () => {
    const dir = join(__dirname, '../../supabase/migrations');
    const file = readdirSync(dir).find((f) => f.endsWith('_phone_numbers.sql'))!;
    const sql = readFileSync(join(dir, file), 'utf8');
    const rows = [...sql.matchAll(/\('([A-Z]{2})', '(\d+)', (\d+), (\d+), '(\d*)'\)/g)].map((m) => [m[1], m[2], Number(m[3]), Number(m[4]), m[5]]);
    const ts = Object.entries(PHONE_RULES).map(([code, p]) => [code, p.dial, p.min, p.max, p.trunk]);
    expect(rows).toEqual(ts);
  });
});
