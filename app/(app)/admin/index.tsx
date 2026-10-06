import { Redirect } from 'expo-router';

/** The old admin page now lives in the platform console. */
export default function Admin() {
  return <Redirect href="/console" />;
}
