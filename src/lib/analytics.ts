/**
 * The website's analytics events (website brief 4.7): Vercel Web Analytics (owner, 22 Oct 2026), which uses no cookies
 * and identifies no one. Web only — the phone apps send nothing. The home page sends its own events (cta_start_free,
 * cta_whatsapp, cta_book_demo, faq_open, video_play; scripts/site/client.js); the app sends these.
 */
import { Platform } from 'react-native';

export type AppEvent = 'signup_started' | 'signup_completed' | 'email_confirmed';

type Va = (kind: 'event', payload: { name: string }) => void;

export function track(name: AppEvent): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  (window as unknown as { va?: Va }).va?.('event', { name });
}

/**
 * The kind of sign-in link this page was opened from ("signup" for an email confirmation). Read when the app starts,
 * before the sign-in library takes the details out of the address (src/lib/supabase.ts imports this first).
 */
export const arrivedFromLink: string | null =
  Platform.OS === 'web' && typeof window !== 'undefined' ? new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type') : null;
