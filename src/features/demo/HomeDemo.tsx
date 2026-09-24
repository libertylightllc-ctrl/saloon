import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { brand } from '@/config/brand';
import { businessDate, formatDayLabel } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { spacing, useTheme } from '@/theme';
import {
  Avatar,
  Button,
  CategoryCircle,
  HeaderBand,
  IconButton,
  KpiCard,
  PromoBanner,
  Screen,
  SearchBar,
  SectionHeader,
  Text,
  useToast,
  type IconName,
} from '@/ui';

import {
  AttentionList,
  QueuePreview,
  RecentActivity,
  RevenueCards,
  StaffToday,
  TopServices,
} from './HomeSections';
import { partOfDay, useDemoBranch } from './useDemo';

const QUICK_ACTIONS: {
  key: 'walkIn' | 'book' | 'newSale' | 'expense' | 'stock';
  icon: IconName;
}[] = [
  { key: 'walkIn', icon: 'userPlus' },
  { key: 'book', icon: 'calendarPlus' },
  { key: 'newSale', icon: 'receipt' },
  { key: 'expense', icon: 'wallet' },
  { key: 'stock', icon: 'package' },
];

export function HomeDemo() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const demo = useDemoBranch();
  const { kpis } = demo;
  const profileTop = theme.variants.homeTop === 'profile';

  const greeting = t(`home.greeting.${partOfDay()}`, { name: demo.owner });
  const place = `${demo.branch} · ${formatDayLabel(businessDate())}`;
  const subline = t('home.subline', { queue: kpis.waiting + 2, approvals: 1 });

  const quickActions = (
    <View style={styles.circles}>
      {QUICK_ACTIONS.map((action, i) => (
        <CategoryCircle
          key={action.key}
          icon={action.icon}
          index={i}
          label={t(`home.quick.${action.key}`)}
          onPress={() =>
            action.key === 'newSale'
              ? router.push('/dev/demo/sale')
              : toast(t('dev.laterPhase'), 'info')
          }
        />
      ))}
    </View>
  );

  const bell = (
    <IconButton
      icon="bell"
      badge={3}
      accessibilityLabel={t('common.notifications')}
      variant={profileTop ? 'surface' : 'plain'}
    />
  );

  const top = profileTop ? (
    <View style={styles.profileTop}>
      <Avatar name={demo.owner} size={48} ring />
      <View style={styles.flex}>
        <Text variant="h4" color="onPrimary" numberOfLines={1}>
          {greeting}
        </Text>
        <Text variant="small" color="onPrimary" numberOfLines={1}>
          {place}
        </Text>
      </View>
      {bell}
    </View>
  ) : (
    <View style={styles.wordmarkTop}>
      <Text
        variant="h3"
        weight="bold"
        style={[styles.flex, { color: theme.colors.primary500 }]}
        numberOfLines={1}
      >
        {brand.appName.toLocaleUpperCase()}
      </Text>
      <IconButton icon="search" variant="plain" accessibilityLabel={t('common.search')} />
      {bell}
      <Avatar name={demo.owner} size={32} />
    </View>
  );

  return (
    <Screen
      insetBottom={false}
      background="gradient"
      overlapHeader
      header={
        <HeaderBand top={top}>
          {profileTop ? (
            <>
              <Text variant="small" color="onPrimary" align="center">
                {subline}
              </Text>
              <SearchBar
                placeholder={t('home.searchPlaceholder')}
                onFilter={() => toast(t('dev.laterPhase'), 'info')}
              />
            </>
          ) : (
            <>
              <View>
                <Text variant="h3">{greeting}</Text>
                <Text variant="small" color="textOnTint">
                  {place}
                </Text>
                <Text variant="small" color="textOnTint">
                  {subline}
                </Text>
              </View>
              {quickActions}
            </>
          )}
        </HeaderBand>
      }
    >
      <View style={styles.sections}>
        <KpiCard
          hero
          icon="banknote"
          label={t('home.expectedCash')}
          value={formatMoney(kpis.expectedCash)}
          delta={{ label: kpis.expectedDeltaPct, trend: 'up' }}
          sub={t('home.vsYesterday')}
          action={
            <Button
              label={t('home.closeDay')}
              size="sm"
              onPress={() => toast(t('dev.laterPhase'), 'info')}
            />
          }
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kpiRow}
        >
          <KpiCard
            icon="receipt"
            label={t('home.salesToday')}
            value={formatMoney(kpis.sales)}
            sub={t('home.salesSub', { services: kpis.servicesCount, sales: kpis.salesCount })}
          />
          <KpiCard
            icon="calendar"
            label={t('home.appointmentsToday')}
            value={t('home.doneCount', { n: kpis.done })}
            sub={t('home.appointmentsSub', { waiting: kpis.waiting, noShow: kpis.noShow })}
          />
          <KpiCard
            icon="wallet"
            label={t('home.moneyOut')}
            value={formatMoney(kpis.purchases + kpis.expenses)}
            sub={t('home.moneyOutSub', {
              purchases: formatMoney(kpis.purchases),
              expenses: formatMoney(kpis.expenses),
            })}
          />
        </ScrollView>
        <PromoBanner
          title={t('home.setup.title')}
          body={t('home.setup.body', { done: 4, total: 6 })}
          actionLabel={t('home.setup.action')}
          progress={{ done: 4, total: 6 }}
          illustration="promo-setup"
          onAction={() => toast(t('dev.laterPhase'), 'info')}
        />
        {profileTop ? (
          <View style={styles.block}>
            <SectionHeader title={t('home.quickActions')} />
            {quickActions}
          </View>
        ) : null}
        <AttentionList items={demo.attention} />
        <QueuePreview items={demo.queue} />
        <RevenueCards revenue={demo.revenue7d} mix={demo.paymentMix} />
        <StaffToday staff={demo.staff} />
        <TopServices services={demo.topServices} />
        <RecentActivity items={demo.activity} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  wordmarkTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.md,
  },
  circles: { flexDirection: 'row', justifyContent: 'space-between' },
  sections: { gap: spacing['2xl'] },
  block: { gap: spacing.md },
  kpiRow: { gap: spacing.md, paddingVertical: spacing.xs, paddingHorizontal: 2 },
});
