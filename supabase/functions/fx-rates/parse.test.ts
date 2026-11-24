/** The day's exchange rates (owner's brief, Part B): only a full table per US dollar is saved. */
import { parseRates } from './parse';

const full = Object.fromEntries(
  ['USD', 'AED', 'SAR', 'QAR', 'INR', 'CAD', 'EUR', 'GBP', 'PKR', 'EGP', 'KWD', 'BHD', 'OMR', 'JOD', 'TRY', 'ZAR', 'NGN', 'KES', 'AUD', 'JPY'].map(
    (c, i) => [c, c === 'USD' ? 1 : i + 0.5],
  ),
);

it('reads the day (UTC) and the rates', () => {
  // 25 Nov 2026 00:02:31 UTC (still 24 Nov in some places, 25 Nov as the service counts it).
  const got = parseRates({ result: 'success', base_code: 'USD', time_last_update_unix: 1795564951, rates: { ...full, XAU: 0.0004 } });
  expect(got?.day).toBe('2026-11-25');
  expect(got?.rates.AED).toBe(1.5);
  expect(Object.keys(got?.rates ?? {})).toHaveLength(21);
});

it('leaves out what is not a positive number', () => {
  const got = parseRates({ result: 'success', base_code: 'USD', time_last_update_unix: 1795564951, rates: { ...full, BAD: -1, ODD: 'x', lower: 2 } });
  expect(got?.rates).not.toHaveProperty('BAD');
  expect(got?.rates).not.toHaveProperty('ODD');
  expect(got?.rates).not.toHaveProperty('lower');
});

it('refuses a reply that is not a full table per US dollar', () => {
  const base = { result: 'success', base_code: 'USD', time_last_update_unix: 1795564951 };
  expect(parseRates({ ...base, result: 'error', rates: full })).toBeNull();
  expect(parseRates({ ...base, base_code: 'EUR', rates: full })).toBeNull();
  expect(parseRates({ ...base, rates: { USD: 1, AED: 3.6725 } })).toBeNull();
  expect(parseRates({ ...base, rates: { ...full, USD: 1.1 } })).toBeNull();
  expect(parseRates({ result: 'success', base_code: 'USD', rates: full })).toBeNull();
});
