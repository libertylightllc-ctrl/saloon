import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

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
  KpiGrid,
  PromoBanner,
  QueryState,
  Screen,
  SectionHeader,
  useTwoPane,
  useWide,
  type IconName,
} from '@/ui';

import { useDashboard, type Dashboard } from './api';
import { HomeTop } from './HomeHeader';
import { RecentActivity, RevenueCards, StaffToday, TopServices } from './HomeSections';
import { PlanBanner } from '@/features/plan/PlanBanner';

import { MoneyCards } from './MoneyCards';
import { NeedsAttention } from './NeedsAttention';
import { ClockCard } from '@/features/staff/ClockCard';

const SETUP_STEPS: { key: keyof NonNullable<Dashboard['setup']>; href: Href }[] = [
  { key: 'services', href: '/services' },
  { key: 'staff', href: '/staff' },
  { key: 'tax', href: '/settings/branch' },
  { key: 'opening_cash', href: '/settings/branch' },
  { key: 'opening_stock', href: '/inventory/opening' },
  { key: 'suppliers', href: { pathname: '/purchases', params: { tab: 'suppliers' } } },
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
  const wide = useWide();
  // Two columns once there is room for them (most tablets in landscape, every computer).
  const columns = useTwoPane();

  const appts = today.data ?? [];
  const active = appts.filter((a) => ['waiting', 'in_progress', 'booked'].includes(a.status));
  const mine = role === 'staff' ? active.filter((a) => !a.employee_id || a.employee_id === employeeId) : active;
  const subline = t('home.subline', {
    queue: appts.filter((a) => a.status === 'waiting' || a.status === 'in_progress').length,
    booked: appts.filter((a) => a.status === 'booked').length,
  });

  const quick: { key: string; icon: IconName; href: Href; show: boolean }[] = [
    { key: 'walkIn', icon: 'userPlus', href: { pathname: '/appointment/new', params: { kind: 'walk_in' } }, show: can(role, 'addToQueue') },
    { key: 'book', icon: 'calendarPlus', href: { pathname: '/appointment/new', params: { kind: 'booking' } }, show: can(role, 'book') },
    { key: 'newSale', icon: 'receipt', href: '/sale', show: can(role, 'sell', rules) },
    { key: 'customer', icon: 'contact', href: '/customers/form', show: can(role, 'manageCustomers') },
    { key: 'expense', icon: 'coins', href: '/expenses/new', show: can(role, 'addExpense') },
    { key: 'stock', icon: 'boxes', href: '/inventory', show: can(role, 'viewInventory') && role !== 'staff' },
  ];
  const shown = quick.filter((q) => q.show);
  // A grid, never a sliding or cut-off row: up to four across a phone, otherwise three to a row (always three in the
  // narrow side column of wider screens).
  const perRow = !wide && shown.length <= 4 ? shown.length : 3;
  const quickRow = (
    <View style={styles.circleGrid}>
      {shown.map((q, i) => (
        <View key={q.key} style={[styles.circleCell, { width: `${100 / perRow}%` }]}>
          <CategoryCircle
            icon={q.icon}
            index={i}
            label={t(`home.quick.${q.key}` as 'home.quick.walkIn')}
            onPress={() => router.push(q.href)}
          />
        </View>
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
        width="full"
        overlapHeader={money}
        refreshing={dashboard.isRefetching}
        onRefresh={refresh}
        header={
          <HeaderBand top={<HomeTop subline={subline} />}>
            {theme.variants.homeTop === 'wordmark' && !wide ? quickRow : null}
          </HeaderBand>
        }
      >
        <QueryState query={dashboard} skeletonRows={4}>
          {(data) => {
            const setup = data.setup && !Object.values(data.setup).every(Boolean) ? (
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
            ) : null;
            const mine_ = data.me ? (
              <KpiGrid>
                <KpiCard icon="scissors" label={t('home.me.services')} value={String(Number(data.me.services_today))} />
                <KpiCard icon="receipt" label={t('home.me.sales')} value={formatMoney(data.me.sales_today_minor)} />
                <KpiCard icon="coins" label={t('home.me.commission')} value={formatMoney(data.me.commission_month_minor)} />
              </KpiGrid>
            ) : null;
            const clock = role === 'staff' || role === 'cashier' ? <ClockCard /> : null;
            const quickBlock =
              theme.variants.homeTop === 'profile' || wide ? (
                <View style={styles.block}>
                  <SectionHeader title={t('home.quickActions')} />
                  {quickRow}
                </View>
              ) : null;
            const queueBlock = can(role, 'addToQueue') ? (
              <View style={styles.block}>
                <SectionHeader title={t('home.todaysQueue')} actionLabel={t('home.openQueue')} onAction={() => router.push('/queue')} />
                {mine.length === 0 ? (
                  <EmptyState
                    illustration="queue-empty"
                    message={t('queue.empty')}
                    actionLabel={t('queue.addWalkIn')}
                    onAction={() => router.push({ pathname: '/appointment/new', params: { kind: 'walk_in' } })}
                  />
                ) : (
                  mine.slice(0, columns ? 8 : 5).map((item) => (
                    <QueueRow
                      key={item.id}
                      item={item}
                      now={now}
                      timeZone={business.timezone}
                      compact
                      busy={handlers.busyId === item.id}
                      onAction={handlers.onAction}
                      canSell={can(role, 'sell', rules)}
                    />
                  ))
                )}
              </View>
            ) : null;

            if (columns) {
              // Computer / tablet dashboard (Option A): numbers across the top, the day on the left, what needs
              // doing on the right.
              return (
                <View style={styles.sections}>
                  <PlanBanner />
                  {money ? <MoneyCards data={data} row /> : null}
                  {mine_}
                  {setup}
                  <View style={styles.columns}>
                    <View style={styles.mainColumn}>
                      {queueBlock}
                      {money ? <RevenueCards data={data} /> : null}
                      <TopServices data={data} />
                    </View>
                    <View style={styles.sideColumn}>
                      {clock}
                      <NeedsAttention data={data} />
                      {quickBlock}
                      <StaffToday data={data} />
                      <RecentActivity data={data} />
                    </View>
                  </View>
                </View>
              );
            }
            return (
              <View style={styles.sections}>
                <PlanBanner />
                {money ? <MoneyCards data={data} /> : null}
                {mine_}
                {setup}
                {clock}
                <NeedsAttention data={data} />
                {quickBlock}
                {queueBlock}
                {money ? <RevenueCards data={data} /> : null}
                <StaffToday data={data} />
                <TopServices data={data} />
                <RecentActivity data={data} />
              </View>
            );
          }}
        </QueryState>
      </Screen>
      <AppointmentActions item={handlers.menuItem(today.data)} onClose={handlers.closeMenu} />
    </>
  );
}

const styles = StyleSheet.create({
  sections: { gap: spacing['2xl'] },
  block: { gap: spacing.md },
  circleGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.lg },
  circleCell: { alignItems: 'center' },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing['2xl'] },
  mainColumn: { flex: 2, minWidth: 0, gap: spacing['2xl'] },
  sideColumn: { flex: 1, minWidth: 0, gap: spacing['2xl'] },
});
