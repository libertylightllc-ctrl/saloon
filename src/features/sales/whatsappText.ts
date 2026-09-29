/** The receipt as WhatsApp text, and phone numbers the way wa.me wants them (pure; tested). */
import { formatAt } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

import type { SaleDetail } from './api';

/** "+971 50 111 0000" / "050 111 0000" / "00971…" → "971501110000" (wa.me wants the country code, digits only). */
export function waNumber(phone: string | null | undefined, countryCode = '971'): string {
  let d = (phone ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = countryCode + d.slice(1);
  return d.length >= 8 ? d : '';
}

export function receiptText(
  sale: SaleDetail,
  ctx: { businessName: string; branchName: string; timeZone: string; language: string; trn: string | null },
  L: { title: string; sale: string; vat: string; tip: string; total: string; paid: string; refunded: string; trn: string; thanks: string; methods: Record<string, string> },
): string {
  const lines = [
    `*${ctx.businessName}* · ${ctx.branchName}`,
    ...(ctx.trn ? [`${L.trn} ${ctx.trn}`] : []),
    `${L.title} · ${L.sale} #${sale.number} · ${formatAt(sale.created_at, ctx.timeZone, 'd MMM yyyy HH:mm', ctx.language)}`,
    '',
    ...sale.sale_lines.map((l) => `${Number(l.qty)} × ${l.name_snapshot} — ${formatMoney(Math.round(l.unit_price_minor * Number(l.qty)))}`),
    ...(sale.vat_mode === 'on' ? [`${L.vat}: ${formatMoney(sale.vat_minor)}`] : []),
    ...(sale.tip_minor ? [`${L.tip}: ${formatMoney(sale.tip_minor)}`] : []),
    `*${L.total}: ${formatMoney(sale.total_minor)}*`,
    ...sale.sale_payments.map((p) => `${L.paid} · ${L.methods[p.method] ?? p.method}: ${formatMoney(p.amount_minor)}`),
    ...(sale.refunded_minor > 0 ? [`${L.refunded}: ${formatMoney(-sale.refunded_minor)}`] : []),
    '',
    L.thanks,
  ];
  return lines.join('\n');
}
