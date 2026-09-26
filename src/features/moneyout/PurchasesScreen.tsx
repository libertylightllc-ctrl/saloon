import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { businessDate, businessMonth } from '@/lib/dates';
import { formatMoney, sum } from '@/lib/money';
import { can } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import {
  Button,
  EmptyState,
  HeaderBand,
  KpiCard,
  ListRow,
  QueryState,
  Screen,
  SegmentTabs,
  StatusPill,
  Text,
  type StatusKey,
} from '@/ui';

import { useBills, useSuppliers, type Bill, type Supplier } from './api';
import { SupplierSheet } from './SupplierSheet';

type Tab = 'bills' | 'suppliers';

export const BILL_STATUS: Record<Bill['status'], StatusKey> = {
  unpaid: 'due_soon',
  partial: 'pending_approval',
  paid: 'paid',
  reversed: 'reversed',
};

/** Supplier bills and who is owed what. Cashiers see the bills they added and the supplier names. */
export function PurchasesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dates = useDates();
  const { business, role } = useWorkspace();
  const owner = can(role, 'payOrReverseMoneyOut');
  const seesBalances = role === 'owner' || role === 'accountant';
  const [tab, setTab] = useState<Tab>('bills');
  const bills = useBills(business.id);
  const suppliers = useSuppliers(business.id, seesBalances);
  const [editing, setEditing] = useState<Supplier | null | undefined>(undefined);
  const month = businessMonth(new Date(), business.timezone);
  const today = businessDate(new Date(), business.timezone);

  return (
    <>
      <Screen
        refreshing={bills.isRefetching}
        onRefresh={() => {
          void bills.refetch();
          void suppliers.refetch();
        }}
        header={
          <HeaderBand
            title={t('purchases.title')}
            onBack
            right={
              can(role, 'addPurchase') ? (
                <Button
                  label={t('purchases.newBill')}
                  icon="plus"
                  size="sm"
                  variant="secondary"
                  onPress={() => router.push('/purchases/new')}
                  testID="bills-new"
                />
              ) : undefined
            }
          >
            <SegmentTabs<Tab>
              items={[
                { key: 'bills', label: t('purchases.bills') },
                { key: 'suppliers', label: t('purchases.suppliers') },
              ]}
              value={tab}
              onChange={setTab}
              testID="purchases-tab"
            />
          </HeaderBand>
        }
      >
        {seesBalances && suppliers.data && bills.data ? (
          <View style={styles.kpis}>
            <KpiCard
              icon="wallet"
              label={t('purchases.owed')}
              value={formatMoney(sum(suppliers.data.map((s) => s.balance_minor ?? 0)))}
              testID="purchases-owed"
            />
            <KpiCard
              icon="alert"
              label={t('purchases.overdue')}
              value={formatMoney(sum(suppliers.data.map((s) => s.overdue_minor ?? 0)))}
              testID="purchases-overdue"
            />
            <KpiCard
              icon="package"
              label={t('purchases.thisMonth')}
              value={formatMoney(
                sum(
                  bills.data
                    .filter((b) => b.status !== 'reversed' && b.bill_date.startsWith(month))
                    .map((b) => b.total_minor),
                ),
              )}
              testID="purchases-month"
            />
          </View>
        ) : null}
        {tab === 'bills' ? (
          <QueryState
            query={bills}
            isEmpty={(rows) => rows.length === 0}
            empty={<EmptyState illustration="no-results" message={t('purchases.noBills')} />}
          >
            {(rows) => (
              <View style={styles.list}>
                {rows.map((b) => (
                  <ListRow
                    key={b.id}
                    testID={`bill-${b.number}`}
                    title={`${t('purchases.billNumber', { number: b.number })} · ${b.suppliers?.name ?? ''}`}
                    meta={[
                      [dates.day(b.bill_date, 'd MMM'), b.invoice_ref].filter(Boolean).join(' · '),
                      ...(b.status === 'unpaid' || b.status === 'partial'
                        ? [
                            {
                              text: t(
                                b.due_date < today ? 'purchases.overdueSince' : 'purchases.dueOn',
                                { date: dates.day(b.due_date, 'd MMM') },
                              ),
                              tone: b.due_date < today ? ('primary' as const) : undefined,
                            },
                          ]
                        : []),
                    ]}
                    badges={
                      <StatusPill
                        status={BILL_STATUS[b.status]}
                        label={t(`purchases.status.${b.status}`)}
                      />
                    }
                    trailing={
                      <Text variant="bodyStrong" tabular>
                        {formatMoney(b.total_minor)}
                      </Text>
                    }
                    chevron
                    onPress={() =>
                      router.push({ pathname: '/purchases/[id]', params: { id: b.id } })
                    }
                  />
                ))}
              </View>
            )}
          </QueryState>
        ) : (
          <View style={styles.list}>
            {can(role, 'addPurchase') ? (
              <Button
                label={t('purchases.newSupplier')}
                icon="plus"
                variant="ghost"
                size="md"
                onPress={() => setEditing(null)}
                testID="supplier-new"
              />
            ) : null}
            <QueryState
              query={suppliers}
              isEmpty={(rows) => rows.length === 0}
              empty={<EmptyState illustration="no-results" message={t('purchases.noSuppliers')} />}
            >
              {(rows) => (
                <View style={styles.list}>
                  {rows.map((s) => (
                    <ListRow
                      key={s.id}
                      testID={`supplier-${s.name}`}
                      title={s.name}
                      meta={[
                        [s.phone, t('purchases.termsDays', { n: s.terms_days })]
                          .filter(Boolean)
                          .join(' · '),
                      ]}
                      trailing={
                        seesBalances ? (
                          <View style={styles.balance}>
                            <Text variant="bodyStrong" tabular>
                              {formatMoney(s.balance_minor ?? 0)}
                            </Text>
                            {s.overdue_minor ? <StatusPill status="overdue" /> : null}
                          </View>
                        ) : undefined
                      }
                      chevron={owner}
                      onPress={owner ? () => setEditing(s) : undefined}
                    />
                  ))}
                </View>
              )}
            </QueryState>
          </View>
        )}
      </Screen>
      <SupplierSheet
        supplier={editing}
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  kpis: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.lg },
  list: { gap: spacing.sm },
  balance: { alignItems: 'flex-end', gap: 4 },
});
