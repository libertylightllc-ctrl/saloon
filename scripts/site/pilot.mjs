/**
 * The pilot on the home page (full update brief, Phases 3 and 6): for UAE visitors only (`.uae`), with the numbers from
 * the settings and the places from the real count of pilot salons (`c.pilot`, read at build time; client.js refreshes
 * the places). A bar above the header, a line under the plans and a section with the application form; when the pilot
 * is full, "Pilot full · Try it free" instead. Nothing while the pilot is not set up (`c.pilot` null).
 */
import { esc, LANGUAGES } from './text.mjs';

const EMIRATES = ['abu_dhabi', 'dubai', 'sharjah', 'ajman', 'umm_al_quwain', 'ras_al_khaimah', 'fujairah'];
const TYPES = ['barber', 'ladies', 'unisex', 'spa', 'beauty'];

/** Shows one of two parts by whether places are left (client.js flips them when the count changes). */
const state = (open) => (open ? 'data-pilot-open' : 'data-pilot-full');
const hidden = (c, open) => (open === c.pilot.placesLeft > 0 ? '' : ' hidden');

export function pilotBar(c) {
  if (!c.pilot) return '';
  const t = c.t;
  const p = c.pilot;
  return `<div class="pilot-bar uae">
<a href="#pilot" ${state(true)}${hidden(c, true)}><span>${esc(t('auth.landing.pilot.bar', { max: p.max, months: p.months }))}</span> <span class="places" data-pilot-places>${esc(t('auth.landing.pilot.places', { count: p.placesLeft }))}</span> <strong>${esc(t('auth.landing.pilot.apply'))}</strong></a>
<a href="#types" data-start="pilot-bar" ${state(false)}${hidden(c, false)}>${esc(t('auth.landing.pilot.full'))}</a>
</div>`;
}

export function pilotUnderPlans(c) {
  if (!c.pilot) return '';
  return `<p class="center teal-soft uae pilot-note" ${state(true)}${hidden(c, true)}>${esc(c.t('auth.landing.pilot.underPlans', { months: c.pilot.months }))}</p>`;
}

const field = (label, control) => `<label class="pilot-field"><span>${esc(label)}</span>${control}</label>`;
const select = (name, options, selected = '') =>
  `<select name="${name}" required>${options.map(([v, l]) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;

export function pilotSection(c) {
  if (!c.pilot) return '';
  const t = c.t;
  const p = c.pilot;
  const points = [
    t('auth.landing.pilot.points.free', { months: p.months }),
    ...(c.whatsapp ? [t('auth.landing.pilot.points.whatsapp')] : []),
    t('auth.landing.pilot.points.data'),
  ];
  const tick = `<span class="tick" style="--s:24px">${c.icon('check', { size: 14, stroke: 2.6 })}</span>`;
  const form = `<form class="pilot-form" data-pilot-form novalidate ${state(true)}${hidden(c, true)}>
${field(t('auth.landing.pilot.form.name'), '<input name="name" autocomplete="name" required minlength="2" maxlength="80">')}
${field(t('auth.landing.pilot.form.salon'), '<input name="salon_name" autocomplete="organization" required minlength="2" maxlength="80">')}
<div class="pilot-pair">
${field(t('auth.landing.pilot.form.emirate'), select('emirate', EMIRATES.map((e) => [e, t(`console.pilot.emirates.${e}`)]), 'dubai'))}
${field(t('auth.landing.pilot.form.area'), '<input name="area" maxlength="80">')}
</div>
<div class="pilot-pair">
${field(t('auth.landing.pilot.form.type'), select('salon_type', TYPES.map((k) => [k, t(`console.pilot.types.${k}`)])))}
${field(t('auth.landing.pilot.form.staff'), '<input name="staff_count" type="number" inputmode="numeric" min="1" max="500" required>')}
</div>
${field(t('auth.landing.pilot.form.whatsapp'), '<input name="whatsapp" type="tel" inputmode="tel" autocomplete="tel" placeholder="+971 50 123 4567" required>')}
${field(t('auth.landing.pilot.form.language'), select('language', LANGUAGES.map((l) => [l.code, l.name]), c.lang))}
<label class="pilot-check"><input type="checkbox" name="whatsapp_ok"><span>${esc(t('auth.landing.pilot.form.ok'))}</span></label>
<input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
<button class="btn btn-teal" type="submit">${esc(t('auth.landing.pilot.form.submit'))}</button>
<p class="pilot-out" role="status" aria-live="polite" data-pilot-out></p>
</form>`;
  const full = `<div class="pilot-full" ${state(false)}${hidden(c, false)}><p>${esc(t('auth.landing.pilot.form.full'))}</p><a class="btn btn-teal" href="#types" data-start="pilot">${esc(c.startLabel)}</a></div>`;
  return `<section class="band card pilot uae" id="pilot" aria-labelledby="pilot-title"><div class="inner pilot-row">
<div class="pilot-copy"><h2 class="t-section" id="pilot-title">${esc(t('auth.landing.pilot.title'))}</h2>
<p class="t-lead muted">${esc(t('auth.landing.pilot.lead', { max: p.max, months: p.months }))}</p>
<ul class="ticks">${points.map((x) => `<li>${tick}<span>${esc(x)}</span></li>`).join('')}</ul></div>
${form}${full}
</div></section>`;
}
