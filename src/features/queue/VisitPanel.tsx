import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useTerms } from '@/features/mode/useTerms';
import { formatMoney, sum } from '@/lib/money';
import { semantic, spacing, useTheme } from '@/theme';
import { Avatar, Button, Card, Icon, StatusPill, Text } from '@/ui';

import type { Appointment } from './api';
import { primaryAction, type RowAction } from './actions';
import { useVisitWhen } from './visitText';

/**
 * Tablets and computers: the visit picked in the queue, beside the list (Option B) — who, when, what, with whom,
 * notes and deposit, and its actions (the main one, the customer's record, and the rest under More actions).
 */
export function VisitPanel({
  item,
  now,
  timeZone,
  busy,
  onAction,
  onMore,
  canSell,
}: {
  item: Appointment | null;
  now: Date;
  timeZone: string;
  busy: boolean;
  onAction: (item: Appointment, action: RowAction) => void;
  onMore: (item: Appointment) => void;
  canSell: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const terms = useTerms();
  const visitWhen = useVisitWhen();

  if (!item) {
    return (
      <Card variant="outlined" style={styles.empty}>
        <Icon name="users" size={28} color={theme.colors.textSecondary} />
        <Text color="textSecondary" align="center">
          {t('queue.pickVisit')}
        </Text>
      </Card>
    );
  }

  const name = item.customer_name ?? t('queue.guest');
  const action = primaryAction(item.status, canSell);
  const total = sum(item.appointment_services.map((s) => s.price_minor));
  const staff = [item.employees?.full_name ?? terms.anyStaff, item.rooms?.name].filter(Boolean).join(' · ');

  return (
    <Card style={styles.panel} testID="visit-panel">
      <View style={styles.head}>
        <Avatar name={name} size={56} />
        <View style={styles.flex}>
          <Text variant="h2" numberOfLines={1} testID="visit-name">
            {name}
          </Text>
          <View style={styles.line}>
            <Icon
              name={item.status === 'waiting' ? 'hourglass' : 'clock'}
              size={14}
              color={item.status === 'waiting' ? semantic.warning.pressed : theme.colors.textSecondary}
            />
            <Text color="textSecondary">{visitWhen(item, now, timeZone)}</Text>
          </View>
        </View>
        <StatusPill status={item.status} />
      </View>

      <View style={styles.badges}>
        {item.source === 'walk_in' ? <StatusPill tone="primary" label={t('queue.badges.walk_in')} /> : null}
        {item.deposit_status === 'held' ? (
          <StatusPill tone="success" label={t('queue.depositHeld', { amount: formatMoney(item.deposit_minor) })} />
        ) : null}
      </View>

      <View style={styles.section}>
        <Text variant="bodyStrong">{t('queue.services')}</Text>
        {item.appointment_services.length === 0 ? <Text color="textSecondary">{t('queue.noServices')}</Text> : null}
        {item.appointment_services.map((s) => (
          <View key={s.id} style={styles.row}>
            <Text style={styles.flex}>
              {s.name_snapshot}
              {s.duration_min ? <Text color="textSecondary">{` · ${t('common.minutes', { n: s.duration_min })}`}</Text> : null}
            </Text>
            <Text weight="medium" tabular>
              {formatMoney(s.price_minor)}
            </Text>
          </View>
        ))}
        {item.appointment_services.length > 1 ? (
          <View style={[styles.row, styles.total, { borderTopColor: theme.colors.divider }]}>
            <Text variant="bodyStrong" style={styles.flex}>
              {t('receipt.total')}
            </Text>
            <Text variant="h4" tabular>
              {formatMoney(total)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.line}>
        <Icon name="user" size={16} color={theme.colors.textSecondary} />
        <Text color="textSecondary">{staff}</Text>
      </View>

      {item.notes ? (
        <View style={styles.section}>
          <Text variant="bodyStrong">{t('queue.notes')}</Text>
          <Text>{item.notes}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {action ? (
          <Button
            label={t(`queue.actions.${action}`)}
            loading={busy}
            onPress={() => onAction(item, action)}
            testID={`visit-${action}`}
          />
        ) : null}
        <View style={styles.secondary}>
          {item.customer_id ? (
            <Button
              label={t('queue.customerRecord')}
              icon="contact"
              variant="secondary"
              size="md"
              onPress={() => router.push({ pathname: '/customers/[id]', params: { id: item.customer_id! } })}
              testID="visit-customer"
            />
          ) : null}
          <Button
            label={t('queue.moreActionsShort')}
            icon="ellipsis"
            variant="secondary"
            size="md"
            onPress={() => onMore(item)}
            testID="visit-more"
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  panel: { gap: spacing.xl },
  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing['3xl'] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  total: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
  actions: { gap: spacing.md },
  secondary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
