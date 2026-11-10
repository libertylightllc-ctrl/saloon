import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useNewPilotApplications } from '@/features/console/api';
import { useDates } from '@/lib/useDates';
import { spacing, useTheme } from '@/theme';
import { Button, EmptyState, HeaderBand, Icon, ListRow, QueryState, Screen, Text, useToast } from '@/ui';

import { useMarkRead, useNotifications } from './api';
import { notificationHref } from './links';
import { NOTIFICATION_ICON, useNotificationText } from './text';

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
  const pilotNew = useNewPilotApplications();

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
      <View style={styles.list}>
        {/* Platform owners: the pilot applications still New, first (owner's fix list A1); they go once decided. */}
        {pilotNew > 0 ? (
          <ListRow
            testID="notification-pilot-new"
            leading={
              <View style={[styles.icon, { backgroundColor: theme.colors.primary50 }]}>
                <Icon name="sparkles" size={18} color={theme.colors.primary500} />
              </View>
            }
            title={t('console.pilot.newCount', { count: pilotNew })}
            trailing={<Text variant="small" color="primaryText">{t('console.pilot.review')}</Text>}
            chevron
            onPress={() => router.push('/console?tab=pilot')}
          />
        ) : null}
        <QueryState query={list} isEmpty={(rows) => rows.length === 0 && pilotNew === 0} empty={<EmptyState illustration="no-results" message={t('notifications.empty')} />}>
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
                        <Icon name={NOTIFICATION_ICON[n.type as keyof typeof NOTIFICATION_ICON] ?? 'bell'} size={18} color={n.read_at ? theme.colors.textSecondary : theme.colors.primary500} />
                      </View>
                    }
                    title={w.title}
                    titleLines={2}
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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
