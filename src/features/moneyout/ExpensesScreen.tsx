import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { businessDate, businessMonth, shiftBusinessDate, shiftMonth, type MonthKey } from '@/lib/dates';
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
  MonthSwitcher,
  QueryState,
  Screen,
  SectionHeader,
  StatusPill,
  Text,
  Thumb,
} from '@/ui';

import { useExpenses, type Expense } from './api';
import { categoryIcon, useCategoryName } from './labels';

const monthRange = (month: MonthKey) => [`${month}-01`, shiftBusinessDate(`${shiftMonth(month, 1)}-01`, -1)] as const;
const posted = (rows: Expense[]) => rows.filter((e) => e.status === 'posted');

/** This month's expenses with today's and the month's totals; owner, accountant and (their own) cashier. */
export function ExpensesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dates = useDates();
  const name = useCategoryName();
  const { business, branch, role } = useWorkspace();
  const today = businessDate(new Date(), business.timezone);
  const [month, setMonth] = useState<MonthKey>(businessMonth(new Date(), business.timezone));
  const [from, to] = monthRange(month);
  const [prevFrom, prevTo] = monthRange(shiftMonth(month, -1));
  const list = useExpenses(branch.id, business.id, from, to);
  const previous = useExpenses(branch.id, business.id, prevFrom, prevTo);

  return (
    <Screen
      refreshing={list.isRefetching}
      onRefresh={() => void list.refetch()}
      header={
        <HeaderBand
          title={t('expenses.title')}
          onBack
          right={
            can(role, 'addExpense') ? (
              <Button label={t('common.new')} icon="plus" size="sm" variant="secondary" onPress={() => router.push('/expenses/new')} testID="expenses-new" />
            ) : undefined
          }
        />
      }
    >
      <MonthSwitcher value={month} onChange={setMonth} />
      <QueryState
        query={list}
        isEmpty={(rows) => rows.length === 0}
        empty={
          <EmptyState
            illustration="no-results"
            message={t('expenses.empty')}
            actionLabel={can(role, 'addExpense') ? t('expenses.add') : undefined}
            onAction={can(role, 'addExpense') ? () => router.push('/expenses/new') : undefined}
          />
        }
      >
        {(rows) => {
          const monthTotal = sum(posted(rows).map((e) => e.amount_minor));
          const todayTotal = sum(posted(rows).filter((e) => e.business_date === today).map((e) => e.amount_minor));
          const lastMonth = sum(posted(previous.data ?? []).map((e) => e.amount_minor));
          const byCategory = new Map<string, { label: string; total: number }>();
          for (const e of posted(rows)) {
            const prev = byCategory.get(e.category_id);
            byCategory.set(e.category_id, { label: name(e.expense_categories), total: (prev?.total ?? 0) + e.amount_minor });
          }
          const biggest = [...byCategory.values()].sort((a, b) => b.total - a.total)[0];
          const days = [...new Set(rows.map((e) => e.business_date))];
          return (
            <View style={styles.body}>
              <View style={styles.kpis}>
                <KpiCard icon="coins" label={t('expenses.today')} value={formatMoney(todayTotal)} testID="expenses-today" />
                <KpiCard
                  icon="calendar"
                  label={t('expenses.thisMonth')}
                  value={formatMoney(monthTotal)}
                  sub={t('expenses.lastMonth', { amount: formatMoney(lastMonth) })}
                  testID="expenses-month"
                />
              </View>
              {biggest ? (
                <Text color="textSecondary" testID="expenses-biggest">
                  {t('expenses.biggest', { category: biggest.label, amount: formatMoney(biggest.total) })}
                </Text>
              ) : null}
              {days.map((day) => (
                <View key={day} style={styles.group}>
                  <SectionHeader title={dates.day(day, 'EEE d MMM')} />
                  {rows
                    .filter((e) => e.business_date === day)
                    .map((e, i) => (
                      <ListRow
                        key={e.id}
                        testID={`expense-${e.expense_categories?.key ?? 'custom'}`}
                        leading={<Thumb icon={categoryIcon(e.expense_categories?.icon)} index={i} size={40} />}
                        title={name(e.expense_categories)}
                        meta={[
                          [t(`expenses.methods.${e.method}`), e.note, e.members?.display_name].filter(Boolean).join(' · '),
                        ]}
                        badges={e.status === 'reversed' ? <StatusPill status="reversed" /> : undefined}
                        trailing={
                          <Text variant="bodyStrong" tabular color={e.status === 'reversed' ? 'textSecondary' : 'text'}>
                            {formatMoney(e.amount_minor)}
                          </Text>
                        }
                        chevron
                        onPress={() => router.push({ pathname: '/expenses/[id]', params: { id: e.id } })}
                      />
                    ))}
                </View>
              ))}
            </View>
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  kpis: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  group: { gap: spacing.sm },
});
