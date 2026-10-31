/**
 * Every visit to a booking page (saloqo.com/b/<link>) comes here (vercel.json): the app's page with this salon's title,
 * description and picture in it (owner's fix list D1), so WhatsApp, Instagram, iMessage, search engines and anything
 * else that reads the link sees the salon, not Saloqo. A link the salon used before sends people on to its current one
 * for good (D3). Nothing about the visitor is read or kept.
 */
import { bookingPage, storageUrl } from './_lib/bookingData';
import { previewHtml, previewMeta, withPreview } from './_lib/bookingPreview';

// The app's page, kept for a few minutes per running copy of this function.
let spa: { html: string; at: number } | null = null;

async function appPage(origin: string): Promise<string | null> {
  if (spa && Date.now() - spa.at < 5 * 60_000) return spa.html;
  try {
    const response = await fetch(`${origin}/spa.html`, { signal: AbortSignal.timeout(3000) });
    const html = response.ok ? await response.text() : '';
    if (!/<\/head>/i.test(html)) return null;
    spa = { html, at: Date.now() };
    return html;
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const address = new URL(request.url);
  const slug = (address.searchParams.get('slug') ?? '').toLowerCase().slice(0, 60);
  const [{ page, moved }, html] = await Promise.all([bookingPage(slug), appPage(address.origin)]);
  if (moved) {
    // Permanent, but browsers keep it only an hour: the salon may take its old link back.
    return new Response(null, {
      status: 301,
      headers: { location: `/b/${moved}`, 'cache-control': 'public, max-age=3600, s-maxage=600' },
    });
  }
  const meta = previewMeta(slug, page, storageUrl());
  return new Response(html ? withPreview(html, meta) : previewHtml(meta), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400' },
  });
}
