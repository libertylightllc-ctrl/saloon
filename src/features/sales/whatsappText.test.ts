import type { SaleDetail } from './api';
import { receiptText, waNumber } from './whatsappText';

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

describe('receiptText', () => {
  const sale = {
    number: 12,
    created_at: '2026-10-19T16:00:00Z',
    employees: null,
    sale_lines: [{ qty: 1, name_snapshot: 'Haircut', unit_price_minor: 10_000, employees: null }],
    sale_payments: [{ method: 'card', amount_minor: 11_200 }],
    vat_mode: 'on',
    vat_minor: 1_200,
    tax2_minor: 700,
    tip_minor: 0,
    total_minor: 11_200,
    refunded_minor: 0,
  } as unknown as SaleDetail;
  const ctx = { businessName: 'Vancouver Cuts', branchName: 'Main', timeZone: 'America/Vancouver', language: 'en', trn: null };
  const L = {
    title: 'Tax invoice',
    sale: 'Sale',
    staff: 'Staff',
    vat: 'GST (5%)',
    vat2: 'PST (7%)',
    tip: 'Tip',
    total: 'Total',
    paid: 'Paid',
    refunded: 'Refunded',
    trn: 'GST number',
    thanks: 'Thank you',
    methods: { card: 'Card' },
  };

  it('British Columbia: GST and PST each on their own line, adding up to the tax charged', () => {
    const text = receiptText(sale, ctx, L).replace(/ /g, ' ');
    expect(text).toContain('GST (5%): AED 5.00');
    expect(text).toContain('PST (7%): AED 7.00');
    expect(text).toContain('*Total: AED 112.00*');
  });

  it('one tax: one line with all of it', () => {
    const text = receiptText({ ...sale, tax2_minor: 0 }, ctx, { ...L, vat: 'HST (13%)', vat2: null }).replace(/ /g, ' ');
    expect(text).toContain('HST (13%): AED 12.00');
    expect(text).not.toContain('PST');
  });
});
