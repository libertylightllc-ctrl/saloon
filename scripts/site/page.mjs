/**
 * One language's home page as a complete HTML document (website brief 4.1, 4.2): real text for search engines and a
 * fast first screen, with no app code. The sections mirror src/features/landing; build.mjs writes one per language.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { head } from './head.mjs';
import { icon } from './icons.mjs';
import { faq, finalCall, floating, footer, pricing, steps, trust, types } from './sections-end.mjs';
import { button, features, hero, HERO_SIZES, keep, owners, proof, siteHeader, video } from './sections-top.mjs';
import { pilotBar, pilotSection } from './pilot.mjs';
import { tour } from './shots.mjs';
import { LANGUAGES, lengthTotal, money, translator } from './text.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const minify = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\n\s*/g, '');
const CSS = minify(['site.css', 'tour.css', 'pilot.css'].map((f) => readFileSync(join(here, f), 'utf8')).join('\n'));
const CLIENT = readFileSync(join(here, 'client.js'), 'utf8');

/**
 * Runs first, in <head>:
 * - a sign-in link (email confirmation, Google) comes back to "/" with its details in the address: on to the app,
 *   which signs the person in;
 * - someone signed in on this device goes into the app (the `sq_in` cookie tells Vercel to serve the app at "/"; once
 *   per tab, so a stale session cannot loop);
 * - "/" opens in the visitor's language (their earlier choice, else their device's), as the app picks it;
 * - the currency: the one the visitor picked in the footer, else AED for the UAE time zone (USD elsewhere) until
 *   /api/geo answers; the hero's largest picture in that currency's set starts loading at once;
 * - Vercel Web Analytics only on a real address (a server on this computer has no /_vercel/).
 */
const early = (lang) => `(function(){var d=document.documentElement,s=null;try{s=localStorage}catch(e){}
if(/(^|[#&])(access_token|error_description|error)=/.test(location.hash)||/[?&](code|token_hash)=/.test(location.search)){location.replace('/auth-callback'+location.search+location.hash);return}
try{if(s)for(var i=0;i<s.length;i++){if(/^sb-.+-auth-token$/.test(s.key(i))){if(!sessionStorage.getItem('sq.toApp')){sessionStorage.setItem('sq.toApp','1');document.cookie='sq_in=1; path=/; max-age=31536000; samesite=lax; secure';location.replace('/');return}break}}}catch(e){}
var codes=${JSON.stringify(LANGUAGES.map((l) => l.code))};
if(${JSON.stringify(lang)}==='en'){var want=null;try{want=s&&s.getItem('settings.language')}catch(e){}if(!want){var l=navigator.languages||[navigator.language];for(var j=0;j<l.length;j++){var c=String(l[j]||'').slice(0,2).toLowerCase();if(codes.indexOf(c)>=0){want=c;break}}}if(want&&want!=='en'&&codes.indexOf(want)>=0){location.replace('/'+want+location.hash);return}}
var cur=null;try{cur=s&&s.getItem('sq.currency')}catch(e){}
if(cur==='AED'||cur==='USD'){d.setAttribute('data-uae',cur==='AED'?'1':'0');d.setAttribute('data-cur',cur)}else{var z='';try{z=Intl.DateTimeFormat().resolvedOptions().timeZone}catch(e){}d.setAttribute('data-uae',z==='Asia/Dubai'?'1':'0')}
var b='/site/img/shots/${lang}/'+(d.getAttribute('data-uae')==='1'?'aed':'usd')+'/ladies-home',p=document.createElement('link');p.rel='preload';p.as='image';p.href=b+'.webp';p.setAttribute('imagesrcset',b+'-360.webp 360w, '+b+'.webp 600w');p.setAttribute('imagesizes',${JSON.stringify(HERO_SIZES)});p.setAttribute('fetchpriority','high');document.head.appendChild(p);
window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};
if(!/^(localhost|127\\.|\\[::1\\]|10\\.|192\\.168\\.)|\\.local$/.test(location.hostname)){var a=document.createElement('script');a.defer=true;a.src='/_vercel/insights/script.js';document.head.appendChild(a)}})();`;

/** Billing lengths and the per-day line (src/config/pricing.json, as the app reads it). */
const PRICING = JSON.parse(readFileSync(join(here, '..', '..', 'src', 'config', 'pricing.json'), 'utf8'));

/**
 * The price sets the page shows, AED and USD, from the platform settings row (null without it: the price parts are
 * left out): per branch for up to `included_people`, each extra person, every billing length, the per-day line and the
 * two worked examples (full update brief, Phase 2).
 */
function priceSets(row) {
  if (!row) return null;
  const people = row.included_people;
  const branch = (n, base, extra) => base + Math.max(0, n - people) * extra;
  const set = (base, extra, currency) => ({
    currency,
    baseMinor: base,
    extraMinor: extra,
    price: money(base, currency),
    extra: money(extra, currency),
    perDay: money(PRICING.perDayUnder[currency] ?? Math.ceil(base / 30), currency),
    lengths: PRICING.lengths.map((l) => ({ ...l, total: money(lengthTotal(base, l), currency), extraTotal: money(lengthTotal(extra, l), currency) })),
    example1: money(branch(6, base, extra), currency),
    example2: money(2 * branch(5, base, extra), currency),
  });
  return {
    people,
    uae: set(row.price_per_branch_minor, row.extra_person_minor, row.currency),
    intl: set(row.intl_price_per_branch_minor, row.intl_extra_person_minor, row.intl_currency),
  };
}

export function renderPage({ root, lang, row, pilot, api, brand, site, supabase, year }) {
  const t = translator(root, lang);
  const rtl = LANGUAGES.find((l) => l.code === lang).rtl;
  const digits = site.whatsappNumber.replace(/\D/g, '');
  const wa = (text) => `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  const whatsapp = digits.length >= 8 ? wa(site.whatsappDefaultText) : null;
  const c = {
    t,
    lang,
    rtl,
    brand,
    site,
    year,
    prices: priceSets(row),
    // The pilot (full update, Phase 6): its days as months, its size and the places left; null hides it.
    pilot:
      pilot && Number(pilot.max) > 0
        ? { days: Number(pilot.days), months: Math.max(1, Math.round(Number(pilot.days) / 30)), max: Number(pilot.max), placesLeft: Number(pilot.places_left) }
        : null,
    startLabel: t('auth.landing.tryFree'),
    whatsapp,
    demo: site.demoBookingUrl || (whatsapp ? wa("Hi, I'd like a quick demo of Saloqo for my salon.") : null),
    madeIn: site.madeIn === 'Dubai, UAE' ? t('auth.landing.place.dubai') : site.madeIn,
    icon: (name, options) => icon(root, name, options),
  };
  // For the page script: the calculator's prices and words (RTL values isolated as the translator does).
  const own = JSON.parse(readFileSync(join(root, 'src', 'locales', `${lang}.json`), 'utf8'));
  const mine = (key) => key.split('.').reduce((n, k) => n?.[k], own);
  const raw = (key) => mine(key) ?? t(key);
  const sq = {
    lang,
    rtl,
    people: row?.included_people ?? 4,
    sets: c.prices ? { uae: { currency: c.prices.uae.currency, base: c.prices.uae.baseMinor, extra: c.prices.uae.extraMinor }, intl: { currency: c.prices.intl.currency, base: c.prices.intl.baseMinor, extra: c.prices.intl.extraMinor } } : null,
    lengths: PRICING.lengths,
    texts: { total: raw('auth.landing.calc.total'), perBranch: raw('auth.landing.calc.perBranch') },
    // The pilot form posts to the database (the public key, as the app's own page has it); the places are refreshed.
    pilot: c.pilot && api?.url && api?.key
      ? {
          url: api.url,
          key: api.key,
          texts: {
            thanks: raw('auth.landing.pilot.form.thanks'),
            error: raw('auth.landing.pilot.form.error'),
            tooMany: raw('auth.landing.pilot.form.tooMany'),
            invalid: {
              name: raw('auth.landing.pilot.form.invalid.name'),
              salon_name: raw('auth.landing.pilot.form.invalid.salon'),
              staff_count: raw('auth.landing.pilot.form.invalid.staff'),
              whatsapp: raw('auth.landing.pilot.form.invalid.whatsapp'),
              whatsapp_ok: raw('auth.landing.pilot.form.invalid.ok'),
            },
            // The plural forms the page's language writes (Arabic: six), picked in the browser by Intl.PluralRules;
            // a form it leaves out (Spanish "many", for millions) uses "other".
            places: Object.fromEntries(
              ['zero', 'one', 'two', 'few', 'many', 'other']
                .filter((form) => form === 'other' || mine(`auth.landing.pilot.places_${form}`))
                .map((form) => [form, raw(`auth.landing.pilot.places_${form}`)]),
            ),
          },
        }
      : null,
  };
  const main = [keep(c), owners(c), proof(c), features(c), video(c), types(c), steps(c), pricing(c), pilotSection(c), trust(c), faq(c), finalCall(c)].join('\n');
  return `<!doctype html>
<html lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}">
${head(c, CSS, early(lang))}
<body>
${pilotBar(c)}
${siteHeader(c)}
${hero(c)}
<main>
${main}
</main>
${footer(c)}
${floating(c)}
${tour(c, button)}
<script>window.SQ=${JSON.stringify(sq).replace(/</g, '\\u003c')}</script>
<script>${CLIENT}</script>
</body>
</html>
`;
}
