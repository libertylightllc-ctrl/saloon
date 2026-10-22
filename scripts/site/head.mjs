/**
 * The home page's <head> (website brief 4.2, 4.3): title and description in the page's language, the canonical
 * address, every language version (hreflang), link previews with the large picture, the app and its questions as
 * structured data, the fonts for the page's script, and Vercel Web Analytics (owner, 22 Oct 2026; no cookies).
 */
import { FAQ_KEYS, faqAnswer, faqQuestion } from './sections-end.mjs';
import { HERO_SIZES } from './sections-top.mjs';
import { esc, LANGUAGES, pathOf } from './text.mjs';

const OG_LOCALE = { en: 'en_US', ar: 'ar_AE', hi: 'hi_IN', ur: 'ur_PK', es: 'es_ES', fr: 'fr_FR', pt: 'pt_BR' };
const WEIGHTS = [300, 400, 500, 600, 700];

/** Fonts as the app picks them (src/lib/fonts.ts): Poppins (Latin, Devanagari), IBM Plex Sans Arabic (ar, ur). */
function fonts(lang) {
  const rtl = LANGUAGES.find((l) => l.code === lang).rtl;
  const face = (family, file, weight, range) =>
    `@font-face{font-family:${family};src:url(/site/fonts/${file}-${weight}.woff2) format("woff2");font-weight:${weight};font-display:swap${range ? `;unicode-range:${range}` : ''}}`;
  const faces = rtl
    ? WEIGHTS.map((w) => face('Plex', 'plex-arabic', w))
    : [
        ...WEIGHTS.map((w) => face('Poppins', 'poppins-latin', w, 'U+0000-017F,U+2000-206F,U+20AC,U+2122,U+2190-2199,U+2212,U+FEFF,U+FFFD')),
        ...(lang === 'hi' ? WEIGHTS.map((w) => face('Poppins', 'poppins-deva', w, 'U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20A8,U+20B9,U+25CC,U+A830-A839,U+A8E0-A8FF')) : []),
      ];
  // The two faces on the first screen load first.
  const preload = (rtl ? ['plex-arabic-300', 'plex-arabic-500'] : ['poppins-latin-300', 'poppins-latin-500'])
    .map((f) => `<link rel="preload" href="/site/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin>`)
    .join('');
  return { css: faces.join(''), preload, family: rtl ? 'Plex' : 'Poppins' };
}

function structuredData(c, url) {
  const offers = c.prices
    ? [
        { '@type': 'Offer', price: (c.prices.raw.intl / 100).toFixed(2), priceCurrency: c.prices.intl.currency, description: c.t('auth.landing.pricing.per', { people: c.prices.people }) },
        { '@type': 'Offer', price: (c.prices.raw.uae / 100).toFixed(2), priceCurrency: c.prices.uae.currency, eligibleRegion: { '@type': 'Country', name: 'AE' } },
      ]
    : undefined;
  const app = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: c.brand.appName,
    url,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: c.lang,
    description: c.t('meta.welcome.description'),
    image: `${c.brand.website}/og-image.jpg`,
    ...(offers ? { offers } : {}),
    ...(c.trialDays > 0 ? { featureList: c.t('auth.landing.pricing.trial', { count: c.trialDays }) } : {}),
  };
  // The questions for search engines, with the international price (as most crawlers see it).
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_KEYS.map((k) => ({ '@type': 'Question', name: faqQuestion(c, k), acceptedAnswer: { '@type': 'Answer', text: faqAnswer(c, k, c.prices?.intl ?? null) } })),
  };
  const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json(app)}</script><script type="application/ld+json" id="faq-jsonld">${json(faq)}</script>`;
}

export function head(c, css, earlyScript) {
  const url = `${c.brand.website}${pathOf(c.lang)}`;
  const title = c.t('meta.welcome.title');
  const description = c.t('meta.welcome.description');
  const f = fonts(c.lang);
  const alternates = [...LANGUAGES.map((l) => [l.code, l.code]), ['x-default', 'en']]
    .map(([hreflang, code]) => `<link rel="alternate" hreflang="${hreflang}" href="${c.brand.website}${pathOf(code)}">`)
    .join('');
  const ogAlternates = LANGUAGES.filter((l) => l.code !== c.lang).map((l) => `<meta property="og:locale:alternate" content="${OG_LOCALE[l.code]}">`).join('');
  return `<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
${alternates}
<meta name="theme-color" content="#0B0916">
<link rel="icon" href="/favicon.ico">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(c.brand.appName)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="${OG_LOCALE[c.lang]}">${ogAlternates}
<meta property="og:image" content="${c.brand.website}/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(c.t('auth.landing.headline'))}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${c.brand.website}/og-image.jpg">
${f.preload}
<link rel="preload" as="image" href="/site/img/ladies-home.webp" imagesrcset="/site/img/ladies-home-360.webp 360w, /site/img/ladies-home.webp 600w" imagesizes="${HERO_SIZES}" fetchpriority="high">
<script>${earlyScript}</script>
<style>${f.css}:root{--font:${f.family},system-ui,-apple-system,"Segoe UI",sans-serif}${css}</style>
${structuredData(c, url)}
</head>`;
}
