import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useAppointments } from '@/features/queue/api';
import { QueueRow } from '@/features/queue/QueueRow';
import { useQueueHandlers } from '@/features/queue/useQueueHandlers';
import { AppointmentActions } from '@/features/queue/AppointmentActions';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { useNow } from '@/lib/useNow';
import { spacing, useTheme } from '@/theme';
import {
  CategoryCircle,
  EmptyState,
  HeaderBand,
  KpiCard,
  PromoBanner,
  QueryState,
  Screen,
  SectionHeader,
  type IconName,
} from '@/ui';

import { useDashboard, type Dashboard } from './api';
import { HomeTop } from './HomeHeader';
import { RecentActivity, RevenueCards, StaffToday, TopServices } from './HomeSections';

const SETUP_STEPS: { key: keyof NonNullable<Dashboard['setup']>; href: Href }[] = [
  { key: 'services', href: '/services' },
  { key: 'staff', href: '/settings/team' },
  { key: 'tax', href: '/settings/branch' },
  { key: 'opening_cash', href: '/settings/branch' },
];

export function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const now = useNow();
  const { business, branch, role, rules, employeeId } = useWorkspace();
  const dashboard = useDashboard(branch.id);
  const today = useAppointments(branch.id, business.timezone, 'today');
  const handlers = useQueueHandlers();
  const money = can(role, 'viewMoney');

  const appts = today.data ?? [];
  const active = appts.filter((a) => ['waiting', 'in_progress', 'booked'].includes(a.status));
  const mine = role === 'staff' ? active.filter((a) => !a.employee_id || a.employee_id === employeeId) : active;
  const subline = t('home.subline', {
    queue: appts.filter((a) => a.status === 'waiting' || a.status === 'in_progress').length,
    booked: appts.filter((a) => a.status === 'booked').length,
  });

  const quick: { key: string; icon: IconName; href: Href; show: boolean }[] = [
    { key: 'walkIn', icon: 'userPlus', href: { pathname: '/appointment/new', params: { kind: 'walk_in' } }, show: can(role, 'addToQueue') },
    { key: 'book', icon: 'calendarPlus', href: { pathname: '/appointment/new', params: { kind: 'booking' } }, show: can(role, 'addToQueue') },
    { key: 'newSale', icon: 'receipt', href: '/sale', show: can(role, 'sell', rules) },
    { key: 'customer', icon: 'contact', href: '/customers/form', show: can(role, 'manageCustomers') },
  ];
  const quickRow = (
    <View style={styles.circles}>
      {quick
        .filter((q) => q.show)
        .map((q, i) => (
          <CategoryCircle
            key={q.key}
            icon={q.icon}
            index={i}
            label={t(`home.quick.${q.key}` as 'home.quick.walkIn')}
            onPress={() => router.push(q.href)}
          />
        ))}
    </View>
  );

  const refresh = () => {
    void dashboard.refetch();
    void today.refetch();
  };

  return (
    <>
      <Screen
        insetBottom={false}
        background="gradient"
        overlapHeader={money}
        refreshing={dashboard.isRefetching}
        onRefresh={refresh}
        header={
          <HeaderBand top={<HomeTop subline={subline} />}>
            {theme.variants.homeTop === 'wordmark' ? quickRow : null}
          </HeaderBand>
        }
      >
        <QueryState query={dashboard} skeletonRows={4}>
          {(data) => (
            <View style={styles.sections}>
              {money ? <MoneyCards data={data} /> : null}
              {data.me ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kpiRow}>
                  <KpiCard icon="scissors" label={t('home.me.services')} value={String(Number(data.me.services_today))} />
                  <KpiCard icon="receipt" label={t('home.me.sales')} value={formatMoney(data.me.sales_today_minor)} />
                  <KpiCard icon="coins" label={t('home.me.commission')} value={formatMoney(data.me.commission_month_minor)} />
                </ScrollView>
              ) : null}
              {data.setup && !Object.values(data.setup).every(Boolean) ? (
                <PromoBanner
                  title={t('home.setup.title')}
                  body={t('home.setup.body', {
                    done: Object.values(data.setup).filter(Boolean).length,
                    total: SETUP_STEPS.length,
                    next: t(`home.setup.steps.${SETUP_STEPS.find((s) => !data.setup![s.key])!.key}`),
                  })}
                  actionLabel={t('home.setup.action')}
                  progress={{ done: Object.values(data.setup).filter(Boolean).length, total: SETUP_STEPS.length }}
                  illustration="promo-setup"
                  onAction={() => router.push(SETUP_STEPS.find((s) => !data.setup![s.key])!.href)}
                />
              ) : null}
              {theme.variants.homeTop === 'profile' ? (
                <View style={styles.block}>
                  <SectionHeader title={t('home.quickActions')} />
                  {quickRow}
                </View>
              ) : null}
              {can(role, 'addToQueue') ? (
                <View style={styles.block}>
                  <SectionHeader
                    title={t('home.todaysQueue')}
                    actionLabel={t('home.openQueue')}
                    onAction={() => router.push('/queue')}
                  />
                  {mine.length === 0 ? (
                    <EmptyState
                      illustration="queue-empty"
                      message={t('queue.empty')}
                      actionLabel={t('queue.addWalkIn')}
                      onAction={() => router.push({ pathname: '/appointment/new', params: { kind: 'walk_in' } })}
                    />
                  ) : (
                    mine.slice(0, 5).map((item) => (
                      <QueueRow
                        key={item.id}
                        item={item}
                        now={now}
                        timeZone={business.timezone}
                        compact
                        busy={handlers.busyId === item.id}
                        onAction={handlers.onAction}
                      />
                    ))
                  )}
                </View>
              ) : null}
              {money ? <RevenueCards data={data} /> : null}
              <StaffToday data={data} />
              <TopServices data={data} />
              <RecentActivity data={data} />
            </View>
          )}
        </QueryState>
      </Screen>
      <AppointmentActions item={handlers.menuFor} onClose={handlers.closeMenu} />
    </>
  );
}

function MoneyCards({ data }: { data: Dashboard }) {
  const { t } = useTranslation();
  const cash = data.expected_cash ?? 0;
  const yesterday = data.expected_cash_yesterday ?? 0;
  const change = yesterday > 0 ? Math.round(((cash - yesterday) / yesterday) * 100) : null;
  const a = data.appointments;
  return (
    <>
      <KpiCard
        hero
        icon="banknote"
        label={t('home.expectedCash')}
        value={formatMoney(cash)}
        delta={change !== null && change !== 0 ? { label: `${Math.abs(change)}%`, trend: change > 0 ? 'up' : 'down' } : undefined}
        sub={change !== null ? t('home.vsYesterday') : t('home.cashSub')}
        testID="kpi-expected-cash"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kpiRow}>
        <KpiCard
          icon="receipt"
          label={t('home.salesToday')}
          value={formatMoney(data.sales?.total_minor ?? 0)}
          sub={t('home.salesSub', { services: Number(data.sales?.services ?? 0), sales: data.sales?.count ?? 0 })}
          testID="kpi-sales"
        />
        {a ? (
          <KpiCard
            icon="calendar"
            label={t('home.appointmentsToday')}
            value={t('home.doneCount', { n: a.completed })}
            sub={t('home.appointmentsSub', { waiting: a.waiting + a.in_progress, booked: a.booked, noShow: a.no_show })}
          />
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  sections: { gap: spacing['2xl'] },
  block: { gap: spacing.md },
  circles: { flexDirection: 'row', justifyContent: 'space-around' },
  kpiRow: { gap: spacing.md, paddingVertical: spacing.xs, paddingHorizontal: 2 },
});
