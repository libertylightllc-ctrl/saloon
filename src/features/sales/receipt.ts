/**
 * Receipt as HTML → PDF. Phones share the PDF through the share sheet (WhatsApp, email…);
 * the web build opens the print dialog. Colours come from the theme, text from i18n.
 */
import { formatInTimeZone } from 'date-fns-tz';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { formatMoney } from '@/lib/money';

import type { SaleDetail } from './api';

export interface ReceiptContext {
  businessName: string;
  branchName: string;
  address: string | null;
  phone: string | null;
  trn: string | null;
  timeZone: string;
  rtl: boolean;
  ink: string;
  muted: string;
  line: string;
  labels: {
    title: string;
    sale: string;
    customer: string;
    subtotal: string;
    discount: string;
    vat: string;
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

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function receiptHtml(sale: SaleDetail, ctx: ReceiptContext): string {
  const L = ctx.labels;
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
</style></head><body>
<h1>${escape(ctx.businessName)}</h1>
<div class="muted">${escape([ctx.branchName, ctx.address, ctx.phone].filter(Boolean).join(' · '))}</div>
${ctx.trn ? `<div class="muted">${escape(L.trn)} ${escape(ctx.trn)}</div>` : ''}
<p><strong>${escape(L.title)}</strong> · ${escape(L.sale)} #${sale.number}<br>
<span class="muted">${formatInTimeZone(new Date(sale.created_at), ctx.timeZone, 'dd MMM yyyy HH:mm')}</span>
${sale.customer_name ? `<br>${escape(L.customer)}: ${escape(sale.customer_name)}` : ''}</p>
<table>${lines}
${row(L.subtotal, formatMoney(sale.subtotal_minor))}
${sale.discount_minor ? row(L.discount, formatMoney(-sale.discount_minor)) : ''}
${sale.vat_mode === 'on' ? row(L.vat, formatMoney(sale.vat_minor)) : ''}
${sale.tip_minor ? row(L.tip, formatMoney(sale.tip_minor)) : ''}
${row(L.total, formatMoney(sale.total_minor), true)}
${sale.deposit_applied_minor ? row(L.deposit, formatMoney(-sale.deposit_applied_minor)) : ''}
${payments}${refunded}</table>
<p class="muted">${escape(L.thanks)}</p>
</body></html>`;
}

/** Share as PDF (phones) or print (web). */
export async function shareReceipt(html: string, dialogTitle: string): Promise<void> {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
  } else {
    await Print.printAsync({ uri });
  }
}
