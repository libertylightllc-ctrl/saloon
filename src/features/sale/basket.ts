/**
 * The basket and its totals. Same maths as the create_sale RPC (VAT inclusive 5/105, discount
 * capped at the subtotal, deposit applied up to the total), so what the screen shows is what the
 * server charges. The server stays the authority.
 */
import { multiply, subtract, sum, vatFromInclusive, type Minor } from '@/lib/money';

export const VAT_BPS = 500;

export interface BasketLine {
  key: string;
  kind: 'service' | 'custom';
  serviceId?: string;
  name: string;
  unitPriceMinor: Minor;
  qty: number;
}

export interface Totals {
  subtotal: Minor;
  discount: Minor;
  net: Minor;
  vat: Minor;
  tip: Minor;
  total: Minor;
  depositApplied: Minor;
  due: Minor;
  count: number;
}

export function basketTotals(
  lines: readonly BasketLine[],
  opts: { discount?: Minor | null; tip?: Minor | null; vatOn: boolean; deposit?: Minor | null },
): Totals {
  const subtotal = sum(lines.map((l) => multiply(l.unitPriceMinor, l.qty)));
  const discount = Math.min(Math.max(opts.discount ?? 0, 0), subtotal);
  const net = subtract(subtotal, discount);
  const vat = opts.vatOn ? vatFromInclusive(net, VAT_BPS) : 0;
  const tip = Math.max(opts.tip ?? 0, 0);
  const total = net + tip;
  const depositApplied = Math.min(Math.max(opts.deposit ?? 0, 0), total);
  return {
    subtotal,
    discount,
    net,
    vat,
    tip,
    total,
    depositApplied,
    due: total - depositApplied,
    count: lines.reduce((n, l) => n + l.qty, 0),
  };
}
