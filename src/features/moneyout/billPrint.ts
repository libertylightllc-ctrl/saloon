import { escapeHtml as escape } from '@/lib/exportFile';
import { formatMoney } from '@/lib/money';

import type { BillDetail } from './api';
import { purchaseNo } from './labels';

export interface BillPrintContext {
  businessName: string;
  branchName: string;
  trn: string | null;
  rtl: boolean;
  ink: string;
  muted: string;
  line: string;
  date: string;
  labels: {
    title: string;
    number: string;
    supplier: string;
    invoice: string;
    date: string;
    payment: string;
    paymentValue: string;
    product: string;
    qty: string;
    unitPrice: string;
    vat: string;
    total: string;
    subtotal: string;
    vatTotal: string;
    grandTotal: string;
    paid: string;
    balance: string;
    trn: string;
  };
  /** "10 packs", "100 ml" — the quantity as on the invoice. */
  qtyText: (l: BillDetail['purchase_bill_lines'][number]) => string;
}

/** Packs and price per pack for any bill line; older bills only have a quantity and a line total. */
export function lineParts(l: BillDetail['purchase_bill_lines'][number]) {
  const packs = Number(l.packs ?? l.qty);
  const price =
    l.unit_price_minor ?? (packs > 0 ? Math.round(l.total_minor / packs) : l.total_minor);
  return { packs, price, vat: l.vat_minor ?? 0, gross: l.total_minor + (l.vat_minor ?? 0) };
}

/** The purchase entry as a printable page (PDF on phones, the print dialog on the web). */
export function billHtml(b: BillDetail, ctx: BillPrintContext): string {
  const L = ctx.labels;
  const head = (label: string, value: string) =>
    `<tr><th>${escape(label)}</th><td>${escape(value)}</td></tr>`;
  const rows = b.purchase_bill_lines
    .map((l) => {
      const p = lineParts(l);
      return `<tr><td>${escape(l.description)}</td><td class="num">${escape(ctx.qtyText(l))}</td><td class="num">${formatMoney(p.price)}</td><td class="num">${formatMoney(p.vat)}</td><td class="num">${formatMoney(p.gross)}</td></tr>`;
    })
    .join('');
  const sum = (label: string, value: number, strong = false) =>
    `<tr${strong ? ' class="strong"' : ''}><td>${escape(label)}</td><td class="num">${formatMoney(value)}</td></tr>`;
  return `<!doctype html><html dir="${ctx.rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<style>
  body { font-family: -apple-system, Roboto, "Segoe UI", sans-serif; color: ${ctx.ink}; margin: 24px; font-size: 13px; }
  h1 { font-size: 18px; margin: 0 0 4px; } h2 { font-size: 15px; margin: 16px 0 8px; } .muted { color: ${ctx.muted}; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 4px; border-bottom: 1px solid ${ctx.line}; text-align: start; vertical-align: top; }
  table.head th { width: 35%; color: ${ctx.muted}; font-weight: 400; }
  table.lines { margin-top: 16px; }
  table.lines th { font-size: 12px; color: ${ctx.muted}; font-weight: 600; }
  .num { text-align: end; direction: ltr; unicode-bidi: isolate; white-space: nowrap; }
  table.sum { width: 60%; margin-inline-start: auto; margin-top: 12px; }
  tr.strong td { font-weight: 700; font-size: 15px; }
</style></head><body>
<h1>${escape(ctx.businessName)}</h1>
<div class="muted">${escape(ctx.branchName)}${ctx.trn ? ` · ${escape(L.trn)} ${escape(ctx.trn)}` : ''}</div>
<h2>${escape(L.title)}</h2>
<table class="head">
${head(L.number, purchaseNo(b.number))}
${head(L.supplier, b.suppliers?.name ?? '')}
${b.invoice_ref ? head(L.invoice, b.invoice_ref) : ''}
${head(L.date, ctx.date)}
${head(L.payment, L.paymentValue)}
</table>
<table class="lines"><tr><th>${escape(L.product)}</th><th class="num">${escape(L.qty)}</th><th class="num">${escape(L.unitPrice)}</th><th class="num">${escape(L.vat)}</th><th class="num">${escape(L.total)}</th></tr>
${rows}</table>
<table class="sum">
${sum(L.subtotal, b.total_minor - b.vat_minor)}
${sum(L.vatTotal, b.vat_minor)}
${sum(L.grandTotal, b.total_minor, true)}
${sum(L.paid, b.paid_minor)}
${sum(L.balance, b.status === 'reversed' ? 0 : b.total_minor - b.paid_minor, true)}
</table>
</body></html>`;
}
