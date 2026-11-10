import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { can } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { Button, EmptyState, HeaderBand, ListRow, QueryState, Screen, SectionHeader, StatusPill } from '@/ui';

import { supplierOf, useDeliveries, type Delivery } from './api';
import { deliveryPill } from './labels';

/**
 * Deliveries in this branch: waiting for prices first (oldest first), then the last 30 days. The front desk records
 * them ("Receive a delivery"); the owner, a manager or the accountant opens a waiting one to add the prices.
 */
export function DeliveriesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dates = useDates();
  const { business, branch, role } = useWorkspace();
  const query = useDeliveries(branch.id);

  const row = (d: Delivery) => (
    <ListRow
      key={d.id}
      testID={`delivery-${d.number}`}
      title={[t('deliveries.number', { number: d.number }), supplierOf(d)].filter(Boolean).join(' · ')}
      meta={[
        t('deliveries.rowMeta', {
          count: d.delivery_lines.length,
          name: d.received_name,
          when: dates.at(new Date(d.received_at), business.timezone, 'EEE d MMM · HH:mm'),
        }),
      ]}
      badges={<StatusPill {...deliveryPill(d.status, t)} />}
      chevron
      onPress={() => router.push({ pathname: '/deliveries/[id]', params: { id: d.id } })}
    />
  );

  return (
    <Screen
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      header={
        <HeaderBand
          title={t('deliveries.title')}
          subtitle={t('deliveries.subtitle')}
          onBack
          right={
            can(role, 'receiveDelivery') ? (
              <Button label={t('deliveries.receiveShort')} icon="plus" size="sm" variant="secondary" onPress={() => router.push('/deliveries/new')} testID="deliveries-receive" />
            ) : undefined
          }
        />
      }
    >
      <QueryState query={query}>
        {(rows) => {
          const waiting = rows.filter((d) => d.status === 'waiting');
          const rest = rows.filter((d) => d.status !== 'waiting');
          if (rows.length === 0) return <EmptyState illustration="no-results" message={t('deliveries.empty')} />;
          return (
            <View style={styles.body}>
              {waiting.length ? (
                <View style={styles.block}>
                  <SectionHeader title={t('deliveries.waiting', { count: waiting.length })} />
                  {waiting.map(row)}
                </View>
              ) : null}
              {rest.length ? (
                <View style={styles.block}>
                  <SectionHeader title={t('deliveries.recent')} />
                  {rest.map(row)}
                </View>
              ) : null}
            </View>
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  block: { gap: spacing.sm },
});
