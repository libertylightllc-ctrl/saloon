/**
 * The website's "signed in here" marker (website brief 4.1): Vercel serves the home page at "/" to visitors and the
 * app to anyone with this cookie (vercel.json), so a signed-in owner still opens the app at saloqo.com. It holds no
 * account details and only says which page to send; the app sets it once signed in and clears it once signed out.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';

import type { SessionStatus } from './session';

export const SITE_COOKIE = 'sq_in';

export function siteCookieFor(status: SessionStatus): string | null {
  if (status === 'ready' || status === 'needsSetup') return `${SITE_COOKIE}=1; path=/; max-age=31536000; samesite=lax; secure`;
  if (status === 'signedOut') return `${SITE_COOKIE}=; path=/; max-age=0; samesite=lax; secure`;
  return null;
}

export function useSiteCookie(status: SessionStatus) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const cookie = siteCookieFor(status);
    if (cookie) document.cookie = cookie;
  }, [status]);
}
