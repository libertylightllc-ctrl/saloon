import { layoutFor } from './layoutSize';

describe('layoutFor', () => {
  it('keeps phones on the phone layout, tablets on the rail, computers on the sidebar', () => {
    expect(layoutFor(390)).toBe('phone');
    expect(layoutFor(767)).toBe('phone');
    expect(layoutFor(768)).toBe('tablet');
    expect(layoutFor(1180)).toBe('tablet');
    expect(layoutFor(1200)).toBe('desktop');
    expect(layoutFor(1440)).toBe('desktop');
  });
});
