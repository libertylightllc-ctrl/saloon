import { Redirect } from 'expo-router';
import { useEffect } from 'react';

import { arrivedFromLink, track } from '@/lib/analytics';

/**
 * Where sign-in links come back to: Google on the phones, and on the web the confirmation email and Google (the
 * website's home page sends them here; scripts/site/page.mjs). The session is already taken from the address, so just
 * go Home.
 */
export default function AuthCallback() {
  useEffect(() => {
    if (arrivedFromLink === 'signup') track('email_confirmed');
  }, []);
  return <Redirect href="/" />;
}
