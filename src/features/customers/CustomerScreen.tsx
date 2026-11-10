import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney } from '@/lib/money';
import { can, levelOf } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import {
  Button,
  Card,
  EmptyState,
  HeaderBand,
  KpiCard,
  KpiGrid,
  ListRow,
  QueryState,
  Screen,
  SectionHeader,
  StatusPill,
  Text,
} from '@/ui';

import { useCustomer } from './api';
import { ClientCardScreen } from './ClientCardScreen';
import { Profile } from './Profile';
import { CustomerActions } from './CustomerActions';
import { ServiceNotes } from './ServiceNotes';

/** A customer's page: the book's view (owner, manager, front desk), or a stylist's card for their own client. */
export function CustomerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useWorkspace();
  return levelOf(role, 'viewCustomers') === 'own' ? <ClientCardScreen id={id} /> : <BookCustomerScreen id={id} />;
}

function BookCustomerScreen({ id }: { id: string }) {
  const { t } = useTranslation();
  const dates = useDates();
  const router = useRouter();
  const { business, role, rules } = useWorkspace();
  const query = useCustomer(business.id, id);
  const c = query.data?.customer;

  return (
    <Screen
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      header={
        <HeaderBand
          title={t('customers.profile')}
          onBack
          right={
            c && can(role, 'manageCustomers') ? (
              <Button
                label={t('common.edit')}
                size="sm"
                variant="secondary"
                onPress={() => router.push({ pathname: '/customers/form', params: { id: c.id } })}
                testID="customer-edit"
              />
            ) : undefined
          }
        >
          {c ? <Profile name={c.name} phone={c.phone} /> : null}
        </HeaderBand>
      }
    >
      <QueryState
        query={query}
        isEmpty={(d) => !d.customer}
        empty={<EmptyState illustration="no-results" message={t('errors.not_found')} />}
      >
        {({ customer: found, sales, upcoming, serviceNotes }) => {
          const customer = found!;
          return (
            <View style={styles.body}>
              <KpiGrid>
                <KpiCard icon="users" label={t('customers.visits')} value={String(customer.visit_count)} testID="customer-visits" />
                <KpiCard
                  icon="calendar"
                  label={t('customers.lastVisit')}
                  value={
                    customer.last_visit_at
                      ? dates.at(new Date(customer.last_visit_at), business.timezone, 'd MMM')
                      : '—'
                  }
                />
                <KpiCard icon="alert" label={t('customers.noShowsLabel')} value={String(customer.no_show_count)} testID="customer-no-shows" />
              </KpiGrid>
              {customer.risk_flags.length ? (
                <View style={styles.wrap}>
                  {customer.risk_flags.map((f) => (
                    <StatusPill key={f} tone="warning" label={t(`customers.risk.${f}` as 'customers.risk.allergy')} />
                  ))}
                </View>
              ) : null}
              {customer.preferences || customer.notes ? (
                <Card variant="outlined" style={styles.card}>
                  {customer.preferences ? (
                    <>
                      <Text variant="small" color="textSecondary">
                        {t('customers.fields.preferences')}
                      </Text>
                      <Text>{customer.preferences}</Text>
                    </>
                  ) : null}
                  {customer.notes ? (
                    <>
                      <Text variant="small" color="textSecondary">
                        {t('customers.fields.notes')}
                      </Text>
                      <Text>{customer.notes}</Text>
                    </>
                  ) : null}
                </Card>
              ) : null}
              <View style={styles.actions}>
                {can(role, 'addToQueue') ? (
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
              <SectionHeader title={t('customers.upcoming')} />
              {upcoming.length === 0 ? (
                <Text color="textSecondary">{t('customers.noUpcoming')}</Text>
              ) : (
                upcoming.map((a) => (
                  <ListRow
                    key={a.id}
                    title={a.appointment_services.map((s) => s.name_snapshot).join(' + ') || t('queue.noServices')}
                    meta={[dates.at(new Date(a.scheduled_at), business.timezone, 'EEE d MMM · HH:mm')]}
                    trailing={<StatusPill status={a.status} />}
                  />
                ))
              )}
              <SectionHeader title={t('customers.history')} />
              {sales.length === 0 ? (
                <Text color="textSecondary">{t('customers.noVisits')}</Text>
              ) : (
                sales.map((s) => (
                  <ListRow
                    key={s.id}
                    title={t('sales.number', { number: s.number })}
                    meta={[dates.at(new Date(s.created_at), business.timezone, 'd MMM yyyy · HH:mm')]}
                    trailing={<Text variant="bodyStrong" tabular>{formatMoney(s.total_minor)}</Text>}
                    chevron={can(role, 'viewSales')}
                    onPress={can(role, 'viewSales') ? () => router.push({ pathname: '/sales/[id]', params: { id: s.id } }) : undefined}
                  />
                ))
              )}
              <ServiceNotes customerId={customer.id} notes={serviceNotes} canAdd={can(role, 'serviceNotes')} />
              <CustomerActions customer={customer} />
            </View>
          );
        }}
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
