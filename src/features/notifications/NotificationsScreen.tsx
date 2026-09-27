import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import { spacing, useTheme } from '@/theme';
import { Button, EmptyState, HeaderBand, Icon, ListRow, QueryState, Screen, useToast, type IconName } from '@/ui';

import { useMarkRead, useNotifications, type AppNotification } from './api';
import { notificationHref } from './links';

const TYPES = ['new_booking', 'long_wait', 'close_submitted', 'low_stock', 'document_due', 'payroll_generated', 'refund_requested', 'daily_digest'] as const;
const ICON: Record<(typeof TYPES)[number], IconName> = {
  new_booking: 'calendarPlus',
  long_wait: 'hourglass',
  close_submitted: 'banknote',
  low_stock: 'package',
  document_due: 'shield',
  payroll_generated: 'wallet',
  refund_requested: 'rotate',
  daily_digest: 'sparkles',
};

/** The words for a notification in the app language (the stored English text is for push). */
export function useNotificationText() {
  const { t } = useTranslation();
  const dates = useDates();
  const { business } = useWorkspace();
  return (n: AppNotification) => {
    if (!(TYPES as readonly string[]).includes(n.type)) return { title: n.title, body: n.body };
    const d = n.data as Record<string, string | number | null>;
    const type = n.type as (typeof TYPES)[number];
    const values = {
      ...d,
      at: typeof d.at === 'string' ? dates.at(d.at, business.timezone, 'EEE d MMM · HH:mm') : '',
      date: typeof d.date === 'string' ? dates.day(d.date, 'EEE d MMM') : '',
      expires: typeof d.expires_on === 'string' ? dates.day(d.expires_on, 'd MMM yyyy') : '',
      amount: typeof d.amount_minor === 'number' ? formatMoney(d.amount_minor) : '',
      variance: typeof d.variance_minor === 'number' ? formatMoney(d.variance_minor) : '',
      sales_total: typeof d.sales_minor === 'number' ? formatMoney(d.sales_minor) : '',
      doc: typeof d.doc_type === 'string' ? (t(`compliance.types.${d.doc_type}` as 'compliance.types.visa', { defaultValue: d.doc_type }) as string) : '',
      customer: d.customer ?? t('queue.guest'),
      count: typeof d.days === 'number' ? d.days : 0,
    };
    return { title: t(`notifications.types.${type}.title`, values), body: t(`notifications.types.${type}.body`, values) };
  };
}

/** Bell → everything that happened for me, newest first; tapping one opens it. */
export function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const dates = useDates();
  const { business, member } = useWorkspace();
  const list = useNotifications(member.id);
  const mark = useMarkRead(member.id);
  const words = useNotificationText();
  const toast = useToast();
  const unread = (list.data ?? []).filter((n) => !n.read_at).length;

  return (
    <Screen
      refreshing={list.isRefetching}
      onRefresh={() => void list.refetch()}
      header={
        <HeaderBand
          title={t('notifications.title')}
          onBack
          right={
            <Button
              label={t('notifications.markAll')}
              size="sm"
              variant="secondary"
              // Nothing to mark: the button says so by being off.
              disabled={unread === 0}
              onPress={() => mark.mutate(null, { onSuccess: () => toast(t('notifications.markedRead', { count: unread })) })}
              loading={mark.isPending}
              testID="notifications-read-all"
            />
          }
        />
      }
    >
      <QueryState query={list} isEmpty={(rows) => rows.length === 0} empty={<EmptyState illustration="no-results" message={t('notifications.empty')} />}>
        {(rows) => (
          <View style={styles.list}>
            {rows.map((n) => {
              const w = words(n);
              return (
                <ListRow
                  key={n.id}
                  testID={`notification-${n.type}`}
                  leading={
                    <View style={[styles.icon, { backgroundColor: n.read_at ? theme.colors.neutral.n20 : theme.colors.primary50 }]}>
                      <Icon name={ICON[n.type as (typeof TYPES)[number]] ?? 'bell'} size={18} color={n.read_at ? theme.colors.textSecondary : theme.colors.primary500} />
                    </View>
                  }
                  title={w.title}
                  meta={[w.body, dates.at(n.created_at, business.timezone, 'd MMM · HH:mm')]}
                  chevron
                  onPress={() => {
                    if (!n.read_at) mark.mutate([n.id]);
                    router.push(notificationHref(n));
                  }}
                />
              );
            })}
          </View>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
