/** A report as a printable page (PDF) and as CSV rows — from the same ReportView the screen draws. */
import { escapeHtml, type CsvCell } from '@/lib/exportFile';

import type { ReportView } from './definitions';

export interface ReportDocContext {
  businessName: string;
  branchName: string;
  title: string;
  period: string;
  control: string[];
  generated: string;
  rtl: boolean;
  ink: string;
  muted: string;
  line: string;
  error: string;
  warning: string;
}

export function reportHtml(view: ReportView, ctx: ReportDocContext): string {
  const e = escapeHtml;
  const kpis = view.kpis
    .map((k) => `<div class="kpi"><div class="muted">${e(k.label)}</div><div class="big">${e(k.value)}</div>${k.delta ? `<div class="muted">${k.delta.trend === 'up' ? '▲' : '▼'} ${e(k.delta.label)}</div>` : ''}</div>`)
    .join('');
  const head = view.columns.map((c) => `<th class="${c.numeric ? 'num' : ''}">${e(c.label)}</th>`).join('');
  const body = view.rows
    .map(
      (r) =>
        `<tr${r.tone ? ` class="${r.tone}"` : ''}>${r.cells.map((cell, i) => `<td class="${view.columns[i]?.numeric ? 'num' : ''}">${e(cell)}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<!doctype html><html dir="${ctx.rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<style>
  body { font-family: -apple-system, Roboto, "Segoe UI", sans-serif; color: ${ctx.ink}; margin: 24px; font-size: 12px; }
  h1 { font-size: 18px; margin: 0 0 2px; } h2 { font-size: 14px; margin: 16px 0 6px; } .muted { color: ${ctx.muted}; }
  .kpis { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
  .kpi { border: 1px solid ${ctx.line}; border-radius: 8px; padding: 8px 12px; min-width: 120px; }
  .big { font-size: 16px; font-weight: 700; direction: ltr; unicode-bidi: isolate; }
  .control { margin-top: 12px; padding: 8px 12px; border: 1px solid ${ctx.line}; border-radius: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: start; font-weight: 600; color: ${ctx.muted}; border-bottom: 1px solid ${ctx.line}; padding: 4px; }
  td { padding: 4px; border-bottom: 1px solid ${ctx.line}; } .num { text-align: end; direction: ltr; unicode-bidi: isolate; }
  tr.error td.num { color: ${ctx.error}; } tr.warning td.num { color: ${ctx.warning}; }
</style></head><body>
<h1>${e(ctx.title)}</h1>
<div class="muted">${e(`${ctx.businessName} · ${ctx.branchName} · ${ctx.period}`)}</div>
<div class="kpis">${kpis}</div>
<div class="control">${ctx.control.map(e).join(' · ')}</div>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
${view.rows.length === 0 ? `<p class="muted">${e(view.empty)}</p>` : ''}
<p class="muted">${e(ctx.generated)}</p>
</body></html>`;
}

export function reportCsv(view: ReportView, header: string[]): CsvCell[][] {
  return [header, ...view.rows.map((r) => r.csv)];
}
