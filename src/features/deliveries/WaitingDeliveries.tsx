import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useWorkspace } from '@/features/auth/session';
import { can } from '@/lib/permissions';
import { ListRow, StatusPill } from '@/ui';

import { useDeliveries } from './api';

/** For those who price deliveries (owner, manager, accountant): "Deliveries waiting for prices: 2", to the list. */
export function WaitingDeliveries() {
  const { t } = useTranslation();
  const router = useRouter();
  const { branch, role } = useWorkspace();
  const pricer = can(role, 'priceDelivery');
  const query = useDeliveries(branch.id, pricer);
  const waiting = (query.data ?? []).filter((d) => d.status === 'waiting').length;
  if (!pricer || waiting === 0) return null;
  return (
    <ListRow
      title={t('deliveries.waitingPrices', { count: waiting })}
      meta={[t('deliveries.waitingPricesSub')]}
      badges={<StatusPill status="waiting" label={t('deliveries.status.waiting')} />}
      chevron
      onPress={() => router.push('/deliveries')}
      testID="deliveries-waiting"
    />
  );
}
