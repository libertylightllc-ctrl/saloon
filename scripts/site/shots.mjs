/**
 * The app pictures and the "See how it works" tour (full update, Phase 4). One set of pictures per language and
 * currency (assets/site/shots/<lang>/<aed|usd>/, captured by scripts/landing-shots/site.shot.ts); a visitor only
 * downloads their own. Below the first screen both sets are on the page, lazy, and the hidden one never loads
 * (site.css .uae / .intl). The hero's pictures load at once, so they take their address from a small script once the
 * currency is known (`HERO_SCRIPT`), and again from client.js if the visitor switches currency.
 */
import { esc } from './text.mjs';

const SETS = { uae: 'aed', intl: 'usd' };

/** A screen's files: 360 and 600 wide; the queue card is one 640-wide crop. */
function files(lang, cur, name) {
  const base = `/site/img/shots/${lang}/${cur}/${name}`;
  return { src: `${base}.webp`, srcset: name === 'queue-card' ? '' : `${base}-360.webp 360w, ${base}.webp 600w` };
}

/** "gents-queue" → the words describing that screen. */
const alt = (c, name) => esc(c.t(`auth.landing.alt.${name.replace(/-(\w)/g, (_, x) => x.toUpperCase())}`));

/**
 * A screen's picture. `load`: true = lazy (below the first screen), false = at once, 'first' = at once and before
 * the rest (the largest picture on the first screen).
 */
export function shot(c, name, { load = true, sizes = '', w = 600, h = 1298, cls = '' } = {}) {
  const size = `width="${w}" height="${h}" alt="${alt(c, name)}"`;
  if (load === true) {
    return Object.entries(SETS)
      .map(([region, cur]) => {
        const f = files(c.lang, cur, name);
        return `<img class="${[region, cls].filter(Boolean).join(' ')}" src="${f.src}"${f.srcset ? ` srcset="${f.srcset}" sizes="${sizes}"` : ''} ${size} loading="lazy" decoding="async">`;
      })
      .join('');
  }
  const f = files(c.lang, '{cur}', name);
  const plain = files(c.lang, 'usd', name);
  return `<img${cls ? ` class="${cls}"` : ''} data-src="${f.src}"${f.srcset ? ` data-srcset="${f.srcset}" sizes="${sizes}"` : ''} ${size}${load === 'first' ? ' fetchpriority="high"' : ''}><noscript><img${cls ? ` class="${cls}"` : ''} src="${plain.src}" ${size}></noscript>`;
}

/** Fills in the hero's pictures for the currency <head> picked; runs right after them, before the first paint. */
export const HERO_SCRIPT = `(function(){var c=document.documentElement.getAttribute('data-uae')==='1'?'aed':'usd';document.querySelectorAll('img[data-src]').forEach(function(i){var s=i.getAttribute('data-srcset');if(s)i.srcset=s.split('{cur}').join(c);i.src=i.getAttribute('data-src').split('{cur}').join(c)})})();`;

/** A real app screen in a phone frame (parts.tsx PhoneShot); `w` in px, `tilt` in degrees. */
export const phone = (c, name, w, tilt = 0, load = true, cls = '', sizes = `${w}px`) =>
  `<div class="phone ${cls}" style="--w:${w}px;--tilt:${tilt}deg">${shot(c, name, { load, sizes })}</div>`;

const TOUR = ['ladies-queue', 'ladies-sale', 'ladies-closing'];

/**
 * "See how it works": three steps of a day (take a walk-in, make a sale, close the day) in a dialog, from the same
 * pictures. client.js opens it; without the script the link goes to the features. Keyboard: arrows, Tab, Esc.
 */
export function tour(c, button) {
  const t = c.t;
  const steps = TOUR.map(
    (name, i) => `<li class="tour-step" data-step="${i}"${i ? ' hidden' : ''}>
<div class="phone" style="--w:220px">${shot(c, name, { sizes: '220px' })}</div>
<div class="tour-text"><p class="tour-n">${esc(t('auth.landing.tour.stepOf', { n: i + 1, total: TOUR.length }))}</p><h3 class="t-h3">${esc(t(`auth.landing.tour.step${i + 1}`))}</h3><p class="muted">${esc(t(`auth.landing.tour.step${i + 1}Body`))}</p></div></li>`,
  ).join('');
  return `<dialog class="tour" id="tour" aria-labelledby="tour-title">
<div class="tour-head"><h2 class="t-h4" id="tour-title">${esc(t('auth.landing.tour.title'))}</h2><button type="button" class="tour-x" data-tour-close aria-label="${esc(t('common.close'))}">${c.icon('x', { size: 20 })}</button></div>
<ol class="tour-steps">${steps}</ol>
<div class="tour-nav"><button type="button" class="btn btn-outline btn-sm" data-tour-back>${esc(t('common.back'))}</button><span class="tour-dots" aria-hidden="true">${TOUR.map((_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</span><button type="button" class="btn btn-teal btn-sm" data-tour-next>${esc(t('auth.landing.tour.next'))}</button>${button(c, { label: c.startLabel, href: '#types', cls: 'btn-sm', attrs: ' data-start="tour" hidden' })}</div>
</dialog>`;
}
