/** The Overview's reporting currency (owner's brief, Part B): converted amounts are whole minor units and say "≈". */
import { convertMinor, showTotal, totalIn } from './fx';

const rates = { USD: 1, AED: 3.6725, QAR: 3.64, KWD: 0.307, JPY: 150, INR: 84.25 };

it('converts between currencies, in whole minor units of the one converted to', () => {
  expect(convertMinor(36_725, 'AED', 'USD', rates)).toBe(10_000);
  expect(convertMinor(10_000, 'USD', 'AED', rates)).toBe(36_725);
  // 3 decimals and 0 decimals.
  expect(convertMinor(10_000, 'USD', 'KWD', rates)).toBe(30_700);
  expect(convertMinor(10_000, 'USD', 'JPY', rates)).toBe(15_000);
  expect(convertMinor(4_990, 'QAR', 'USD', rates)).toBe(1_371);
  expect(convertMinor(500, 'USD', 'USD', {})).toBe(500);
});

it('gives no amount without a rate', () => {
  expect(convertMinor(100, 'CAD', 'USD', rates)).toBeNull();
  expect(convertMinor(100, 'USD', 'XYZ', { ...rates, XYZ: 2 })).toBeNull();
});

it('adds several currencies into one, says when any was converted, and names the ones it could not', () => {
  expect(totalIn([{ currency: 'USD', minor: 4_299 }], 'USD', rates)).toEqual({ currency: 'USD', minor: 4_299, approx: false, missing: [] });
  const t = totalIn(
    [
      { currency: 'USD', minor: 4_299 },
      { currency: 'AED', minor: 9_900 },
      { currency: 'CAD', minor: 1_000 },
      { currency: 'CAD', minor: 2_000 },
    ],
    'USD',
    rates,
  );
  expect(t).toEqual({ currency: 'USD', minor: 4_299 + 2_696, approx: true, missing: ['CAD'] });
  // Money is written with a no-break space between the currency and the number.
  expect(showTotal(t).replace(/\u00a0/g, ' ')).toBe('≈ USD 69.95');
  expect(showTotal({ currency: 'AED', minor: 9_900, approx: false }).replace(/\u00a0/g, ' ')).toBe('AED 99.00');
});
