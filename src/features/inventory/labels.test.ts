import type { TFunction } from 'i18next';

import { qtyText } from './labels';

const t = ((key: string) => ({ 'units.pcs': 'pc', 'units.ml': 'ml' })[key] ?? key) as unknown as TFunction;

describe('qtyText', () => {
  it('shows whole and part quantities without trailing zeros', () => {
    expect(qtyText(8, 'pcs', t)).toBe('8 pc');
    expect(qtyText(12.5, 'ml', t)).toBe('12.5 ml');
    expect(qtyText(0.1 + 0.2, 'ml', t)).toBe('0.3 ml');
  });

  it('keeps the sign for movements', () => {
    expect(qtyText(-2, 'pcs', t)).toBe('-2 pc');
  });
});
