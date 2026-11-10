import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { can } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import {
  Button,
  Card,
  HeaderBand,
  KpiCard,
  KpiGrid,
  ListRow,
  QueryState,
  Screen,
  SectionHeader,
  StatusPill,
  Text,
  type StatusKey,
} from '@/ui';

import { useClientCard } from './api';
import { Profile } from './Profile';
import { ServiceNotes } from './ServiceNotes';

/**
 * A stylist's own client (B2): name, phone when the owner allows, preferences and warnings, service notes (they add
 * them), their own visits and bookings with the client. Not the front desk's private notes or other stylists' visits.
 */
export function ClientCardScreen({ id }: { id: string }) {
  const { t } = useTranslation();
  const dates = useDates();
  const router = useRouter();
  const { business, branch, role, rules } = useWorkspace();
  const query = useClientCard(business.id, branch.id, id);
  const c = query.data?.customer;

  return (
    <Screen
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      header={
        <HeaderBand title={t('customers.profile')} onBack>
          {c ? <Profile name={c.name} phone={c.phone} /> : null}
        </HeaderBand>
      }
    >
      <QueryState query={query}>
        {({ customer, service_notes, visits, upcoming }) => (
          <View style={styles.body}>
            <KpiGrid>
              <KpiCard icon="users" label={t('customers.visits')} value={String(customer.visit_count)} testID="customer-visits" />
              <KpiCard
                icon="calendar"
                label={t('customers.lastVisit')}
                value={customer.last_visit_at ? dates.at(new Date(customer.last_visit_at), business.timezone, 'd MMM') : '—'}
              />
            </KpiGrid>
            {customer.risk_flags.length ? (
              <View style={styles.wrap}>
                {customer.risk_flags.map((f) => (
                  <StatusPill key={f} tone="warning" label={t(`customers.risk.${f}` as 'customers.risk.allergy')} />
                ))}
              </View>
            ) : null}
            {customer.preferences ? (
              <Card variant="outlined" style={styles.card}>
                <Text variant="small" color="textSecondary">
                  {t('customers.fields.preferences')}
                </Text>
                <Text>{customer.preferences}</Text>
              </Card>
            ) : null}
            <View style={styles.actions}>
              {can(role, 'book', rules) ? (
                <Button
                  label={t('customers.book')}
                  icon="calendarPlus"
                  variant="secondary"
                  size="md"
                  onPress={() =>
                    router.push({
                      pathname: '/appointment/new',
                      params: { kind: 'booking', customer: customer.id, customerName: customer.name },
                    })
                  }
                />
              ) : null}
              {can(role, 'sell', rules) ? (
                <Button
                  label={t('home.quick.newSale')}
                  icon="receipt"
                  size="md"
                  onPress={() => router.push({ pathname: '/sale', params: { customer: customer.id, customerName: customer.name } })}
                />
              ) : null}
            </View>
            <SectionHeader title={t('customers.upcomingWithYou')} />
            {upcoming.length === 0 ? (
              <Text color="textSecondary">{t('customers.noUpcoming')}</Text>
            ) : (
              upcoming.map((a) => (
                <ListRow
                  key={a.id}
                  title={dates.at(new Date(a.scheduled_at), business.timezone, 'EEE d MMM · HH:mm')}
                  trailing={<StatusPill status={a.status as StatusKey} />}
                />
              ))
            )}
            <ServiceNotes customerId={customer.id} notes={service_notes} canAdd={can(role, 'serviceNotes')} />
            <SectionHeader title={t('customers.visitsWithYou')} />
            {visits.length === 0 ? (
              <Text color="textSecondary">{t('customers.noVisits')}</Text>
            ) : (
              visits.map((v) => (
                <ListRow
                  key={v.id}
                  title={(v.services ?? []).join(' + ') || t('sales.number', { number: v.number })}
                  meta={[dates.at(new Date(v.created_at), business.timezone, 'd MMM yyyy · HH:mm')]}
                  badges={
                    v.status !== 'completed' ? (
                      <StatusPill status="reversed" label={t(`sales.status.${v.status}` as 'sales.status.completed')} />
                    ) : undefined
                  }
                />
              ))
            )}
          </View>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
});
