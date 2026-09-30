import { Redirect } from 'expo-router';

/** Team & logins became part of Staff (one place for people, pay and logins); old links land there. */
export default function Team() {
  return <Redirect href="/staff" />;
}
