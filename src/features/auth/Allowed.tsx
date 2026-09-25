import { Redirect, Stack } from 'expo-router';
import type { ReactNode } from 'react';

import { can, type Capability } from '@/lib/permissions';

import { useWorkspace } from './session';

/** A screen only some roles may open; anyone else lands on Home. */
export function Allowed({ cap, children }: { cap: Capability; children: ReactNode }) {
  const { role, rules } = useWorkspace();
  if (!can(role, cap, rules)) return <Redirect href="/" />;
  return <>{children}</>;
}

/** A stack of screens only some roles may open; anyone else lands on Home. */
export function AllowedStack({ cap }: { cap: Capability }) {
  return (
    <Allowed cap={cap}>
      <Stack screenOptions={{ headerShown: false }} />
    </Allowed>
  );
}
