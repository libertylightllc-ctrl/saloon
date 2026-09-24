import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { formatMoney, type Minor } from '@/lib/money';
import { DirectionView, semantic, spacing, useTheme } from '@/theme';
import {
  Avatar,
  Button,
  Card,
  Icon,
  ListRow,
  SectionHeader,
  StatusPill,
  Text,
  useToast,
} from '@/ui';

import type { DemoAttention, DemoBranch, DemoQueueItem, DemoStaff } from './data';
import { QueueRow } from './QueueRow';

export function AttentionList({ items }: { items: DemoAttention[] }) {
  const { t } = useTranslation();
  const toast = useToast();
  return (
    <View style={styles.block}>
      <SectionHeader title={t('home.needsAttention')} />
      {items.map((item) => {
        const tone = semantic[item.tone];
        return (
          <ListRow
            key={item.title}
            title={item.title}
            meta={[item.detail]}
            leading={
              <View style={[styles.toneIcon, { backgroundColor: tone.surface }]}>
                <Icon name={item.icon} size={20} color={tone.pressed} />
              </View>
            }
            trailing={
              <Button
                label={t(`home.attentionActions.${item.action}`)}
                size="sm"
                variant="row"
                onPress={() => toast(t('dev.laterPhase'), 'info')}
              />
            }
          />
        );
      })}
    </View>
  );
}

export function QueuePreview({ items }: { items: DemoQueueItem[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const next = items.filter((i) => i.status !== 'completed' && i.status !== 'no_show').slice(0, 3);
  return (
    <View style={styles.block}>
      <SectionHeader
        title={t('home.todaysQueue')}
        actionLabel={t('home.openQueue')}
        onAction={() => router.push('/dev/demo/queue')}
      />
      {next.map((item) => (
        <QueueRow
          key={item.id}
          item={item}
          compact
          onAction={() => toast(t('dev.demoOnly'), 'info')}
        />
      ))}
    </View>
  );
}

const DAY_KEYS = ['wed', 'thu', 'fri', 'sat', 'sun', 'mon', 'tue'] as const;

export function RevenueCards({
  revenue,
  mix,
}: {
  revenue: Minor[];
  mix: DemoBranch['paymentMix'];
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const max = Math.max(...revenue);
  const total = revenue.reduce((a, b) => a + b, 0);
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
          {DAY_KEYS.map((day, i) => {
            const value = revenue[i] ?? 0;
            return (
              <View key={day} style={styles.barCol}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(6, Math.round((value / max) * 96)),
                      borderRadius: theme.radius.sm,
                      backgroundColor:
                        i === revenue.length - 1
                          ? theme.colors.primary500
                          : theme.colors.primary100,
                    },
                  ]}
                />
                <Text variant="micro" color="textSecondary" align="center">
                  {t(`common.days.${day}`)}
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
        <DirectionView direction="ltr" style={[styles.stack, { borderRadius: theme.radius.pill }]}>
          {segments.map((s) =>
            s.value > 0 ? (
              <View key={s.key} style={{ flex: s.value, backgroundColor: s.colour }} />
            ) : null,
          )}
        </DirectionView>
        <View style={styles.legend}>
          {segments.map((s) => (
            <View key={s.key} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: s.colour }]} />
              <Text variant="small" color="textSecondary">
                {t(`home.mix.${s.key}`)}
              </Text>
              <Text variant="small" weight="semibold" tabular>{`${s.value}%`}</Text>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

export function StaffToday({ staff }: { staff: DemoStaff[] }) {
  const { t } = useTranslation();
  const TONE = { with_client: 'info', on_shift: 'success', off: 'neutral' } as const;
  return (
    <View style={styles.block}>
      <SectionHeader title={t('home.staffToday')} />
      {staff.map((person) => (
        <ListRow
          key={person.id}
          title={person.name}
          leading={<Avatar name={person.name} color={person.colour} size={44} />}
          meta={[
            t('home.staffLine', {
              services: person.services,
              sales: formatMoney(person.salesMinor),
            }),
          ]}
          trailing={
            <>
              <Text variant="bodyStrong" weight="semibold" tabular>
                {formatMoney(person.commissionMinor)}
              </Text>
              <StatusPill tone={TONE[person.state]} label={t(`home.staffState.${person.state}`)} />
            </>
          }
        />
      ))}
    </View>
  );
}

export function TopServices({ services }: { services: DemoBranch['topServices'] }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const max = Math.max(...services.map((s) => s.revenueMinor));
  return (
    <View style={styles.block}>
      <SectionHeader title={t('home.topServices')} />
      <Card variant="outlined" style={styles.cardGap}>
        {services.map((s, i) => (
          <View key={s.name} style={styles.topRow}>
            <View style={styles.topLine}>
              <Text variant="bodyStrong" style={styles.flex}>{`${i + 1}. ${s.name}`}</Text>
              <Text variant="small" color="textSecondary" tabular>
                {t('home.timesCount', { n: s.count })}
              </Text>
              <Text variant="bodyStrong" weight="semibold" tabular>
                {formatMoney(s.revenueMinor)}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: theme.colors.primary50 }]}>
              <View
                style={{
                  width: `${Math.round((s.revenueMinor / max) * 100)}%`,
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

export function RecentActivity({ items }: { items: DemoBranch['activity'] }) {
  const { t } = useTranslation();
  const toast = useToast();
  return (
    <View style={styles.block}>
      <SectionHeader
        title={t('home.recentActivity')}
        actionLabel={t('home.viewAuditTrail')}
        onAction={() => toast(t('dev.laterPhase'), 'info')}
      />
      {items.map((item, i) => (
        <View key={i} style={styles.activity}>
          <Avatar name={item.who} size={32} />
          <Text variant="small" style={styles.flex}>{`${item.who} ${item.what}`}</Text>
          <Text variant="small" color="textSecondary">
            {item.when}
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
  toneIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    height: 124,
    marginTop: spacing.sm,
  },
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
