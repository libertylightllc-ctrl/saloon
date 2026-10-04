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

  it('a 0% rate charges no tax', () => {
    expect(basketTotals([line('Fade', 10000)], { tax: { rateBps: 0, inclusive: false } })).toMatchObject({ vat: 0, total: 10000, taxAdded: false });
  });

  it('never discounts below zero', () => {
    expect(basketTotals([line('Shave', 1500)], { tax: null, discount: 9999 }).net).toBe(0);
  });
});
