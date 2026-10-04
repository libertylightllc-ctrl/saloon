/**
 * The basket and its totals. Same maths as the create_sale RPC (the branch's tax either included in the prices, 5/105
 * for 5% VAT, or added on top; discount capped at the subtotal; deposit applied up to the total), so what the screen
 * shows is what the server charges. The server stays the authority.
 */
import { multiply, subtract, sum, vatFromInclusive, vatOnTop, type Minor, type TaxRate } from '@/lib/money';

/** The tax checkout charges: a rate, included in the prices or added at the till. */
export interface TaxRule {
  rateBps: TaxRate;
  inclusive: boolean;
}

export interface BasketLine {
  key: string;
  kind: 'service' | 'retail' | 'custom';
  serviceId?: string;
  itemId?: string;
  /** Retail: the unit, so the stock line reads "Argan Hair Oil 2 pc". */
  unit?: string;
  name: string;
  unitPriceMinor: Minor;
  qty: number;
}

export interface Totals {
  subtotal: Minor;
  discount: Minor;
  /** After discount, with any tax added at the till. */
  net: Minor;
  vat: Minor;
  /** The tax was added on top of the prices (not included in them). */
  taxAdded: boolean;
  tip: Minor;
  total: Minor;
  depositApplied: Minor;
  due: Minor;
  count: number;
}

export function basketTotals(
  lines: readonly BasketLine[],
  opts: { discount?: Minor | null; tip?: Minor | null; tax: TaxRule | null; deposit?: Minor | null },
): Totals {
  const subtotal = sum(lines.map((l) => multiply(l.unitPriceMinor, l.qty)));
  const discount = Math.min(Math.max(opts.discount ?? 0, 0), subtotal);
  const afterDiscount = subtract(subtotal, discount);
  const tax = opts.tax && opts.tax.rateBps > 0 ? opts.tax : null;
  const taxAdded = tax !== null && !tax.inclusive;
  const vat = !tax ? 0 : tax.inclusive ? vatFromInclusive(afterDiscount, tax.rateBps) : vatOnTop(afterDiscount, tax.rateBps);
  const net = taxAdded ? afterDiscount + vat : afterDiscount;
  const tip = Math.max(opts.tip ?? 0, 0);
  const total = net + tip;
  const depositApplied = Math.min(Math.max(opts.deposit ?? 0, 0), total);
  return {
    subtotal,
    discount,
    net,
    vat,
    taxAdded,
    tip,
    total,
    depositApplied,
    due: total - depositApplied,
    count: lines.reduce((n, l) => n + l.qty, 0),
  };
}
