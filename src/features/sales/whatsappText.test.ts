import { waNumber } from './whatsappText';

describe('waNumber', () => {
  it('turns UAE numbers into wa.me digits with the country code', () => {
    expect(waNumber('+971 50 111 0000')).toBe('971501110000');
    expect(waNumber('050 111 0000')).toBe('971501110000');
    expect(waNumber('00971501110000')).toBe('971501110000');
  });

  it('leaves no number when there is none', () => {
    expect(waNumber(null)).toBe('');
    expect(waNumber('12')).toBe('');
  });
});
