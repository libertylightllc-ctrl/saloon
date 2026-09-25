import { formatInTimeZone } from 'date-fns-tz';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney } from '@/lib/money';
import { DirectionView, spacing, useTheme } from '@/theme';
import { Avatar, Card, ListRow, SectionHeader, StatusPill, Text } from '@/ui';

import type { Dashboard } from './api';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function RevenueCards({ data }: { data: Dashboard }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const days = data.revenue_7d ?? [];
  const max = Math.max(1, ...days.map((d) => d.total_minor));
  const total = days.reduce((a, d) => a + d.total_minor, 0);
  const mix = data.payment_mix ?? { cash: 0, card: 0, wallet: 0, deposits: 0 };
  const mixTotal = mix.cash + mix.card + mix.wallet + mix.deposits;
  const segments = [
    { key: 'cash', value: mix.cash, colour: theme.colors.primary500 },
    { key: 'card', value: mix.card, colour: theme.colors.primary300 },
    { key: 'wallet', value: mix.wallet, colour: theme.colors.accent },
    { key: 'deposits', value: mix.deposits, colour: theme.colors.neutral.n50 },
  ] as const;

  return (
    <View style={styles.block}>
      <Card variant="outlined" style={styles.cardGap}>
        <Text variant="small" color="textSecondary">
          {t('home.revenue7d')}
        </Text>
        <Text variant="h3" weight="bold" tabular>
          {formatMoney(total)}
        </Text>
        {/* Charts stay left-to-right in RTL (02-DESIGN-SYSTEM §5). */}
        <DirectionView direction="ltr" style={styles.bars}>
          {days.map((d, i) => {
            const weekday = DAY_KEYS[new Date(`${d.date}T12:00:00Z`).getUTCDay()]!;
            return (
              <View key={d.date} style={styles.barCol} accessibilityLabel={`${t(`common.days.${weekday}`)} ${formatMoney(d.total_minor)}`}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(4, Math.round((d.total_minor / max) * 96)),
                      borderRadius: theme.radius.sm,
                      backgroundColor: i === days.length - 1 ? theme.colors.primary500 : theme.colors.primary100,
                    },
                  ]}
                />
                <Text variant="micro" color="textSecondary" align="center">
                  {t(`common.days.${weekday}`)}
                </Text>
              </View>
            );
          })}
        </DirectionView>
      </Card>
      <Card variant="outlined" style={styles.cardGap}>
        <Text variant="small" color="textSecondary">
          {t('home.paymentMix')}
        </Text>
        {mixTotal > 0 ? (
          <DirectionView direction="ltr" style={[styles.stack, { borderRadius: theme.radius.pill }]}>
            {segments.map((s) => (s.value > 0 ? <View key={s.key} style={{ flex: s.value, backgroundColor: s.colour }} /> : null))}
          </DirectionView>
        ) : (
          <Text variant="small" color="textSecondary">
            {t('home.noSalesYet')}
          </Text>
        )}
        <View style={styles.legend}>
          {segments.map((s) => (
            <View key={s.key} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: s.colour }]} />
              <Text variant="small" color="textSecondary">
                {t(`home.mix.${s.key}`)}
              </Text>
              <Text variant="small" weight="semibold" tabular>
                {formatMoney(s.value)}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

export function StaffToday({ data }: { data: Dashboard }) {
  const { t } = useTranslation();
  const staff = data.staff_today ?? [];
  if (staff.length === 0) return null;
  return (
    <View style={styles.block}>
      <SectionHeader title={t('home.staffToday')} />
      {staff.map((person) => (
        <ListRow
          key={person.employee_id}
          title={person.name}
          leading={<Avatar name={person.name} color={person.colour ?? undefined} size={44} />}
          meta={[t('home.staffLine', { services: Number(person.services), sales: formatMoney(person.sales_minor) })]}
          trailing={
            <>
              <Text variant="bodyStrong" weight="semibold" tabular>
                {formatMoney(person.commission_minor)}
              </Text>
              <StatusPill
                tone={person.busy ? 'info' : 'success'}
                label={t(person.busy ? 'home.staffState.with_client' : 'home.staffState.available')}
              />
            </>
          }
        />
      ))}
    </View>
  );
}

export function TopServices({ data }: { data: Dashboard }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const services = data.top_services ?? [];
  if (services.length === 0) return null;
  const max = Math.max(...services.map((s) => s.revenue_minor));
  return (
    <View style={styles.block}>
      <SectionHeader title={t('home.topServices')} />
      <Card variant="outlined" style={styles.cardGap}>
        {services.map((s, i) => (
          <View key={s.name} style={styles.topRow}>
            <View style={styles.topLine}>
              <Text variant="bodyStrong" style={styles.flex}>{`${i + 1}. ${s.name}`}</Text>
              <Text variant="small" color="textSecondary" tabular>
                {t('home.timesCount', { n: Number(s.count) })}
              </Text>
              <Text variant="bodyStrong" weight="semibold" tabular>
                {formatMoney(s.revenue_minor)}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: theme.colors.primary50 }]}>
              <View
                style={{
                  width: `${Math.round((s.revenue_minor / max) * 100)}%`,
                  backgroundColor: theme.colors.primary400,
                  borderRadius: 3,
                }}
              />
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

export function RecentActivity({ data }: { data: Dashboard }) {
  const { t } = useTranslation();
  const { business } = useWorkspace();
  const items = data.activity ?? [];
  if (items.length === 0) return null;
  return (
    <View style={styles.block}>
      <SectionHeader title={t('home.recentActivity')} />
      {items.map((item, i) => (
        <View key={`${item.at}-${i}`} style={styles.activity}>
          <Avatar name={item.actor ?? '—'} size={32} />
          <Text variant="small" style={styles.flex}>
            {item.actor ? `${item.actor}: ${item.summary}` : item.summary}
          </Text>
          <Text variant="small" color="textSecondary" tabular>
            {formatInTimeZone(new Date(item.at), business.timezone, 'HH:mm')}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  flex: { flex: 1 },
  cardGap: { gap: spacing.sm },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: 124, marginTop: spacing.sm },
  barCol: { flex: 1, alignItems: 'center', gap: spacing.xs },
  bar: { alignSelf: 'stretch' },
  stack: { height: 12, flexDirection: 'row', overflow: 'hidden', marginVertical: spacing.sm },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  topRow: { gap: spacing.xs, paddingVertical: spacing.xs },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  track: { height: 6, borderRadius: 3, flexDirection: 'row', overflow: 'hidden' },
  activity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
