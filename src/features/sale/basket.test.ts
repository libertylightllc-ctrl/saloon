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
    const t = basketTotals([line('Haircut', 2500), line('Beard Color', 4500)], { vatOn: false });
    expect(t).toMatchObject({ subtotal: 7000, vat: 0, total: 7000, due: 7000, count: 2 });
  });

  it('matches the SQL test: 220 − 20 discount + 10 tip, VAT on', () => {
    const t = basketTotals([line('Hair Styling', 15000), line('Manicure', 7000)], {
      vatOn: true,
      discount: 2000,
      tip: 1000,
    });
    expect(t).toMatchObject({ subtotal: 22000, discount: 2000, net: 20000, vat: 952, total: 21000, due: 21000 });
  });

  it('applies a held deposit up to the total', () => {
    expect(basketTotals([line('Gel Nails', 12000)], { vatOn: false, deposit: 5000 })).toMatchObject({
      depositApplied: 5000,
      due: 7000,
    });
    expect(basketTotals([line('Threading', 2500)], { vatOn: false, deposit: 5000 })).toMatchObject({
      depositApplied: 2500,
      due: 0,
    });
  });

  it('never discounts below zero', () => {
    expect(basketTotals([line('Shave', 1500)], { vatOn: false, discount: 9999 }).net).toBe(0);
  });
});
