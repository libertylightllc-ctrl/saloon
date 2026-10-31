/**
 * The picture of a booking link's preview (owner's fix list D1): the salon's logo on a 1200 × 630 Saloqo card
 * (api/_lib/bookingCard.ts). Without a logo, or if anything goes wrong, Saloqo's own card. The address carries a
 * fingerprint of the logo and name (api/_lib/bookingPreview.ts), so each version is kept by the CDN for a day.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ImageResponse } from '@vercel/og';

import brand from '../src/config/brand.json';
import { bookingPlace } from '../src/features/booking/meta';
import { cardTree } from './_lib/bookingCard';
import { bookingPage, storageUrl } from './_lib/bookingData';
import { english, publicFile } from './_lib/bookingPreview';

const LOGO_TYPES = /^image\/(png|jpeg)$/;

/** Poppins, as on the homepage (vercel.json includes these files); without them the picture uses the built-in font. */
function fonts() {
  try {
    const file = (weight: string) => readFileSync(join(process.cwd(), 'node_modules/@expo-google-fonts/poppins', weight, `Poppins_${weight}.ttf`));
    return [
      { name: 'Poppins', data: file('500Medium'), weight: 500 as const, style: 'normal' as const },
      { name: 'Poppins', data: file('600SemiBold'), weight: 600 as const, style: 'normal' as const },
    ];
  } catch {
    return undefined;
  }
}

/** The logo as a data address (PNG or JPEG, up to 2 MB), so drawing never waits on another download. */
async function logoData(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const type = (response.headers.get('content-type') ?? '').split(';')[0]!.trim();
    if (!response.ok || !LOGO_TYPES.test(type)) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return bytes.length <= 2 * 1024 * 1024 ? `data:${type};base64,${bytes.toString('base64')}` : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const saloqo = new Response(null, { status: 302, headers: { location: `${brand.website}/og-image.jpg`, 'cache-control': 'public, s-maxage=600' } });
  const slug = (new URL(request.url).searchParams.get('slug') ?? '').toLowerCase().slice(0, 60);
  const { page } = await bookingPage(slug);
  const salon = page?.salon;
  const logo = salon?.logo_path ? await logoData(publicFile(storageUrl(), salon.logo_path)) : null;
  if (!salon || !logo) return saloqo;
  try {
    const tree = cardTree({
      logo,
      name: salon.business_name,
      place: bookingPlace(salon),
      action: english('meta.booking.card'),
      site: brand.website.replace(/^https:\/\/(www\.)?/, ''),
    });
    // Drawn in full here, so a failure falls back to Saloqo's card instead of a broken picture.
    const poppins = fonts();
    const png = await new ImageResponse(tree, { width: 1200, height: 630, fonts: poppins }).arrayBuffer();
    return new Response(png, {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        'x-card-font': poppins ? 'poppins' : 'built-in',
      },
    });
  } catch {
    return saloqo;
  }
}
