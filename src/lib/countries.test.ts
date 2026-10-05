import { COUNTRIES, countryOf, isUae } from './countries';
import { CURRENCIES, denominationsOf, isCurrency } from './currencies';
import { formatMoney, parseMoney, setActiveCurrency } from './money';

describe('countries and currencies', () => {
  it('every country has a known currency, a time zone and a sane tax default', () => {
    for (const c of COUNTRIES) {
      expect(isCurrency(c.currency)).toBe(true);
      expect(c.timezones.length).toBeGreaterThan(0);
      expect(c.tax.rateBps).toBeGreaterThanOrEqual(0);
      expect(c.tax.rateBps).toBeLessThanOrEqual(3000);
      expect(c.dial).toMatch(/^\+\d{1,4}$/);
    }
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
  });

  it('the UAE keeps its defaults and its own features', () => {
    expect(countryOf('AE')).toMatchObject({ currency: 'AED', timezones: ['Asia/Dubai'], tax: { rateBps: 500, idLabel: 'TRN' } });
    expect(isUae('AE')).toBe(true);
    expect(isUae('SA')).toBe(false);
    expect(isUae(null)).toBe(true); // salons set up before countries existed are in the UAE
  });

  it('cash denominations are whole minor units, largest first', () => {
    for (const code of Object.keys(CURRENCIES) as (keyof typeof CURRENCIES)[]) {
      const d = denominationsOf(code);
      expect(d.every((x) => Number.isInteger(x.minor) && x.minor > 0)).toBe(true);
    }
    expect(denominationsOf('KWD').map((d) => d.minor)).toEqual([20000, 10000, 5000, 1000, 500, 250, 100, 50, 20, 10, 5]);
    expect(denominationsOf('AED').slice(-3).map((d) => d.minor)).toEqual([100, 50, 25]);
  });

  it('amounts show and parse in the salon currency, including 0 and 3 decimals', () => {
    setActiveCurrency('JPY');
    expect(formatMoney(15000)).toBe('JPY\u00a015,000');
    expect(parseMoney('1,500')).toBe(1500);
    expect(parseMoney('1.5')).toBeNull();
    setActiveCurrency('KWD');
    expect(formatMoney(1250)).toBe('KWD\u00a01.250');
    setActiveCurrency('XYZ');
    expect(formatMoney(100)).toBe('AED\u00a01.00'); // unknown → the default
    setActiveCurrency(null);
  });
});
