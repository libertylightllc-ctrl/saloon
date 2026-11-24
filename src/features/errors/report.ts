import { supabase } from '@/lib/supabase';

/**
 * The error's text without what could name a person: an email address or a phone number is replaced (it goes to
 * the platform owners' System health, owner's brief, Part B, B10).
 */
export function errorText(error: unknown): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return raw
    .replace(/[^\s@]+@[^\s@]+/g, '[email]')
    .replace(/\+?\d[\d ()-]{6,}\d/g, '[number]')
    .slice(0, 500);
}

/** Tells the platform owners a screen crashed. Only a record: a failure here is ignored. */
export function reportAppError(error: unknown, screen: string | null, business: string | null): void {
  supabase
    .rpc('report_app_error', { p_message: errorText(error), p_screen: screen?.slice(0, 200) ?? undefined, p_business: business ?? undefined })
    .then(
      () => undefined,
      () => undefined,
    );
}
