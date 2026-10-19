import { basketTotals, type BasketLine } from './basket';

const line = (name: string, price: number, qty = 1): BasketLine => ({
  key: name,
  kind: 'service',
  name,
  unitPriceMinor: price,
  qty,
});

describe('basketTotals', () => {
  it('Haircut + Beard Color, VAT off = AED 70.00', () => {
    const t = basketTotals([line('Haircut', 2500), line('Beard Color', 4500)], { tax: null });
    expect(t).toMatchObject({ subtotal: 7000, vat: 0, total: 7000, due: 7000, count: 2 });
  });

  it('matches the SQL test: 220 − 20 discount + 10 tip, VAT on', () => {
    const t = basketTotals([line('Hair Styling', 15000), line('Manicure', 7000)], {
      tax: { rateBps: 500, inclusive: true },
      discount: 2000,
      tip: 1000,
    });
    expect(t).toMatchObject({ subtotal: 22000, discount: 2000, net: 20000, vat: 952, total: 21000, due: 21000 });
  });

  it('applies a held deposit up to the total', () => {
    expect(basketTotals([line('Gel Nails', 12000)], { tax: null, deposit: 5000 })).toMatchObject({
      depositApplied: 5000,
      due: 7000,
    });
    expect(basketTotals([line('Threading', 2500)], { tax: null, deposit: 5000 })).toMatchObject({
      depositApplied: 2500,
      due: 0,
    });
  });

  it('matches the SQL test: sales tax 8.875% added at the till', () => {
    const t = basketTotals([line('Fade', 10000)], { tax: { rateBps: 887.5, inclusive: false }, tip: 500 });
    expect(t).toMatchObject({ subtotal: 10000, net: 10888, vat: 888, taxAdded: true, total: 11388, due: 11388 });
  });

  it('matches the SQL test: GST 5% + PST 7% added at the till, the PST kept apart', () => {
    const t = basketTotals([line('Haircut', 10000)], { tax: { rateBps: 500, inclusive: false, rate2Bps: 700 } });
    expect(t).toMatchObject({ vat: 1200, tax2: 700, total: 11200 });
  });

  it('Quebec: GST 5% + QST 9.975% on 35.00 is 5.24 of tax, 3.49 of it QST', () => {
    const t = basketTotals([line('Coupe', 3500)], { tax: { rateBps: 500, inclusive: false, rate2Bps: 997.5 } });
    expect(t).toMatchObject({ vat: 524, tax2: 349, total: 4024 });
  });

  it('a 0% rate charges no tax', () => {
    expect(basketTotals([line('Fade', 10000)], { tax: { rateBps: 0, inclusive: false } })).toMatchObject({ vat: 0, total: 10000, taxAdded: false });
  });

  it('never discounts below zero', () => {
    expect(basketTotals([line('Shave', 1500)], { tax: null, discount: 9999 }).net).toBe(0);
  });
});
