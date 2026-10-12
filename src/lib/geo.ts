/**
 * The visitor's country by IP (owner, 2026-10-12: the website opens in the visitor's language and shows their price).
 * The website asks its own host (api/geo.ts: Vercel puts the country on every request); the phone apps ask the
 * website. Null when it cannot tell — local development, offline, or slower than `timeoutMs` — and the caller falls
 * back to what the device says. Asked once per app start.
 */
import { Platform } from 'react-native';

import { brand } from '@/config/brand';

const GEO_URL = Platform.OS === 'web' ? '/api/geo' : `${brand.website}/api/geo`;
let asked: Promise<string | null> | null = null;

async function ask(timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(GEO_URL, { signal: controller.signal });
    // A host without the endpoint answers with the web page instead.
    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('json')) return null;
    const { country } = (await response.json()) as { country?: unknown };
    return typeof country === 'string' && /^[A-Z]{2}$/.test(country) ? country : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function visitorCountry(timeoutMs = 1500): Promise<string | null> {
  asked ??= ask(timeoutMs);
  return asked;
}
