/**
 * A booking page's public data for the website's server functions (link previews, the card picture), read with the
 * public key as any visitor would. `moved`: the salon's current link when `slug` is one it used before (owner's fix list
 * D3). Anything going wrong reads as "no page", so the visitor still gets Saloqo's own page.
 */
import type { PreviewPage } from './bookingPreview';

export const SLUG = /^[a-z0-9-]{3,40}$/;

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T | null> {
  const base = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!base.startsWith('https://') || !key) return null;
  try {
    const response = await fetch(`${base}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: key, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    });
    return response.ok ? ((await response.json()) as T | null) : null;
  } catch {
    return null;
  }
}

export function storageUrl(): string {
  return (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
}

export async function bookingPage(slug: string): Promise<{ page: PreviewPage | null; moved: string | null }> {
  if (!SLUG.test(slug)) return { page: null, moved: null };
  const page = await rpc<PreviewPage>('public_booking_page', { p_slug: slug });
  if (page?.salon) return { page, moved: null };
  const moved = await rpc<string>('public_booking_link', { p_slug: slug });
  return { page: null, moved: typeof moved === 'string' && SLUG.test(moved) && moved !== slug ? moved : null };
}
