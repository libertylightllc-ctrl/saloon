import { basketTotals, discountBps, overDiscountLimit, priceChange, type BasketLine } from './basket';

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

describe('limits that need a reason or a PIN (brief B2, B3)', () => {
  it('counts a discount against the limit as the server does', () => {
    expect(discountBps(2500, 10000)).toBe(2500);
    expect(discountBps(1, 3000)).toBe(4); // 3.33 bps, rounded up
    expect(overDiscountLimit(1000, 10000, 1000)).toBe(false); // exactly 10% is allowed
    expect(overDiscountLimit(1001, 10000, 1000)).toBe(true);
    expect(overDiscountLimit(0, 0, 1000)).toBe(false);
  });

  it('adds up how far changed service prices moved from the price list', () => {
    const lines: BasketLine[] = [
      { key: 'a', kind: 'service', serviceId: 'cut', name: 'Cut', unitPriceMinor: 7500, qty: 1, priceChanged: true },
      { key: 'b', kind: 'service', serviceId: 'beard', name: 'Beard', unitPriceMinor: 4000, qty: 2, priceChanged: true },
      { key: 'c', kind: 'service', serviceId: 'wash', name: 'Wash', unitPriceMinor: 2000, qty: 1 },
      { key: 'd', kind: 'custom', name: 'Extra', unitPriceMinor: 900, qty: 1 },
    ];
    const list: Record<string, number> = { cut: 8000, beard: 3500, wash: 1000 };
    // Cut 5.00 down, beard 5.00 up twice; the unchanged wash and the custom line do not count.
    expect(priceChange(lines, (id) => list[id])).toBe(1500);
  });
});
