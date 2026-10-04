import { compact, countTotal, denominationsFor, varianceKind } from './count';

describe('drawer count', () => {
  it('adds notes and coins in fils', () => {
    // 2 × 100 + 2 × 20 + 1 × 5 + 3 × 0.25 = 245.75
    expect(countTotal({ '10000': 2, '2000': 2, '500': 1, '25': 3 }, denominationsFor('AED'))).toBe(24575);
  });

  it('ignores blanks, negatives and fractions', () => {
    expect(countTotal({ '10000': 0, '5000': -2, '1000': 1.5, '100': Number.NaN }, denominationsFor('AED'))).toBe(0);
  });

  it('keeps only what was counted', () => {
    expect(compact({ '10000': 2, '5000': 0, '25': 4 })).toEqual({ '10000': 2, '25': 4 });
  });

  it('covers every UAE note and coin from 1000 down to 25 fils', () => {
    const aed = denominationsFor('AED');
    expect(aed.map((d) => d.key)).toEqual(['100000', '50000', '20000', '10000', '5000', '2000', '1000', '500', '100', '50', '25']);
    expect(aed.find((d) => d.minor === 25)).toMatchObject({ coin: true, label: '0.25' });
    expect(aed[0]).toMatchObject({ coin: false, label: '1,000' });
  });

  it('counts other currencies in their own notes and coins', () => {
    // Kuwait: 3 decimals. 1 × KWD 20 + 2 × KWD 0.250 = 20.500
    const kwd = denominationsFor('KWD');
    expect(countTotal({ '20000': 1, '250': 2 }, kwd)).toBe(20500);
    expect(kwd.find((d) => d.minor === 250)?.label).toBe('0.25');
    // India: a 20 note and a 20 coin are counted apart.
    const inr = denominationsFor('INR');
    expect(countTotal({ '2000': 1, c2000: 3 }, inr)).toBe(8000);
    // Japan: no decimals.
    expect(denominationsFor('JPY')[0]).toMatchObject({ minor: 10000, label: '10,000' });
  });

  it('names the difference', () => {
    expect(varianceKind(25500, 26000)).toBe('short');
    expect(varianceKind(26500, 26000)).toBe('over');
    expect(varianceKind(26000, 26000)).toBe('balanced');
  });
});
