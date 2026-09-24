import { Redirect } from 'expo-router';

// Phases 1–2: the app opens on the design demo. Phase 2 replaces this with
// splash → sign-in → (tabs), and /dev becomes reachable from dev builds only.
export default function Index() {
  return <Redirect href="/dev/demo" />;
}
