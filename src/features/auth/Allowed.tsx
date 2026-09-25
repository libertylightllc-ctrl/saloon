import { Redirect, Stack } from 'expo-router';

import { can, type Capability } from '@/lib/permissions';

import { useWorkspace } from './session';

/** A stack of screens only some roles may open; anyone else lands on Home. */
export function AllowedStack({ cap }: { cap: Capability }) {
  const { role, rules } = useWorkspace();
  if (!can(role, cap, rules)) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
