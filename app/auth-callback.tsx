import { Redirect } from 'expo-router';

/** Where Google sends phones back to; the session is already taken from the address, so just go Home. */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
