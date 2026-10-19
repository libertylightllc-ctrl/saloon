import { paperCss, paperOf, rollPage } from './receiptPaper';

describe('receipt paper', () => {
  it('is the 80 mm roll unless the branch picked another', () => {
    expect(paperOf({})).toBe('80mm');
    expect(paperOf({ receipt_paper: '58mm' })).toBe('58mm');
    expect(paperOf({ receipt_paper: 'a4' })).toBe('a4');
    expect(paperOf({ receipt_paper: 'letter' })).toBe('80mm');
  });

  it('lays a roll out at its printable width, in black, with no page margin; A4 as before', () => {
    expect(paperCss('80mm', '#000000')).toContain('width: 72mm');
    expect(paperCss('58mm', '#000000')).toContain('width: 48mm');
    expect(paperCss('80mm', '#000000')).toContain('@page { margin: 0; }');
    expect(paperCss('80mm', '#000000')).toContain('.muted { color: #000000; }');
    expect(paperCss('a4', '#000000')).toBe('');
  });

  it('makes the phone PDF as wide as the roll and as long as the receipt', () => {
    const short = rollPage('80mm', { rows: 10, logo: false, qr: false })!;
    const long = rollPage('80mm', { rows: 30, logo: true, qr: true })!;
    expect(short.width).toBe(227); // 80 mm in points
    expect(rollPage('58mm', { rows: 10, logo: false, qr: false })!.width).toBe(164);
    expect(long.height).toBeGreaterThan(short.height);
    expect(short.height).toBeLessThan(842); // shorter than an A4 page: no long blank tail
    expect(rollPage('a4', { rows: 10, logo: false, qr: false })).toBeNull();
  });
});
