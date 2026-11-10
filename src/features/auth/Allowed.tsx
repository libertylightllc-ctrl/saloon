import { Stack } from 'expo-router';
import type { ReactNode } from 'react';

import { can, type Capability } from '@/lib/permissions';

import { NoAccess } from './NoAccess';
import { useWorkspace } from './session';

/** A screen only some logins may open (any one of `cap` is enough); anyone else is told they have no access. */
export function Allowed({ cap, children }: { cap: Capability | Capability[]; children: ReactNode }) {
  const { role, rules } = useWorkspace();
  const caps = Array.isArray(cap) ? cap : [cap];
  if (!caps.some((c) => can(role, c, rules))) return <NoAccess />;
  return <>{children}</>;
}

/** A stack of screens only some logins may open; anyone else is told they have no access. */
export function AllowedStack({ cap }: { cap: Capability | Capability[] }) {
  return (
    <Allowed cap={cap}>
      <Stack screenOptions={{ headerShown: false }} />
    </Allowed>
  );
}
