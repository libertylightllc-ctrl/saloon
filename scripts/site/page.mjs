/**
 * One language's home page as a complete HTML document (website brief 4.1, 4.2): real text for search engines and a
 * fast first screen, with no app code. The sections mirror src/features/landing; build.mjs writes one per language.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { head } from './head.mjs';
import { icon } from './icons.mjs';
import { faq, finalCall, footer, pricing, steps, sticky, types } from './sections-end.mjs';
import { features, hero, keep, owners, proof, video } from './sections-top.mjs';
import { LANGUAGES, money, translator } from './text.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const minify = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\n\s*/g, '');
const CSS = minify(readFileSync(join(here, 'site.css'), 'utf8'));
const CLIENT = readFileSync(join(here, 'client.js'), 'utf8');

/**
 * Runs first, in <head>: a sign-in link (email confirmation, password reset, Google) comes back to "/" with its details
 * in the address — they go on to the app, which signs the person in; someone signed in on this device goes into the app (the `sq_in` cookie tells Vercel to serve
 * the app at "/"; once per tab, so a stale session cannot loop); "/" opens in the visitor's language (their earlier
 * choice, else their device's), as the app picks it; the UAE price by time zone until /api/geo answers; Vercel Web
 * Analytics only on a real address (a server on this computer has no /_vercel/).
 */
const early = (lang) => `(function(){var d=document.documentElement,s=null;try{s=localStorage}catch(e){}
if(/(^|[#&])(access_token|error_description|error)=/.test(location.hash)||/[?&](code|token_hash)=/.test(location.search)){location.replace('/auth-callback'+location.search+location.hash);return}
try{if(s)for(var i=0;i<s.length;i++){if(/^sb-.+-auth-token$/.test(s.key(i))){if(!sessionStorage.getItem('sq.toApp')){sessionStorage.setItem('sq.toApp','1');document.cookie='sq_in=1; path=/; max-age=31536000; samesite=lax; secure';location.replace('/');return}break}}}catch(e){}
var codes=${JSON.stringify(LANGUAGES.map((l) => l.code))};
if(${JSON.stringify(lang)}==='en'){var want=null;try{want=s&&s.getItem('settings.language')}catch(e){}if(!want){var l=navigator.languages||[navigator.language];for(var j=0;j<l.length;j++){var c=String(l[j]||'').slice(0,2).toLowerCase();if(codes.indexOf(c)>=0){want=c;break}}}if(want&&want!=='en'&&codes.indexOf(want)>=0){location.replace('/'+want+location.hash);return}}
var z='';try{z=Intl.DateTimeFormat().resolvedOptions().timeZone}catch(e){}d.setAttribute('data-uae',z==='Asia/Dubai'?'1':'0');
window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};
if(!/^(localhost|127\\.|\\[::1\\]|10\\.|192\\.168\\.)|\\.local$/.test(location.hostname)){var a=document.createElement('script');a.defer=true;a.src='/_vercel/insights/script.js';document.head.appendChild(a)}})();`;

/** The price sets the page shows, from the platform settings row (null without it: the price parts are left out). */
function priceSets(row) {
  if (!row) return null;
  const set = (minor, extra, currency) => ({ price: money(minor, currency), extra: money(extra, currency), perDay: money(Math.ceil(minor / 30), currency), currency });
  return {
    people: row.included_people,
    uae: set(row.price_per_branch_minor, row.extra_person_minor, row.currency),
    intl: set(row.intl_price_per_branch_minor, row.intl_extra_person_minor, row.intl_currency),
    raw: { uae: row.price_per_branch_minor, intl: row.intl_price_per_branch_minor },
  };
}

export function renderPage({ root, lang, row, brand, site, supabase, year }) {
  const t = translator(root, lang);
  const rtl = LANGUAGES.find((l) => l.code === lang).rtl;
  const trialDays = row?.trial_days ?? 0;
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
    trialDays,
    startLabel: trialDays > 0 ? t('auth.landing.start', { count: trialDays }) : t('auth.landing.create'),
    whatsapp,
    demo: site.demoBookingUrl || (whatsapp ? wa("Hi, I'd like a quick demo of Saloqo for my salon.") : null),
    madeIn: site.madeIn === 'Dubai, UAE' ? t('auth.landing.place.dubai') : site.madeIn,
    icon: (name, options) => icon(root, name, options),
  };
  // For the page script: today's prices are compared with these and the texts written again when they differ.
  const own = JSON.parse(readFileSync(join(root, 'src', 'locales', `${lang}.json`), 'utf8'));
  const raw = (key) => key.split('.').reduce((n, k) => n?.[k], own) ?? t(key);
  const sq = {
    lang,
    rtl,
    supabase: supabase.url,
    key: supabase.key,
    prices: row
      ? {
          price_per_branch_minor: row.price_per_branch_minor,
          currency: row.currency,
          intl_price_per_branch_minor: row.intl_price_per_branch_minor,
          intl_currency: row.intl_currency,
          included_people: row.included_people,
          extra_person_minor: row.extra_person_minor,
          intl_extra_person_minor: row.intl_extra_person_minor,
        }
      : null,
    texts: { per: raw('auth.landing.pricing.per'), extra: raw('auth.landing.pricing.extra'), perDay: raw('auth.landing.pricing.perDay'), faq: raw('auth.landing.faq.price.a') },
  };
  const main = [keep(c), owners(c), proof(c), features(c), video(c), types(c), steps(c), pricing(c), faq(c), finalCall(c)].join('\n');
  return `<!doctype html>
<html lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}">
${head(c, CSS, early(lang))}
<body>
${hero(c)}
<main>
${main}
</main>
${footer(c)}
${sticky(c)}
<script>window.SQ=${JSON.stringify(sq).replace(/</g, '\\u003c')}</script>
<script>${CLIENT}</script>
</body>
</html>
`;
}
