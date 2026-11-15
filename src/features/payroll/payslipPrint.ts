import { escapeHtml as escape } from '@/lib/exportFile';
import { formatMoney } from '@/lib/money';

import type { Payslip, PayslipDetails } from './api';

export interface PayslipPrintContext {
  rtl: boolean;
  ink: string;
  muted: string;
  line: string;
  title: string;
  /** Name, staff ID, job, month, days, attendance, status: label and value, already in the app's language. */
  facts: [string, string][];
  /** Base, commission, bonus, deductions, advances and net: labels in the app's language. */
  labels: { base: string; commission: string; bonus: string; deductions: string; advances: string; net: string };
  tips: string;
  tipsNote: string;
}

/** A payslip as a printable page (PDF on phones, the print dialog on the web). */
export function payslipHtml(slip: Payslip, d: PayslipDetails, ctx: PayslipPrintContext): string {
  const L = ctx.labels;
  const fact = ([label, value]: [string, string]) => `<tr><th>${escape(label)}</th><td>${escape(value)}</td></tr>`;
  const row = (label: string, value: number, strong = false) =>
    `<tr${strong ? ' class="strong"' : ''}><td>${escape(label)}</td><td class="num">${formatMoney(value)}</td></tr>`;
  return `<!doctype html><html dir="${ctx.rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<style>
  body { font-family: -apple-system, Roboto, "Segoe UI", sans-serif; color: ${ctx.ink}; margin: 24px; font-size: 13px; }
  h1 { font-size: 18px; margin: 0 0 4px; } h2 { font-size: 15px; margin: 16px 0 8px; } .muted { color: ${ctx.muted}; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 4px; border-bottom: 1px solid ${ctx.line}; text-align: start; vertical-align: top; }
  table.head th { width: 35%; color: ${ctx.muted}; font-weight: 400; }
  table.pay { margin-top: 16px; }
  .num { text-align: end; direction: ltr; unicode-bidi: isolate; white-space: nowrap; }
  tr.strong td { font-weight: 700; font-size: 15px; }
  p.note { margin-top: 16px; }
</style></head><body>
<h1>${escape(d.business_name)}</h1>
<div class="muted">${escape(d.branch_name)}</div>
<h2>${escape(ctx.title)}</h2>
<table class="head">${ctx.facts.map(fact).join('')}</table>
<table class="pay">
${row(L.base, slip.base_minor)}
${row(L.commission, slip.commission_minor)}
${row(L.bonus, slip.bonus_minor)}
${row(L.deductions, -slip.deductions_minor)}
${row(L.advances, -slip.advances_minor)}
${row(L.net, slip.net_minor, true)}
</table>
<p class="note">${escape(ctx.tips)}: <span class="num">${formatMoney(d.tips_minor)}</span><br><span class="muted">${escape(ctx.tipsNote)}</span></p>
</body></html>`;
}
