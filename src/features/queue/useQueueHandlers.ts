import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useWorkspace } from '@/features/auth/session';
import { errorCode } from '@/lib/errors';
import { useToast } from '@/ui';

import { useQueueAction, type Appointment } from './api';
import type { RowAction } from './QueueRow';

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

  return { onAction, busyId, menuFor, openMenu: setMenuFor, closeMenu: () => setMenuFor(null) };
}
