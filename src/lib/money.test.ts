import {
  add,
  allocate,
  formatAmount,
  formatBps,
  formatMoney,
  multiply,
  normalizeDigits,
  parseMoney,
  parsePercent,
  percentOf,
  subtract,
  sum,
  vatFromInclusive,
  vatOnTop,
} from './money';

describe('formatMoney', () => {
  it('formats AED with code, grouping and two decimals', () => {
    expect(formatMoney(124000)).toBe('AED 1,240.00');
    expect(formatMoney(2500)).toBe('AED 25.00');
    expect(formatMoney(5)).toBe('AED 0.05');
    expect(formatMoney(0)).toBe('AED 0.00');
    expect(formatMoney(123456789)).toBe('AED 1,234,567.89');
  });

  it('puts the minus sign before the currency', () => {
    expect(formatMoney(-500)).toBe('-AED 5.00');
  });

  it('uses three decimals for KWD, BHD and OMR', () => {
    expect(formatMoney(1500, 'KWD')).toBe('KWD 1.500');
    expect(formatMoney(1234567, 'BHD')).toBe('BHD 1,234.567');
  });

  it('refuses floats', () => {
    expect(() => formatMoney(12.5)).toThrow(RangeError);
  });
});

describe('formatAmount', () => {
  it('can drop grouping for input fields', () => {
    expect(formatAmount(124050)).toBe('1,240.50');
    expect(formatAmount(124050, 'AED', { grouping: false })).toBe('1240.50');
    expect(formatAmount(-7)).toBe('-0.07');
  });
});

describe('parseMoney', () => {
  it('parses plain and grouped amounts into minor units', () => {
    expect(parseMoney('25')).toBe(2500);
    expect(parseMoney('1,240.5')).toBe(124050);
    expect(parseMoney(' 1 240.50 ')).toBe(124050);
    expect(parseMoney('0.05')).toBe(5);
    expect(parseMoney('.5')).toBeNull();
  });

  it('accepts a currency prefix and a minus sign', () => {
    expect(parseMoney('AED 25')).toBe(2500);
    expect(parseMoney('-AED 5.00')).toBe(-500);
    expect(parseMoney('-5')).toBe(-500);
  });

  it('rejects more decimals than the currency has', () => {
    expect(parseMoney('1.005')).toBeNull();
    expect(parseMoney('1.005', 'KWD')).toBe(1005);
  });

  it('rejects junk', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('1.2.3')).toBeNull();
    expect(parseMoney('USD 5')).toBeNull();
  });

  it('understands Arabic, Urdu and Hindi digits', () => {
    expect(parseMoney('٢٥٫٥٠')).toBe(2550);
    expect(parseMoney('۱۲۰')).toBe(12000);
    expect(parseMoney('४५')).toBe(4500);
  });

  it('never loses a fil to floating point', () => {
    // 0.1 + 0.2 style inputs: 1.15 * 100 is 114.99999999999999 in floats.
    expect(parseMoney('1.15')).toBe(115);
    expect(parseMoney('4.35')).toBe(435);
  });
});

describe('normalizeDigits', () => {
  it('leaves Latin text alone', () => {
    expect(normalizeDigits('AED 12.50')).toBe('AED 12.50');
  });
});

describe('arithmetic', () => {
  it('adds and subtracts integers only', () => {
    expect(add(2500, 1500, 1000)).toBe(5000);
    expect(sum([])).toBe(0);
    expect(subtract(1000, 2500)).toBe(-1500);
    expect(() => add(1, 0.5)).toThrow(RangeError);
  });

  it('multiplies by whole and fractional quantities', () => {
    expect(multiply(2500, 2)).toBe(5000);
    expect(multiply(999, '0.5')).toBe(500); // 499.5 rounds half away from zero
    expect(multiply(-999, '0.5')).toBe(-500);
    expect(multiply(1234, 1.25)).toBe(1543); // 1542.5 → 1543
    expect(() => multiply(100, '0.0001')).toThrow(RangeError);
  });

  it('takes a percentage in basis points', () => {
    expect(percentOf(5000, 1200)).toBe(600); // 12% commission on AED 50
    expect(percentOf(2500, 1000)).toBe(250);
    expect(percentOf(1, 5000)).toBe(1); // 0.5 rounds up
    expect(percentOf(-1, 5000)).toBe(-1); // away from zero, like Postgres round()
    expect(percentOf(3, 3333)).toBe(1);
  });

  it('does not overflow on large amounts', () => {
    expect(percentOf(900_000_000_000, 10_000)).toBe(900_000_000_000);
  });
});

describe('VAT', () => {
  it('extracts 5% VAT from inclusive prices (5/105)', () => {
    expect(vatFromInclusive(10500, 500)).toBe(500);
    expect(vatFromInclusive(2500, 500)).toBe(119); // 119.047…
    expect(vatFromInclusive(7000, 500)).toBe(333); // 333.33…
    expect(vatFromInclusive(0, 500)).toBe(0);
  });

  it('adds VAT on top of net amounts', () => {
    expect(vatOnTop(10000, 500)).toBe(500);
    expect(vatOnTop(2381, 500)).toBe(119);
  });
});

describe('allocate', () => {
  it('splits exactly, never gaining or losing a fil', () => {
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(allocate(500, [2500, 4500])).toEqual([179, 321]);
    const parts = allocate(9999, [3, 7, 11, 13]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(9999);
  });

  it('handles negative totals and zero weights', () => {
    expect(allocate(-1000, [1, 1, 1])).toEqual([-334, -333, -333]);
    expect(allocate(100, [0, 0])).toEqual([50, 50]);
    expect(allocate(100, [0, 5])).toEqual([0, 100]);
  });

  it('rejects bad input', () => {
    expect(() => allocate(100, [])).toThrow(RangeError);
    expect(() => allocate(100, [-1, 2])).toThrow(RangeError);
  });
});

describe('percentages', () => {
  it('parses percent input into basis points', () => {
    expect(parsePercent('12')).toBe(1200);
    expect(parsePercent('12.5%')).toBe(1250);
    expect(parsePercent('0.25')).toBe(25);
    expect(parsePercent('100')).toBe(10000);
    expect(parsePercent('100.01')).toBeNull();
    expect(parsePercent('12.345')).toBeNull();
    expect(parsePercent('-1')).toBeNull();
  });

  it('formats basis points', () => {
    expect(formatBps(1200)).toBe('12%');
    expect(formatBps(1250)).toBe('12.5%');
    expect(formatBps(25)).toBe('0.25%');
    expect(formatBps(0)).toBe('0%');
  });
});
