/**
 * The website home page, bottom half, as plain HTML (website brief 4.1): salon type, steps, price, questions, the
 * last call, the footer and the phone's sticky bar. Prices are written twice (`.uae` / `.intl`); the page script
 * shows the visitor's one, as the app's pricing card does.
 */
import { phone } from './shots.mjs';
import { button } from './sections-top.mjs';
import { esc, LANGUAGES, pathOf } from './text.mjs';

const external = ' target="_blank" rel="noopener noreferrer"';

/** The salon looks' own colours (src/theme/gents.ts, ladies.ts, unisex.ts, wellness.ts); brief 5.4 added the last two. */
const LOOK = {
  gents: { preview: '#6C45F2', text: '#6C45F2', action: '#6C45F2', shot: 'gents-queue', tilt: -3 },
  ladies: { preview: '#FDE1E0', text: '#B8464B', action: '#E0606A', shot: 'ladies-queue', tilt: 3 },
  unisex: { preview: '#2F8A7E', text: '#26736A', action: '#26736A', shot: 'unisex-queue', tilt: -3 },
  wellness: { preview: '#EBE3F8', text: '#5A3F92', action: '#7050AE', shot: 'wellness-queue', tilt: 3 },
}

export function types(c) {
  const t = c.t;
  const card = (mode) => {
    const look = LOOK[mode];
    return `<a class="type-card" href="/sign-up" data-type="${mode}" style="--preview:${look.preview};--text:${look.text};--action:${look.action}">
<span class="preview">${phone(c, look.shot, 200, look.tilt)}</span>
<span class="type-text"><span class="type-words"><span class="type-name">${esc(t(`auth.salonType.${mode}`))}</span><span class="muted not-phone">${esc(t(`auth.welcome.${mode}`))}</span></span>
<span class="go">${esc(t('auth.landing.choose'))}${c.icon('chevronRight', { size: 18, flip: true })}</span></span></a>`;
  };
  return `<section class="band mist types" id="types"><div class="inner stack-lg">
<div class="head"><h2 class="t-section center">${esc(t('auth.landing.typeTitle'))}</h2><p class="t-lead muted center">${esc(t('auth.welcome.subtitle'))}</p></div>
<div class="swipe-wrap"><div class="type-cards swipe" data-swipe>${Object.keys(LOOK).map(card).join('')}</div><div class="dots" aria-hidden="true">${Object.keys(LOOK).map((_, i) => `<i${i === 0 ? ' class="on"' : ''}></i>`).join('')}</div></div>
</div></section>`;
}

export function steps(c) {
  const items = [1, 2, 3].map((n) => `<li><span class="num" aria-hidden="true"><span class="phone-only">${n}</span><span class="not-phone">0${n}</span></span><span class="step-text">${esc(c.t(`auth.landing.steps.${n}`))}</span></li>`).join('');
  return `<section class="band card steps"><div class="inner stack-lg"><h2 class="t-section center">${esc(c.t('auth.landing.stepsTitle'))}</h2><ol class="step-list">${items}</ol></div></section>`;
}

/** The UAE visitor's text and everyone else's, side by side; site.css shows one (`html[data-uae]`). */
const both = (c, pick) => (c.prices ? ['uae', 'intl'].map((r) => `<span class="${r}">${esc(pick(c.prices[r]))}</span>`).join('') : '');

const LENGTH_LABEL = { 1: 'auth.landing.pricing.monthly', 6: 'auth.landing.pricing.sixMonths', 12: 'auth.landing.pricing.twelveMonths' };

/** One billing length's card: its price line ("AED 270 · save 10%"), the per-branch rule and the way in. */
function planCard(c, i) {
  const t = c.t;
  const length = c.prices.uae.lengths[i];
  const line = (p) => {
    const l = p.lengths[i];
    if (l.saveBps) return t('auth.landing.pricing.save', { price: l.total, percent: l.saveBps / 100 });
    if (l.freeMonths) return t('auth.landing.pricing.free', { price: l.total, count: l.freeMonths });
    return t('auth.landing.pricing.aMonth', { price: l.total });
  };
  return `<article class="plan${length.bestValue ? ' best' : ''}" data-testid="plan-${length.months}">
${length.bestValue ? `<p class="badge">${esc(t('auth.landing.pricing.best'))}</p>` : ''}
<h3 class="t-h3">${esc(t(LENGTH_LABEL[length.months]))}</h3>
<p class="plan-price">${both(c, line)}</p>
<p class="t-small muted">${esc(t('auth.landing.pricing.per', { people: c.prices.people }))} · ${both(c, (p) => t('auth.landing.pricing.extra', { price: p.extra }))}</p>
${button(c, { label: c.startLabel, href: '#types', attrs: ` data-start="pricing-${length.months}"`, cls: 'plan-btn' })}
</article>`;
}

const FEATURES = ['queue', 'bookingPage', 'sale', 'closing', 'roles', 'payroll', 'stock', 'reminders', 'books', 'branches', 'languages'];

export function pricing(c) {
  if (!c.prices) return '';
  const t = c.t;
  const tick = `<span class="tick" style="--s:22px">${c.icon('check', { size: 13, stroke: 2.6 })}</span>`;
  const feature = (k) =>
    k === 'payroll'
      ? `<span class="uae">${esc(t('auth.landing.pricing.features.payrollUae'))}</span><span class="intl">${esc(t('auth.landing.pricing.features.payroll'))}</span>`
      : esc(t(`auth.landing.pricing.features.${k}`));
  const select = (name, label, options) =>
    `<label><span>${esc(label)}</span><select name="${name}" data-calc="${name}">${options.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select></label>`;
  const range = (n) => Array.from({ length: n }, (_, i) => [i + 1, String(i + 1)]);
  return `<section class="band navy pricing" id="pricing"><div class="backdrop glow-pricing"></div><div class="inner stack center-items">
<h2 class="t-section center">${esc(t('auth.landing.pricing.title'))}</h2>
<p class="t-h3 teal center" data-testid="landing-trial">${esc(t('auth.landing.pricing.trial'))}</p>
<div class="plans">${c.prices.uae.lengths.map((_, i) => planCard(c, i)).join('')}</div>
<p class="strong teal center" data-testid="landing-per-day">${both(c, (p) => t('auth.landing.pricing.perDay', { price: p.perDay }))}</p>
<div class="every-plan"><h3 class="t-h3 center">${esc(t('auth.landing.pricing.everyPlan'))}</h3>
<ul class="feature-list">${FEATURES.map((k) => `<li>${tick}<span>${feature(k)}</span></li>`).join('')}</ul>
<p class="center teal-soft">${esc(t('auth.landing.pricing.inEveryPlan'))}</p></div>
<form class="calc" data-calc-form aria-labelledby="calc-title" onsubmit="return false">
<h3 class="t-h3" id="calc-title">${esc(t('auth.landing.calc.title'))}</h3>
<div class="calc-fields">
${select('branches', t('auth.landing.calc.branches'), range(10))}
${select('people', t('auth.landing.calc.people'), range(20).map(([v, l]) => [v, l]))}
${select('months', t('auth.landing.calc.length'), c.prices.uae.lengths.map((l) => [l.months, t(LENGTH_LABEL[l.months])]))}
</div>
<output class="calc-out" data-calc-out aria-live="polite"><strong data-calc-total></strong><span data-calc-each></span></output>
<ul class="examples t-small">
<li>${both(c, (p) => t('auth.landing.calc.example1', { price: p.example1 }))}</li>
<li>${both(c, (p) => t('auth.landing.calc.example2', { price: p.example2 }))}</li>
</ul>
</form>
<p class="t-small teal-soft center">${esc(t('auth.landing.trust.noRenew'))}</p>
</div></section>`;
}

/** "Your data is safe" (facts the code shows), "Works in your browser", and the emirates for UAE visitors. */
export function trust(c) {
  const t = c.t;
  const items = ['https', 'separate', 'roles', 'export'].map((k) => `<li>${c.icon('shield', { size: 18 })}<span>${esc(t(`auth.landing.safe.${k}`))}</span></li>`).join('');
  return `<section class="band card trust-band" aria-labelledby="safe-title"><div class="inner trust-grid">
<div><h2 class="t-h2" id="safe-title">${esc(t('auth.landing.safe.title'))}</h2><ul class="safe-list">${items}</ul></div>
<div class="browser"><span class="ring">${c.icon('smartphone', { size: 20 })}</span><h2 class="t-h2">${esc(t('auth.landing.browser.title'))}</h2><p class="muted">${esc(t('auth.landing.browser.body'))}</p></div>
</div></section>`;
}

/** The questions, in order (as src/features/landing/Faq.tsx FAQ_KEYS). */
export const FAQ_KEYS = ['price', 'free', 'branches', 'uaeCost', 'card', 'staffSignIn', 'languages', 'types', 'data', 'staff', 'printer', 'devices', 'homeScreen', 'bookingApp', 'countries'];
const PRICED = ['price', 'branches', 'uaeCost'];

/** One answer as plain text, with one region's prices (`p` a price set, or null without prices). */
export function faqAnswer(c, k, p) {
  if (k === 'price' && !p) return c.t('auth.landing.faq.price.aNoPrice');
  return c.t(`auth.landing.faq.${k}.a`, { price: p?.price ?? '', people: c.prices?.people ?? 4, extra: p?.extra ?? '' });
}

export const faqQuestion = (c, k) => c.t(`auth.landing.faq.${k}.q`);

export function faq(c) {
  const items = FAQ_KEYS.map((k) => {
    const answer = PRICED.includes(k) && c.prices ? both(c, (p) => faqAnswer(c, k, p)) : esc(faqAnswer(c, k, null));
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

/** The footer: languages, the emirates (UAE visitors), contact, legal pages, social links, AED | USD, "Made in Dubai".
 *  No licence, TRN, company name or address (full update brief: Saloqo is not yet a registered company). */
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
  // Instagram first.
  const social = ['instagram', 'tiktok', 'linkedin', 'youtube', 'facebook'].map((k) => [k, c.site.social[k]]).filter(([, url]) => url);
  const socialHtml = social.length ? `<nav class="links">${social.map(([k, url]) => `<a href="${esc(url)}"${external}>${SOCIAL[k]}</a>`).join('')}</nav>` : '';
  const currency = `<div class="currency" role="group" aria-label="${esc(t('auth.landing.currency.label'))}"><button type="button" data-currency="AED">AED</button><button type="button" data-currency="USD">USD</button></div>`;
  return `<footer class="band mist footer"><div class="inner stack-sm center-items">
<p class="uae t-small center areas">${esc(t('auth.landing.uaeAreas'))}</p>
<nav class="langs" aria-label="${esc(t('language.title'))}">${c.icon('languages', { size: 16 })}${langs}</nav>
${email}<nav class="links">${links}</nav>${socialHtml}${currency}
<p class="t-small center">© ${c.year} ${esc(c.brand.appName)} · ${esc(t('auth.landing.footer.madeIn', { place: c.madeIn }))}</p>
</div></footer>`;
}

/** A round WhatsApp button in the corner (bottom right; bottom left in Arabic and Urdu), once a number is set. */
export function floating(c) {
  return c.whatsapp
    ? `<a class="wa-round floating" href="${esc(c.whatsapp)}"${external} aria-label="${esc(c.t('auth.landing.whatsapp'))}" data-event="cta_whatsapp">${c.icon('messageCircle', { size: 26 })}</a>`
    : '';
}
