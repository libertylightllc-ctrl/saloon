import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { spacing } from '@/theme';
import { Button, KpiCard, KpiGrid } from '@/ui';

import type { Dashboard } from './api';

/**
 * Expected cash (the hero card), sales, the day's visits and money out. Phones: the hero card over the others two to a
 * row (money out, the longest line, gets a row of its own). `row` (wider screens): the four side by side.
 */
export function MoneyCards({ data, row }: { data: Dashboard; row?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { role } = useWorkspace();
  const closed = data.closing?.today_status;
  const cash = data.expected_cash ?? 0;
  const yesterday = data.expected_cash_yesterday ?? 0;
  const change = yesterday > 0 ? Math.round(((cash - yesterday) / yesterday) * 100) : null;
  const a = data.appointments;
  // Side by side, every card fills its cell so the row's bottoms line up.
  const fill = row ? styles.fill : undefined;

  const hero = (
    <KpiCard
      hero
      style={fill}
      icon="banknote"
      label={t('home.expectedCash')}
      value={formatMoney(cash)}
      delta={change !== null && change !== 0 ? { label: `${Math.abs(change)}%`, trend: change > 0 ? 'up' : 'down' } : undefined}
      sub={
        closed === 'approved'
          ? t('home.dayClosed')
          : closed === 'pending_approval'
            ? t('home.dayPending')
            : change !== null
              ? t('home.vsYesterday')
              : t('home.cashSub')
      }
      action={
        can(role, 'viewClosing') ? (
          <Button
            label={t(can(role, 'countCash') ? 'home.closeDay' : 'home.viewClosing')}
            size="sm"
            variant={closed === 'approved' ? 'ghost' : 'secondary'}
            icon="banknote"
            onPress={() => router.push('/cash-closing')}
            testID="home-close-day"
          />
        ) : undefined
      }
      testID="kpi-expected-cash"
    />
  );
  const others: ReactNode[] = [
    <KpiCard
      key="sales"
      style={fill}
      icon="receipt"
      label={t('home.salesToday')}
      value={formatMoney(data.sales?.total_minor ?? 0)}
      sub={t('home.salesSub', { services: Number(data.sales?.services ?? 0), sales: data.sales?.count ?? 0 })}
      testID="kpi-sales"
    />,
    a ? (
      <KpiCard
        key="visits"
        style={fill}
        icon="calendar"
        label={t('home.appointmentsToday')}
        value={t('home.doneCount', { n: a.completed })}
        sub={t('home.appointmentsSub', { waiting: a.waiting + a.in_progress, booked: a.booked, noShow: a.no_show })}
      />
    ) : null,
    data.money_out ? (
      <KpiCard
        key="out"
        style={fill}
        icon="coins"
        label={t('home.moneyOut')}
        value={formatMoney(data.money_out.expenses_minor + data.money_out.supplier_payments_minor)}
        sub={t('home.moneyOutSub', {
          purchases: formatMoney(data.money_out.supplier_payments_minor),
          expenses: formatMoney(data.money_out.expenses_minor),
        })}
        testID="kpi-money-out"
      />
    ) : null,
  ].filter(Boolean);

  if (row) {
    return (
      <View style={styles.row}>
        <View style={[styles.cell, styles.heroCell]}>{hero}</View>
        {others.map((card, i) => (
          <View key={i} style={styles.cell}>
            {card}
          </View>
        ))}
      </View>
    );
  }
  return (
    <>
      {hero}
      <KpiGrid>{others}</KpiGrid>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  cell: { flexGrow: 1, flexBasis: 220 },
  heroCell: { flexGrow: 1.5, flexBasis: 300 },
  fill: { flexGrow: 1 },
});
