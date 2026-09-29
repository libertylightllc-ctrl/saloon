import { useEffect } from 'react';

import { remember, sessionEntry, useHasPin } from './quickSwitch';
import { useSession, useWorkspace } from './session';

/**
 * While someone with a PIN is signed in, keep their remembered session current on this device. Supabase
 * rotates the refresh token about every hour; switching back later needs the newest one.
 */
export function useKeepRemembered() {
  const { session } = useSession();
  const { business, member } = useWorkspace();
  const hasPin = useHasPin(business.id);
  const token = session?.refresh_token;
  useEffect(() => {
    if (hasPin.data && session && session.user.id === member.user_id) void remember(sessionEntry(session, member));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPin.data, token, member.id]);
}
