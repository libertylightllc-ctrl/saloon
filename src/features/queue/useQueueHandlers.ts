import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useWorkspace } from '@/features/auth/session';
import { errorCode } from '@/lib/errors';
import { useToast } from '@/ui';

import { useQueueAction, type Appointment } from './api';
import type { RowAction } from './actions';

/** Row buttons: check in / start run the RPC; complete opens Quick sale pre-filled. */
export function useQueueHandlers() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { branch } = useWorkspace();
  const action = useQueueAction(branch.id);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<Appointment | null>(null);

  const onAction = (item: Appointment, kind: RowAction) => {
    if (kind === 'complete') {
      router.push({ pathname: '/sale', params: { appointment: item.id } });
      return;
    }
    if (busyId) return;
    setBusyId(item.id);
    action.mutate(
      { action: kind, id: item.id },
      {
        onSuccess: () => toast(t(`queue.toast.${kind}`, { name: item.customer_name ?? t('queue.guest') })),
        onError: (error) => toast(t(`errors.${errorCode(error)}`), 'error'),
        onSettled: () => setBusyId(null),
      },
    );
  };

  /**
   * The visit the "…" menu is open for, as it is now: looked up by id in the latest list, so the menu follows changes
   * (marking a no-show turns its options into "Undo no-show") instead of keeping the copy it was opened with.
   */
  const menuItem = (latest: readonly Appointment[] | undefined) =>
    menuFor ? (latest?.find((a) => a.id === menuFor.id) ?? menuFor) : null;

  return { onAction, busyId, menuFor, menuItem, openMenu: setMenuFor, closeMenu: () => setMenuFor(null) };
}
