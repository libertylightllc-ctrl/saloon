/**
 * A booking page's link preview (website brief 5.1): the salon's name, branch, address and picture (cover photo, else
 * logo, else Saloqo's own) as a small HTML page of meta tags. Used only for link-preview bots (api/booking-preview.ts).
 */
import brand from '../../src/config/brand.json';
import en from '../../src/locales/en.json';

export interface PreviewSalon {
  business_name: string;
  branch_name: string;
  address: string | null;
  logo_path: string | null;
  cover_path?: string | null;
}

const escapes: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value: string) => value.replace(/[&<>"']/g, (c) => escapes[c]!);
const fill = (text: string, values: Record<string, string>) => text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => values[k] ?? '');

/** The preview page; `salon` null when the link is unknown or switched off (Saloqo's own preview then). */
export function previewHtml(slug: string, salon: PreviewSalon | null, storageUrl: string): string {
  const url = `${brand.website}/b/${encodeURIComponent(slug)}`;
  const where = salon && salon.branch_name && salon.branch_name !== salon.business_name ? salon.branch_name : null;
  const title = salon
    ? where
      ? fill(en.meta.booking.titleWhere, { salon: salon.business_name, where })
      : fill(en.meta.booking.title, { salon: salon.business_name })
    : en.meta.welcome.title;
  const description = salon
    ? [salon.address, fill(en.meta.booking.description, { salon: salon.business_name })].filter(Boolean).join(' · ')
    : en.meta.welcome.description;
  const picture = salon?.cover_path ?? salon?.logo_path;
  const image = picture ? `${storageUrl}/storage/v1/object/public/logos/${picture.split('/').map(encodeURIComponent).join('/')}` : `${brand.website}/og-image.jpg`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(brand.appName)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="${salon?.cover_path || !picture ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
</head>
<body><h1>${esc(title)}</h1><p>${esc(description)}</p><p><a href="${url}">${esc(url)}</a></p></body>
</html>
`;
}
