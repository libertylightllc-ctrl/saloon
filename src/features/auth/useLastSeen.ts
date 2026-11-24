import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';

import { useSession } from './session';

const HOUR = 60 * 60 * 1000;

/**
 * Tells the database this login opened the app and in which language (owner's brief, Part B: the console's "Active
 * salons", and writing to an owner in their language): when the app starts, when it comes back after an hour or
 * more, and when the language changes. Only a hint: a failure is ignored, and the database writes at most once an
 * hour anyway.
 */
export function useLastSeen(): void {
  const { member } = useSession();
  const { i18n } = useTranslation();
  const last = useRef<{ key: string; at: number } | null>(null);
  const business = member?.active ? member.business_id : null;
  const language = i18n.language;

  useEffect(() => {
    if (!business) return;
    const touch = () => {
      const key = `${business}:${language}`;
      const now = Date.now();
      if (last.current?.key === key && now - last.current.at < HOUR) return;
      last.current = { key, at: now };
      supabase.rpc('touch_seen', { p_business: business, p_language: language }).then(
        () => undefined,
        () => undefined,
      );
    };
    touch();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') touch();
    });
    return () => sub.remove();
  }, [business, language]);
}

/** Renders nothing; keeps useLastSeen running inside the session. */
export function SeenTracker(): null {
  useLastSeen();
  return null;
}
