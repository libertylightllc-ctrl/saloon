import { AED_DENOMINATIONS, compact, countTotal, varianceKind } from './count';

describe('drawer count', () => {
  it('adds notes and coins in fils', () => {
    // 2 × 100 + 2 × 20 + 1 × 5 + 3 × 0.25 = 245.75
    expect(countTotal({ '10000': 2, '2000': 2, '500': 1, '25': 3 })).toBe(24575);
  });

  it('ignores blanks, negatives and fractions', () => {
    expect(countTotal({ '10000': 0, '5000': -2, '1000': 1.5, '100': Number.NaN })).toBe(0);
  });

  it('keeps only what was counted', () => {
    expect(compact({ '10000': 2, '5000': 0, '25': 4 })).toEqual({ '10000': 2, '25': 4 });
  });

  it('covers every UAE note and coin from 1000 down to 25 fils', () => {
    expect(AED_DENOMINATIONS[0]).toBe(100000);
    expect(AED_DENOMINATIONS.at(-1)).toBe(25);
  });

  it('names the difference', () => {
    expect(varianceKind(25500, 26000)).toBe('short');
    expect(varianceKind(26500, 26000)).toBe('over');
    expect(varianceKind(26000, 26000)).toBe('balanced');
  });
});
