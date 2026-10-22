/**
 * The website home page, top half, as plain HTML (website brief 4.1): the same sections, words and pictures as the
 * app's home page (src/features/landing), laid out by site.css. `c` is the page context from page.mjs.
 */
import { esc, LANGUAGES, pathOf } from './text.mjs';

/** `load`: true = when scrolled near (below the first screen), false = at once, 'first' = at once and before the rest
 *  (the largest picture on the first screen). */
const img = (name, w, h, alt = '', load = true) =>
  `<img src="/site/img/${name}" width="${w}" height="${h}" alt="${esc(alt)}"${load === true ? ' loading="lazy" decoding="async"' : load === 'first' ? ' fetchpriority="high"' : ''}>`;

/** The hero's phones change size with the page width (site.css .visual). */
export const HERO_SIZES = '(min-width: 980px) 270px, (min-width: 640px) 233px, 173px';

/**
 * A real app screen in a phone frame (parts.tsx PhoneShot); `w` in px, `tilt` in degrees. Phones get the 360-px
 * picture, larger screens the 600-px one (brief 4.5).
 */
export const phone = (shot, w, tilt = 0, lazy = true, cls = '', sizes = `${w}px`) => {
  const base = shot.replace(/\.webp$/, '');
  const picture = img(shot, 600, 1298, '', lazy).replace('<img', `<img srcset="/site/img/${base}-360.webp 360w, /site/img/${shot} 600w" sizes="${sizes}"`);
  return `<div class="phone ${cls}" style="--w:${w}px;--tilt:${tilt}deg" aria-hidden="true">${picture}</div>`;
};

/** The page's buttons (parts.tsx BrandButton): always real links. */
export const button = (c, { label, href, kind = 'teal', icon, attrs = '', cls = '' }) =>
  `<a class="btn btn-${kind} ${cls}" href="${esc(href)}"${attrs}><span>${esc(label)}</span>${icon ? c.icon(icon, { size: 18, flip: icon === 'chevronRight' }) : ''}</a>`;

const external = ' target="_blank" rel="noopener noreferrer"';

function languageMenu(c) {
  const current = LANGUAGES.find((l) => l.code === c.lang);
  const links = LANGUAGES.map(
    (l) =>
      `<li><a href="${pathOf(l.code)}" hreflang="${l.code}" lang="${l.code}" data-lang="${l.code}"${l.code === c.lang ? ' aria-current="page"' : ''}>${esc(l.name)}</a></li>`,
  ).join('');
  return `<details class="lang"><summary aria-label="${esc(`${c.t('language.title')}: ${current.name}`)}">${c.icon('languages', { size: 16 })}<span>${c.lang.toUpperCase()}</span></summary><ul>${links}</ul></details>`;
}

/** One language at a time (as the app's LanguageTicker), the whole list for screen readers and with Reduce Motion. */
function ticker(c) {
  const all = esc(c.t('auth.landing.facts.languages'));
  const one = LANGUAGES.map((l) => `<span lang="${l.code}">${esc(l.name)}</span>`).join('');
  return `<span class="ticker"><span class="one" aria-hidden="true">${one}</span><span class="all" aria-hidden="true">${all}</span><span class="sr">${all}</span></span>`;
}

function facts(c) {
  const items = [
    ['booking', 'calendarPlus', `<span>${esc(c.t('auth.landing.facts.booking'))}</span>`],
    ['languages', 'languages', ticker(c)],
    ['devices', 'smartphone', `<span>${esc(c.t('auth.landing.facts.devices'))}</span>`],
    ['private', 'shield', `<span>${esc(c.t('auth.landing.facts.private'))}</span>`],
  ];
  return `<ul class="facts">${items.map(([k, i, text]) => `<li class="fact-${k}">${c.icon(i, { size: 16 })}${text}</li>`).join('')}</ul>`;
}

export function hero(c) {
  const t = c.t;
  const second = c.whatsapp
    ? button(c, { label: t('auth.landing.whatsapp'), href: c.whatsapp, kind: 'whatsapp', icon: 'messageCircle', attrs: `${external} data-event="cta_whatsapp"`, cls: 'phone-only' })
    : button(c, { label: t('auth.landing.seeHow'), href: c.site.demoVideoUrl ? '#video' : '#features', kind: 'outline', cls: 'phone-only' });
  const demo = c.demo ? button(c, { label: t('auth.landing.demo'), href: c.demo, kind: 'outline', attrs: `${external} data-event="cta_book_demo"`, cls: 'not-phone' }) : '';
  return `<header class="hero navy">
<div class="backdrop glow-hero"></div>
<div class="inner hero-inner">
<nav class="topbar">
<a class="brand" href="${pathOf(c.lang)}">${img('mark-72.webp', 36, 36, '', false)}<span>${esc(c.brand.appName)}</span></a>
<div class="top-actions">${languageMenu(c)}<a class="signin" href="/sign-in" data-keep-lang>${esc(t('auth.landing.signIn'))}</a></div>
</nav>
<div class="hero-body">
<div class="copy">
<p class="eyebrow on-navy">${c.icon('sparkles', { size: 14 })}<span>${esc(t('auth.landing.eyebrow'))}</span></p>
<h1 class="t-hero">${esc(t('auth.landing.headline'))}</h1>
<p class="t-lead muted not-phone">${esc(t('auth.landing.lead'))}</p>
<p class="t-lead muted phone-only">${esc(t('auth.landing.leadShort'))}</p>
<div class="ctas" id="hero-cta">${button(c, { label: c.startLabel, href: '#types', icon: 'chevronRight', attrs: ' data-start="hero"' })}${second}${demo}</div>
<div class="trust">${c.trialDays > 0 ? `<p>${esc(t('auth.landing.noCard'))}</p>` : ''}<p>${esc(t('auth.landing.trust.dataYours'))}</p></div>
<p class="t-small muted not-phone">${esc(t('auth.landing.staffNote'))}</p>
</div>
<div class="hero-visual" aria-hidden="true"><div class="visual">
${img('star-300.webp', 300, 300, '', false).replace('<img', '<img class="star"')}
${phone('gents-queue.webp', 232, 7, false, 'p-back', HERO_SIZES)}
${phone('ladies-home.webp', 270, -5, 'first', 'p-front', HERO_SIZES)}
${img('queue-card.webp', 640, 355, '', false).replace('<img', '<img class="qcard"')}
<p class="chip">${c.icon('check', { size: 16, stroke: 2.6 })}<span>${esc(t('auth.landing.balanced'))}</span></p>
</div></div>
${facts(c)}
</div>
</div>
</header>`;
}

export function keep(c) {
  return `<section class="band lilac keep" aria-labelledby="keep-title"><div class="inner"><div class="keep-row">
<span class="round-icon">${c.icon('repeat', { size: 22 })}</span>
<div><h2 class="t-h4" id="keep-title">${esc(c.t('auth.landing.keep.title'))}</h2><p class="muted">${esc(c.t('auth.landing.keep.body'))}</p></div>
</div></div></section>`;
}

const tick = (c, size = 28) => `<span class="tick" style="--s:${size}px">${c.icon('check', { size: Math.round(size * 0.6), stroke: 2.6 })}</span>`;

export function owners(c) {
  const items = ['live', 'closing', 'pay', 'reminders', 'stock', 'reports'];
  return `<section class="band mist owners"><div class="inner owners-row">
<div class="owners-visual wide-only"><span class="halo"></span>${phone('gents-reports.webp', 290, -4)}</div>
<div class="copy">
<p class="eyebrow">${c.icon('sparkles', { size: 14 })}<span>${esc(c.t('auth.landing.owners.eyebrow'))}</span></p>
<h2 class="t-section">${esc(c.t('auth.landing.owners.title'))}</h2>
<p class="t-lead muted">${esc(c.t('auth.landing.owners.lead'))}</p>
<ul class="ticks">${items.map((k) => `<li>${tick(c)}<span>${esc(c.t(`auth.landing.owners.items.${k}`))}</span></li>`).join('')}</ul>
</div></div></section>`;
}

export function proof(c) {
  const { stats, testimonials, legalName } = c.site;
  if (!testimonials.length && !stats.length && !legalName) return '';
  const statsHtml = stats.length ? `<ul class="stats">${stats.map((s) => `<li><strong class="t-section">${esc(s.value)}</strong><span class="muted">${esc(s.label)}</span></li>`).join('')}</ul>` : '';
  const quotes = testimonials
    .map(
      (q) => `<figure class="quote"><blockquote class="t-lead">“${esc(q.quote)}”</blockquote><figcaption>${q.photoUrl ? `<img src="${esc(q.photoUrl)}" width="44" height="44" alt="" loading="lazy">` : ''}<span><strong>${esc(q.name)}</strong><span class="t-small muted">${esc([q.role, q.salon, q.city].filter(Boolean).join(' · '))}</span></span></figcaption></figure>`,
    )
    .join('');
  const madeBy = legalName ? `<p class="center muted">${esc(c.t('auth.landing.proof.madeBy', { name: legalName, place: c.madeIn }))}</p>` : '';
  return `<section class="band card proof"><div class="inner stack">${statsHtml}${quotes ? `<div class="quotes">${quotes}</div>` : ''}${madeBy}</div></section>`;
}

const SMALL = [
  ['closing', 'banknote'],
  ['staff', 'clock'],
  ['compliance', 'shield'],
  ['stock', 'boxes'],
  ['reports', 'chart'],
  ['roles', 'userCheck'],
];
const BIG = [
  ['booking', 'calendarPlus', 'gents-booking.webp', true],
  ['queue', 'users', 'gents-queue.webp', false],
  ['sale', 'receipt', 'gents-sale.webp', false],
];
/** WPS and the UAE checklist only for visitors in the UAE (brief 2.12); `.uae` / `.intl` are switched by the script. */
const UAE_ONLY = ['staff', 'compliance'];

const dots = (n) => `<div class="dots" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i${i === 0 ? ' class="on"' : ''}></i>`).join('')}</div>`;

export function features(c) {
  const t = c.t;
  const body = (k) =>
    UAE_ONLY.includes(k)
      ? `<span class="uae">${esc(t(`auth.landing.features.${k}.body`))}</span><span class="intl">${esc(t(`auth.landing.features.${k}.bodyIntl`))}</span>`
      : esc(t(`auth.landing.features.${k}.body`));
  const big = BIG.map(
    ([k, i, shot, dark]) => `<article class="big${dark ? ' navy' : ''}">${dark ? '<div class="backdrop glow-tile"></div>' : ''}
<div class="big-copy"><span class="ring${dark ? ' ring-dark' : ''}">${c.icon(i, { size: 20 })}</span><h3 class="t-h2">${esc(t(`auth.landing.features.${k}.title`))}</h3><p>${esc(t(`auth.landing.features.${k}.body`))}</p></div>
<div class="big-shot">${phone(shot, 230, dark ? 4 : -4)}</div></article>`,
  ).join('');
  const small = SMALL.map(
    ([k, i]) => `<article class="small"><span class="ring">${c.icon(i, { size: 20 })}</span><h3 class="t-h4">${esc(t(`auth.landing.features.${k}.title`))}</h3><p class="muted">${body(k)}</p></article>`,
  ).join('');
  return `<section class="band card features" id="features"><div class="inner stack-lg">
<div class="head"><h2 class="t-section center">${esc(t('auth.landing.featuresTitle'))}</h2><p class="t-lead muted center not-phone">${esc(t('auth.landing.featuresLead'))}</p></div>
<div class="swipe-wrap"><div class="bigs swipe" data-swipe>${big}</div>${dots(BIG.length)}</div>
<div class="swipe-wrap"><div class="smalls swipe" data-swipe>${small}</div>${dots(SMALL.length)}</div>
</div></section>`;
}

/** A 60–90 second walkthrough (brief 2.9), only with `site.demoVideoUrl`; the player loads on play. */
export function video(c) {
  const url = c.site.demoVideoUrl;
  if (!url) return '';
  const yt = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/.exec(url);
  const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
  const src = yt ? `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0` : vimeo ? `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1` : url;
  const poster = yt ? `<img src="https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg" width="480" height="360" alt="" loading="lazy">` : '';
  return `<section class="band navy video" id="video"><div class="backdrop glow-center"></div><div class="inner stack center-items">
<h2 class="t-section center">${esc(c.t('auth.landing.video.title'))}</h2>
<div class="video-box"><button type="button" class="poster" data-video="${esc(src)}" data-kind="${yt || vimeo ? 'frame' : 'file'}" data-title="${esc(c.t('auth.landing.video.title'))}" aria-label="${esc(c.t('auth.landing.video.play'))}">${poster}<span class="play">${c.icon('play', { size: 30 })}</span></button></div>
</div></section>`;
}
