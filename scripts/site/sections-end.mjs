/**
 * The website home page, bottom half, as plain HTML (website brief 4.1): salon type, steps, price, questions, the
 * last call, the footer and the phone's sticky bar. Prices are written twice (`.uae` / `.intl`); the page script
 * shows the visitor's one, as the app's pricing card does.
 */
import { button, phone } from './sections-top.mjs';
import { esc, LANGUAGES, pathOf } from './text.mjs';

const external = ' target="_blank" rel="noopener noreferrer"';

/** The salon looks' own colours (src/theme/gents.ts, ladies.ts, unisex.ts, wellness.ts); brief 5.4 added the last two. */
const LOOK = {
  gents: { preview: '#6C45F2', text: '#6C45F2', action: '#6C45F2', shot: 'gents-queue.webp', tilt: -3 },
  ladies: { preview: '#FDE1E0', text: '#B8464B', action: '#E0606A', shot: 'ladies-queue.webp', tilt: 3 },
  unisex: { preview: '#2F8A7E', text: '#26736A', action: '#26736A', shot: 'unisex-queue.webp', tilt: -3 },
  wellness: { preview: '#EBE3F8', text: '#5A3F92', action: '#7050AE', shot: 'wellness-queue.webp', tilt: 3 },
}

export function types(c) {
  const t = c.t;
  const card = (mode) => {
    const look = LOOK[mode];
    return `<a class="type-card" href="/sign-up" data-type="${mode}" style="--preview:${look.preview};--text:${look.text};--action:${look.action}">
<span class="preview">${phone(look.shot, 200, look.tilt)}</span>
<span class="type-text"><span class="type-words"><span class="type-name">${esc(t(`auth.salonType.${mode}`))}</span><span class="muted not-phone">${esc(t(`auth.welcome.${mode}`))}</span></span>
<span class="go">${esc(t('auth.landing.choose'))}${c.icon('chevronRight', { size: 18, flip: true })}</span></span></a>`;
  };
  return `<section class="band mist types" id="types"><div class="inner stack-lg">
<div class="head"><h2 class="t-section center">${esc(t('auth.landing.typeTitle'))}</h2><p class="t-lead muted center">${esc(t('auth.welcome.subtitle'))}</p></div>
<div class="type-cards">${Object.keys(LOOK).map(card).join('')}</div>
</div></section>`;
}

export function steps(c) {
  const items = [1, 2, 3].map((n) => `<li><span class="num" aria-hidden="true"><span class="phone-only">${n}</span><span class="not-phone">0${n}</span></span><span class="step-text">${esc(c.t(`auth.landing.steps.${n}`))}</span></li>`).join('');
  return `<section class="band card steps"><div class="inner stack-lg"><h2 class="t-section center">${esc(c.t('auth.landing.stepsTitle'))}</h2><ol class="step-list">${items}</ol></div></section>`;
}

/** "AED 50.00" for UAE visitors, "USD 13.99" for everyone else; `pick` reads one price set; `kind` lets the page
 *  script write it again with today's prices (client.js). */
const both = (c, kind, pick) =>
  c.prices ? ['uae', 'intl'].map((r) => `<span class="${r}" data-price="${kind}">${esc(pick(c.prices[r]))}</span>`).join('') : '';

export function pricing(c) {
  if (!c.prices) return '';
  const t = c.t;
  const tick = `<span class="tick" style="--s:22px">${c.icon('check', { size: 13, stroke: 2.6 })}</span>`;
  const points = ['everything', 'languages', 'support'].map((k) => `<li>${tick}<span>${esc(t(`auth.landing.pricing.points.${k}`))}</span></li>`).join('');
  const demo = c.demo ? button(c, { label: t('auth.landing.demo'), href: c.demo, kind: 'text', attrs: `${external} data-event="cta_book_demo"` }) : '';
  return `<section class="band navy pricing" id="pricing"><div class="backdrop glow-pricing"></div><div class="inner stack center-items">
<h2 class="t-section center">${esc(t('auth.landing.pricing.title'))}</h2>
${c.trialDays > 0 ? `<p class="t-h3 teal center">${esc(t('auth.landing.pricing.trial', { count: c.trialDays }))}</p>` : ''}
<div class="price-card">
<p class="t-hero price" data-testid="landing-price">${both(c, 'price', (p) => p.price)}</p>
<p class="t-lead muted" data-people>${esc(t('auth.landing.pricing.per', { people: c.prices.people }))}</p>
<p class="t-small muted center">${both(c, 'extra', (p) => t('auth.landing.pricing.extra', { price: p.extra }))}</p>
<p class="strong teal center" data-testid="landing-per-day">${both(c, 'perDay', (p) => t('auth.landing.pricing.perDay', { price: p.perDay }))}</p>
<hr>
<ul class="points">${points}</ul>
<div class="price-cta">${button(c, { label: c.startLabel, href: '#types', icon: 'chevronRight', attrs: ' data-start="pricing"' })}<p class="t-small teal-soft center">${esc(t('auth.landing.trust.noRenew'))}</p>${demo}</div>
</div>
<p class="muted center note not-phone">${esc(t('auth.landing.pricing.note'))}</p>
</div></section>`;
}

/** The questions, in order (src/features/landing/Faq.tsx FAQ_KEYS). */
export const FAQ_KEYS = ['price', 'trial', 'card', 'data', 'staff', 'printer', 'devices', 'bookingApp', 'countries'];

/** One answer as plain text; the price answer for one region (`p` is a price set, or null without prices). */
export function faqAnswer(c, k, p) {
  if (k === 'price') return p ? c.t('auth.landing.faq.price.a', { price: p.price, people: c.prices.people, extra: p.extra }) : c.t('auth.landing.faq.price.aNoPrice');
  if (k === 'trial') return c.t('auth.landing.faq.trial.a', { count: c.trialDays || 7 });
  return c.t(`auth.landing.faq.${k}.a`);
}

export const faqQuestion = (c, k) => c.t(`auth.landing.faq.${k}.q`, { count: c.trialDays || 7 });

export function faq(c) {
  const items = FAQ_KEYS.map((k) => {
    const answer = k === 'price' && c.prices ? both(c, 'faq', (p) => faqAnswer(c, k, p)) : esc(faqAnswer(c, k, null));
    return `<details class="faq-item" data-faq="${k}"><summary><span>${esc(faqQuestion(c, k))}</span>${c.icon('plus', { size: 20, cls: 'plus' })}${c.icon('minus', { size: 20, cls: 'minus' })}</summary><p class="muted">${answer}</p></details>`;
  }).join('');
  return `<section class="band mist faq" id="faq"><div class="inner stack"><h2 class="t-section center">${esc(c.t('auth.landing.faq.title'))}</h2><div class="faq-list">${items}</div></div></section>`;
}

export function finalCall(c) {
  return `<section class="band navy final" id="final"><div class="backdrop glow-final"></div><div class="inner stack center-items">
<img class="final-star" src="/site/img/star-300.webp" width="300" height="300" alt="" loading="lazy" decoding="async">
<h2 class="t-section center">${esc(c.t('auth.landing.finalTitle'))}</h2>
<p class="t-lead muted center narrow">${esc(c.t('auth.landing.finalLead'))}</p>
${button(c, { label: c.startLabel, href: '#types', icon: 'chevronRight', attrs: ' data-start="final"' })}
</div></section>`;
}

const SOCIAL = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn', facebook: 'Facebook' };

export function footer(c) {
  const t = c.t;
  const langs = LANGUAGES.map((l) => `<a href="${pathOf(l.code)}" hreflang="${l.code}" lang="${l.code}" data-lang="${l.code}"${l.code === c.lang ? ' aria-current="page"' : ''}>${esc(l.name)}</a>`).join('');
  const email = c.brand.supportEmail.endsWith('@example.com') ? '' : `<p class="t-small center"><a href="mailto:${esc(c.brand.supportEmail)}">${esc(t('auth.landing.contact', { email: c.brand.supportEmail }))}</a></p>`;
  const chat = c.icon('messageCircle', { size: 16 });
  const contact = c.whatsapp
    ? `<a href="${esc(c.whatsapp)}"${external} data-event="cta_whatsapp">${chat}${esc(t('support.contactTitle'))}</a>`
    : `<a href="/contact" data-keep-lang>${chat}${esc(t('support.contactTitle'))}</a>`;
  const links = [
    c.whatsapp ? `<a href="${esc(c.whatsapp)}"${external} data-event="cta_whatsapp">${esc(t('auth.landing.whatsapp'))}</a>` : '',
    contact,
    `<a href="/privacy" data-keep-lang>${esc(t('legal.privacy.title'))}</a>`,
    `<a href="/terms" data-keep-lang>${esc(t('legal.terms.title'))}</a>`,
  ].join('');
  const social = Object.entries(c.site.social).filter(([, url]) => url);
  const socialHtml = social.length ? `<nav class="links">${social.map(([k, url]) => `<a href="${esc(url)}"${external}>${SOCIAL[k]}</a>`).join('')}</nav>` : '';
  const legal = c.site.legalName ? `<p class="t-small center">${esc([c.site.legalName, c.site.legalAddress].filter(Boolean).join(' · '))}</p>` : '';
  return `<footer class="band mist footer"><div class="inner stack-sm center-items">
<nav class="langs" aria-label="${esc(t('language.title'))}">${c.icon('languages', { size: 16 })}${langs}</nav>
${email}<nav class="links">${links}</nav>${socialHtml}${legal}
<p class="t-small center">© ${c.year} ${esc(c.brand.appName)} · ${esc(t('auth.landing.footer.madeIn', { place: c.madeIn }))}</p>
</div></footer>`;
}

/** On a phone, the way in stays on screen (brief 2.3); on a computer, a round WhatsApp button (brief 2.4). */
export function sticky(c) {
  const round = (cls) => (c.whatsapp ? `<a class="wa-round ${cls}" href="${esc(c.whatsapp)}"${external} aria-label="${esc(c.t('auth.landing.whatsapp'))}" data-event="cta_whatsapp">${c.icon('messageCircle', { size: 26 })}</a>` : '');
  return `<div class="sticky" id="sticky" hidden>${button(c, { label: c.startLabel, href: '#types', icon: 'chevronRight', attrs: ' data-start="sticky"', cls: 'full' })}${round('')}</div>${round('floating not-phone')}`;
}
