/**
 * A booking page's link preview (website brief 5.1; owner's fix list D1): "Book at <salon> – <town>", "<N> services ·
 * book online, no app needed" and a picture: the salon's logo on a Saloqo card (api/booking-card.ts), else its cover
 * photo, else Saloqo's own card. The tags go into the booking page itself (api/booking-preview.ts), so every app and
 * search engine that reads the link sees them. English, as previews are read without a language.
 */
import brand from '../../src/config/brand.json';
import { bookingMeta, bookingPlace, type MetaSalon } from '../../src/features/booking/meta';
import en from '../../src/locales/en.json';

export interface PreviewSalon extends MetaSalon {
  logo_path: string | null;
  cover_path?: string | null;
}

export interface PreviewPage {
  salon: PreviewSalon;
  services?: unknown[];
}

export interface PreviewMeta {
  title: string;
  description: string;
  url: string;
  image: string;
  /** Known for Saloqo's pictures (1200 × 630); a cover photo is the size it was taken. */
  imageSize: boolean;
}

const escapes: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value: string) => value.replace(/[&<>"']/g, (c) => escapes[c]!);
const fill = (text: string, values: Record<string, unknown>) =>
  text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => (values[k] === undefined ? '' : String(values[k])));

/** An English text by its key, with its {{values}}; the "_one" form for a count of 1. */
export function english(key: string, values: Record<string, unknown> = {}): string {
  const look = (k: string) =>
    k.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), en);
  const text = (values.count === 1 ? look(`${key}_one`) : undefined) ?? look(key);
  return typeof text === 'string' ? fill(text, values) : key;
}

/** A short fingerprint, so a new logo or name gets a new picture address (apps keep a preview picture for days). */
function fingerprint(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

export function publicFile(storageUrl: string, path: string): string {
  return `${storageUrl}/storage/v1/object/public/logos/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** The preview for a booking link; `page` null when the link is unknown or switched off (Saloqo's own then). */
export function previewMeta(slug: string, page: PreviewPage | null, storageUrl: string): PreviewMeta {
  const url = `${brand.website}/b/${encodeURIComponent(slug)}`;
  const saloqo = `${brand.website}/og-image.jpg`;
  if (!page?.salon) {
    return { title: en.meta.welcome.title, description: en.meta.welcome.description, url, image: saloqo, imageSize: true };
  }
  const salon = page.salon;
  const { title, description } = bookingMeta(salon, page.services?.length ?? 0, english);
  if (salon.logo_path) {
    const v = fingerprint(`${salon.logo_path}|${salon.business_name}|${bookingPlace(salon) ?? ''}`);
    const image = `${brand.website}/api/booking-card?slug=${encodeURIComponent(slug)}&v=${v}`;
    return { title, description, url, image, imageSize: true };
  }
  if (salon.cover_path) return { title, description, url, image: publicFile(storageUrl, salon.cover_path), imageSize: false };
  return { title, description, url, image: saloqo, imageSize: true };
}

/** The head tags for a preview. */
export function metaTags(meta: PreviewMeta): string {
  return [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}">`,
    `<link rel="canonical" href="${esc(meta.url)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(brand.appName)}">`,
    `<meta property="og:title" content="${esc(meta.title)}">`,
    `<meta property="og:description" content="${esc(meta.description)}">`,
    `<meta property="og:url" content="${esc(meta.url)}">`,
    `<meta property="og:image" content="${esc(meta.image)}">`,
    ...(meta.imageSize ? ['<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">'] : []),
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(meta.title)}">`,
    `<meta name="twitter:description" content="${esc(meta.description)}">`,
    `<meta name="twitter:image" content="${esc(meta.image)}">`,
  ].join('\n');
}

/** The app's page (dist/spa.html) with Saloqo's general tags swapped for this booking page's. */
export function withPreview(spa: string, meta: PreviewMeta): string {
  const general = [
    /<title>[\s\S]*?<\/title>\s*/gi,
    /<meta\s+name="description"[^>]*>\s*/gi,
    /<link\s+rel="canonical"[^>]*>\s*/gi,
    /<meta\s+property="og:[^"]*"[^>]*>\s*/gi,
    /<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi,
  ];
  const html = general.reduce((page, pattern) => page.replace(pattern, ''), spa);
  // A function, so a "$" in a salon's name is never read as a replacement pattern.
  return html.replace(/<\/head>/i, () => `${metaTags(meta)}\n</head>`);
}

/** A page of tags alone, should the app's page not load; its link opens the app's page itself. */
export function previewHtml(meta: PreviewMeta): string {
  const open = `${meta.url}?app=1`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${metaTags(meta)}
</head>
<body><h1>${esc(meta.title)}</h1><p>${esc(meta.description)}</p><p><a href="${esc(open)}">${esc(meta.url)}</a></p></body>
</html>
`;
}
