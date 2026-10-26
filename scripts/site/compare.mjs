/**
 * "Why salons choose Saloqo" (full update brief, pricing; owner's fix list #1, 26 Oct 2026): Saloqo next to "many salon
 * apps", the brief's seven soft rows, no app named. UAE visitors only (`.uae`): the rows about other apps describe the
 * UAE market ("usually English and Arabic") and the branch row is the AED price.
 */
import { esc } from './text.mjs';

const ROWS = ['locked', 'branch', 'commission', 'languages', 'closing', 'reminders', 'contract'];

export function compare(c) {
  if (!c.prices) return '';
  const t = c.t;
  const k = (key) => `auth.landing.compare.${key}`;
  const us = (row) =>
    row === 'branch' ? t(k('rows.branch.us'), { price: c.prices.uae.price, people: c.prices.people }) : t(k(`rows.${row}.us`));
  const tick = c.icon('check', { size: 16, stroke: 2.6 });
  const rows = ROWS.map(
    (row) => `<tr><th scope="row">${esc(t(k(`rows.${row}.label`)))}</th>
<td class="us"><span class="mark">${tick}</span><span>${esc(us(row))}</span></td>
<td class="them">${esc(t(k(`rows.${row}.them`)))}</td></tr>`,
  ).join('\n');
  return `<section class="band card compare uae" aria-labelledby="compare-title"><div class="inner stack">
<h2 class="t-section center" id="compare-title">${esc(t(k('title')))}</h2>
<div class="compare-scroll"><table class="compare-table">
<thead><tr><td></td><th scope="col" class="us">${esc(c.brand.appName)}</th><th scope="col" class="them">${esc(t(k('them')))}</th></tr></thead>
<tbody>
${rows}
</tbody></table></div>
</div></section>`;
}
