import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { businessDate } from '@/lib/dates';
import { formatBps, formatMoney, sum } from '@/lib/money';
import { can } from '@/lib/permissions';
import { spacing } from '@/theme';
import { Avatar, Button, EmptyState, HeaderBand, KpiCard, ListRow, QueryState, Screen, StatusPill, Text } from '@/ui';

import { useAttendanceDay, useStaffDirectory } from './api';
import { useRoleTitle } from './labels';

/** Staff & payroll: everyone who works here, their pay terms and who is in today. Owner and accountant. */
export function StaffScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const roleTitle = useRoleTitle();
  const { business, branch, role } = useWorkspace();
  const staff = useStaffDirectory(business.id);
  const today = useAttendanceDay(branch.id, businessDate(new Date(), business.timezone));
  const owner = can(role, 'manageStaff');

  return (
    <Screen
      refreshing={staff.isRefetching}
      onRefresh={() => {
        void staff.refetch();
        void today.refetch();
      }}
      header={
        <HeaderBand
          title={t('staff.title')}
          subtitle={t('staff.subtitle')}
          onBack
          right={owner ? <Button label={t('staff.add')} icon="plus" size="sm" variant="secondary" onPress={() => router.push('/staff/form')} testID="staff-add" /> : undefined}
        />
      }
    >
      <QueryState query={staff} isEmpty={(rows) => rows.length === 0} empty={<EmptyState illustration="no-results" message={t('staff.empty')} />}>
        {(rows) => {
          const active = rows.filter((s) => s.active);
          const onShift = (today.data ?? []).filter((a) => a.status === 'on_shift').length;
          return (
            <View style={styles.body}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kpis}>
                <KpiCard icon="users" label={t('staff.people')} value={String(active.length)} testID="staff-count" />
                <KpiCard icon="userCheck" label={t('staff.inToday')} value={String(onShift)} testID="staff-in" />
                <KpiCard icon="wallet" label={t('staff.salaries')} value={formatMoney(sum(active.map((s) => s.base_salary_minor)))} testID="staff-salaries" />
              </ScrollView>
              <View style={styles.actions}>
                <Button label={t('attendance.title')} icon="clock" variant="outline" size="md" onPress={() => router.push('/attendance')} testID="staff-attendance" />
                <Button label={t('payroll.title')} icon="wallet" variant="outline" size="md" onPress={() => router.push('/payroll')} testID="staff-payroll" />
              </View>
              {rows.map((s) => (
                <ListRow
                  key={s.employee_id}
                  testID={`staff-${s.full_name}`}
                  leading={<Avatar name={s.full_name} size={44} />}
                  title={s.full_name}
                  meta={[
                    [roleTitle(s.role_title), s.employee_code].filter(Boolean).join(' · '),
                    s.username ? t('staff.login', { username: s.username }) : t('staff.noLogin'),
                  ]}
                  badges={
                    <View style={styles.badges}>
                      {!s.active ? <StatusPill status="archived" label={t('staff.inactive')} /> : null}
                      {s.wps_required ? <StatusPill tone="info" label={t('staff.wps')} /> : null}
                      {s.roster.length === 0 ? <StatusPill tone="neutral" label={t('staff.noRoster')} /> : null}
                    </View>
                  }
                  trailing={
                    <View style={styles.trailing}>
                      <Text variant="bodyStrong" tabular>
                        {formatMoney(s.base_salary_minor)}
                      </Text>
                      {s.commission_bps ? (
                        <Text variant="small" color="textSecondary">
                          {t('staff.commissionShort', { pct: formatBps(s.commission_bps) })}
                        </Text>
                      ) : null}
                    </View>
                  }
                  chevron
                  onPress={() => router.push({ pathname: '/staff/[id]', params: { id: s.employee_id } })}
                />
              ))}
            </View>
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  kpis: { gap: spacing.md, paddingVertical: spacing.xs, paddingHorizontal: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  trailing: { alignItems: 'flex-end', gap: 2 },
});
