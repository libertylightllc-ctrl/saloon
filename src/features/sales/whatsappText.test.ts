import { waNumber } from './whatsappText';

describe('waNumber', () => {
  it('turns UAE numbers into wa.me digits with the country code', () => {
    expect(waNumber('+971 50 111 0000')).toBe('971501110000');
    expect(waNumber('050 111 0000')).toBe('971501110000');
    expect(waNumber('00971501110000')).toBe('971501110000');
  });

  it('uses the salon\'s country code elsewhere', () => {
    expect(waNumber('(212) 555-1234', '1')).toBe('12125551234');
    expect(waNumber('1 212 555 1234', '1')).toBe('12125551234');
    expect(waNumber('9123456789', '91')).toBe('919123456789');
    expect(waNumber('+91 91234 56789', '91')).toBe('919123456789');
    expect(waNumber('5123 4567', '965')).toBe('96551234567');
    expect(waNumber('501110000')).toBe('971501110000');
    expect(waNumber('050 111 0000', '')).toBe('');
    expect(waNumber('+44 7700 900123', '')).toBe('447700900123');
  });

  it('leaves no number when there is none', () => {
    expect(waNumber(null)).toBe('');
    expect(waNumber('12')).toBe('');
  });
});
