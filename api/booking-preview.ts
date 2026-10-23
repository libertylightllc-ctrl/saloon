/**
 * Link previews for booking pages (website brief 5.1, 2026-10-23). WhatsApp, Instagram and other apps read a shared
 * link without running the page, so vercel.json sends only their preview bots here: the salon's name, place and
 * picture as meta tags. People (and search engines) get the booking page itself. Nothing about the visitor is read or
 * kept; the salon's public page data is read with the public key.
 */
import { previewHtml, type PreviewSalon } from './_lib/bookingPreview';

export async function GET(request: Request): Promise<Response> {
  const slug = (new URL(request.url).searchParams.get('slug') ?? '').toLowerCase().slice(0, 60);
  const base = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  let salon: PreviewSalon | null = null;
  if (/^[a-z0-9-]{3,40}$/.test(slug) && base.startsWith('https://') && key) {
    try {
      const response = await fetch(`${base}/rest/v1/rpc/public_booking_page`, {
        method: 'POST',
        headers: { apikey: key, 'content-type': 'application/json' },
        body: JSON.stringify({ p_slug: slug }),
        signal: AbortSignal.timeout(4000),
      });
      const page = response.ok ? ((await response.json()) as { salon?: PreviewSalon } | null) : null;
      salon = page?.salon ?? null;
    } catch {
      salon = null;
    }
  }
  return new Response(previewHtml(slug, salon, base), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, s-maxage=600, stale-while-revalidate=86400' },
  });
}
