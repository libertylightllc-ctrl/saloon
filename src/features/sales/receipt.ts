/**
 * Receipt as HTML → PDF. Phones share the PDF through the share sheet (WhatsApp, email…);
 * the web build opens the print dialog. Colours come from the theme, text from i18n.
 */
import { clockPattern } from '@/lib/clock';
import { formatAt } from '@/lib/dates';
import { escapeHtml as escape, sharePdf } from '@/lib/exportFile';
import type { CurrencyCode } from '@/lib/currencies';
import { formatMoney as formatIn } from '@/lib/money';

import type { SaleDetail } from './api';
import { staffNames } from './staff';

/** What a receipt prints of a sale (a loaded SaleDetail, or the receipt link's copy). */
export type ReceiptSale = Pick<
  SaleDetail,
  | 'number'
  | 'created_at'
  | 'customer_name'
  | 'subtotal_minor'
  | 'discount_minor'
  | 'vat_mode'
  | 'vat_minor'
  | 'tax2_minor'
  | 'tip_minor'
  | 'total_minor'
  | 'deposit_applied_minor'
  | 'refunded_minor'
> & {
  sale_lines: { qty: number | string; name_snapshot: string; unit_price_minor: number; employees: { full_name: string } | null }[];
  sale_payments: { method: string; amount_minor: number }[];
  employees: { full_name: string } | null;
};

export interface ReceiptContext {
  businessName: string;
  branchName: string;
  address: string | null;
  phone: string | null;
  trn: string | null;
  /** The registered company name and the licence / CR line (seller.ts). */
  legalName: string | null;
  licence: string | null;
  /** Saudi Arabia: ZATCA's QR code (seller.ts). */
  qr: { text: string; svg: string } | null;
  /** The salon's currency (the signed-in salon's when not given: the receipt link page gives it). */
  currency?: CurrencyCode;
  timeZone: string;
  /** App language: day and month names on the receipt. */
  language: string;
  rtl: boolean;
  ink: string;
  muted: string;
  line: string;
  labels: {
    title: string;
    sale: string;
    customer: string;
    staff: string;
    subtotal: string;
    discount: string;
    vat: string;
    /** The second tax's line (Canada's PST…), or null. */
    vat2?: string | null;
    tip: string;
    deposit: string;
    total: string;
    paid: string;
    refunded: string;
    trn: string;
    thanks: string;
    methods: Record<string, string>;
  };
}

export function receiptHtml(sale: ReceiptSale, ctx: ReceiptContext): string {
  const L = ctx.labels;
  const formatMoney = (minor: number) => (ctx.currency ? formatIn(minor, ctx.currency) : formatIn(minor));
  const row = (label: string, value: string, strong = false) =>
    `<tr${strong ? ' class="strong"' : ''}><td>${escape(label)}</td><td class="num">${escape(value)}</td></tr>`;
  const lines = sale.sale_lines
    .map((l) => row(`${Number(l.qty)} × ${l.name_snapshot}`, formatMoney(Math.round(l.unit_price_minor * Number(l.qty)))))
    .join('');
  const payments = sale.sale_payments
    .map((p) => row(`${L.paid} · ${L.methods[p.method] ?? p.method}`, formatMoney(p.amount_minor)))
    .join('');
  const refunded = sale.refunded_minor > 0 ? row(L.refunded, formatMoney(-sale.refunded_minor)) : '';
  return `<!doctype html><html dir="${ctx.rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<style>
  body { font-family: -apple-system, Roboto, "Segoe UI", sans-serif; color: ${ctx.ink}; margin: 24px; font-size: 13px; }
  h1 { font-size: 18px; margin: 0 0 4px; } .muted { color: ${ctx.muted}; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  td { padding: 4px 0; border-bottom: 1px solid ${ctx.line}; } td.num { text-align: end; direction: ltr; unicode-bidi: isolate; }
  tr.strong td { font-weight: 700; font-size: 15px; border-bottom: 0; padding-top: 8px; }
  .qr { width: 120px; margin: 16px auto 0; } .qr svg { width: 100%; height: auto; display: block; }
</style></head><body>
<h1>${escape(ctx.businessName)}</h1>
${ctx.legalName ? `<div class="muted">${escape(ctx.legalName)}</div>` : ''}
<div class="muted">${escape([ctx.branchName, ctx.address, ctx.phone].filter(Boolean).join(' · '))}</div>
${ctx.trn ? `<div class="muted">${escape(L.trn)} ${escape(ctx.trn)}</div>` : ''}
${ctx.licence ? `<div class="muted">${escape(ctx.licence)}</div>` : ''}
<p><strong>${escape(L.title)}</strong> · ${escape(L.sale)} #${sale.number}<br>
<span class="muted">${formatAt(sale.created_at, ctx.timeZone, clockPattern('dd MMM yyyy HH:mm'), ctx.language)}</span>
${sale.customer_name ? `<br>${escape(L.customer)}: ${escape(sale.customer_name)}` : ''}
${staffNames(sale) ? `<br>${escape(L.staff)}: ${escape(staffNames(sale))}` : ''}</p>
<table>${lines}
${row(L.subtotal, formatMoney(sale.subtotal_minor))}
${sale.discount_minor ? row(L.discount, formatMoney(-sale.discount_minor)) : ''}
${sale.vat_mode === 'on' ? row(L.vat, formatMoney(sale.vat_minor - sale.tax2_minor)) : ''}
${sale.vat_mode === 'on' && L.vat2 ? row(L.vat2, formatMoney(sale.tax2_minor)) : ''}
${sale.tip_minor ? row(L.tip, formatMoney(sale.tip_minor)) : ''}
${row(L.total, formatMoney(sale.total_minor), true)}
${sale.deposit_applied_minor ? row(L.deposit, formatMoney(-sale.deposit_applied_minor)) : ''}
${payments}${refunded}</table>
${ctx.qr ? `<div class="qr" data-zatca="${escape(ctx.qr.text)}">${ctx.qr.svg}</div>` : ''}
<p class="muted">${escape(L.thanks)}</p>
</body></html>`;
}

/** Share as PDF (phones) or print (web). */
export async function shareReceipt(html: string, dialogTitle: string): Promise<void> {
  await sharePdf(html, dialogTitle);
}
