import { usePathname } from 'expo-router';
import { useEffect } from 'react';

/** The screen someone was on before opening Help & support: sent with their message, to help fix what went wrong. */
let last: string | null = null;

export const lastScreen = () => last;

export function useTrackLastScreen() {
  const pathname = usePathname();
  useEffect(() => {
    if (!/^\/(more|support|contact)$/.test(pathname)) last = pathname;
  }, [pathname]);
}
