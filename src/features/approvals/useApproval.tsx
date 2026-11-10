import { useCallback, useRef, useState } from 'react';

import type { Approved, ApprovalRequest } from './api';
import { ApprovalSheet } from './ApprovalSheet';

/**
 * Ask for a manager's or the owner's PIN from a screen: `await ask(request)` opens the sheet and gives the approval,
 * or null when the sheet is closed without one. Render `sheet` once in the screen.
 */
export function useApproval() {
  const [request, setRequest] = useState<ApprovalRequest | null>(null);
  const resolver = useRef<((approved: Approved | null) => void) | null>(null);
  const finish = useCallback((approved: Approved | null) => {
    resolver.current?.(approved);
    resolver.current = null;
    setRequest(null);
  }, []);
  const ask = useCallback(
    (next: ApprovalRequest) =>
      new Promise<Approved | null>((resolve) => {
        resolver.current?.(null);
        resolver.current = resolve;
        setRequest(next);
      }),
    [],
  );
  const sheet = <ApprovalSheet request={request} onApproved={(a) => finish(a)} onClose={() => finish(null)} />;
  return { ask, sheet };
}
