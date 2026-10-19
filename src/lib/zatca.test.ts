import { zatcaQrText } from './zatca';

describe('the ZATCA receipt QR code', () => {
  it('encodes ZATCA’s own example the same way', () => {
    // The sample from ZATCA's e-invoicing guidelines (phase 1).
    expect(
      zatcaQrText({ sellerName: 'Bobs Records', vatNumber: '310122393500003', at: new Date('2022-04-25T15:30:00Z'), total: '1000.00', vat: '150.00' }),
    ).toBe('AQxCb2JzIFJlY29yZHMCDzMxMDEyMjM5MzUwMDAwMwMUMjAyMi0wNC0yNVQxNTozMDowMFoEBzEwMDAuMDAFBjE1MC4wMA==');
  });

  it('counts an Arabic seller name in UTF-8 bytes, not letters', () => {
    const text = zatcaQrText({ sellerName: 'صالون', vatNumber: '300000000000003', at: new Date('2026-10-19T09:00:00.123Z'), total: '115.00', vat: '15.00' });
    const bytes = Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0));
    expect([bytes[0], bytes[1]]).toEqual([1, 10]);
    expect(new TextDecoder().decode(bytes.slice(2, 12))).toBe('صالون');
    expect(new TextDecoder().decode(bytes)).toContain('2026-10-19T09:00:00Z');
  });
});
