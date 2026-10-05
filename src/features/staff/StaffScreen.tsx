import { useRouter } from 'expo-router';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useTeam, type TeamMember } from '@/features/team/api';
import { businessDate } from '@/lib/dates';
import { formatBps, formatMoney, sum } from '@/lib/money';
import { can } from '@/lib/permissions';
import { spacing } from '@/theme';
import { Avatar, Button, Card, EmptyState, HeaderBand, KpiCard, KpiGrid, ListRow, QueryState, Screen, SectionHeader, StatusPill, Text } from '@/ui';

import { useAttendanceDay, useStaffDirectory, type StaffMember } from './api';
import { useRoleTitle } from './labels';
import { ManageLoginSheet } from './ManageLoginSheet';

/**
 * Staff: everyone who works here with their pay, shifts and app login, in one place (owner and accountant). Logins
 * are made here too (Add staff → "Can sign in", or a person's page); people with only a login, such as an outside
 * accountant, are listed after the staff.
 */
export function StaffScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const roleTitle = useRoleTitle();
  const { business, branch, role } = useWorkspace();
  const staff = useStaffDirectory(business.id);
  const today = useAttendanceDay(branch.id, businessDate(new Date(), business.timezone));
  const owner = can(role, 'manageStaff');
  const logins = can(role, 'manageUsers');
  const team = useTeam(business.id, logins);
  const [managing, setManaging] = useState<TeamMember | null>(null);
  /** People with a login but no staff record (an outside accountant). */
  const loginOnlyOf = (rows: StaffMember[]) => {
    const onStaff = new Set(rows.map((s) => s.member_id).filter(Boolean));
    return (team.data ?? []).filter((m) => m.role !== 'owner' && !onStaff.has(m.id));
  };

  return (
    <>
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
        <View style={styles.body}>
          {logins ? (
            <Card variant="tinted" style={styles.code}>
              <Text variant="small" color="textOnTint">
                {t('team.codeExplain')}
              </Text>
              <Text variant="h3" color="primaryText" testID="team-salon-code">
                {business.code}
              </Text>
            </Card>
          ) : null}
          <QueryState
            query={staff}
            isEmpty={(rows) => rows.length === 0 && loginOnlyOf(rows).length === 0}
            empty={<EmptyState illustration="no-results" message={t('staff.empty')} />}
          >
            {(rows) => {
              const active = rows.filter((s) => s.active);
              const loginOnly = loginOnlyOf(rows);
              const onShift = (today.data ?? []).filter((a) => a.status === 'on_shift').length;
              return (
                <View style={styles.body}>
                  <KpiGrid>
                    <KpiCard icon="users" label={t('staff.people')} value={String(active.length)} testID="staff-count" />
                    <KpiCard icon="userCheck" label={t('staff.inToday')} value={String(onShift)} testID="staff-in" />
                    <KpiCard icon="wallet" label={t('staff.salaries')} value={formatMoney(sum(active.map((s) => s.base_salary_minor)))} testID="staff-salaries" />
                  </KpiGrid>
                  <View style={styles.actions}>
                    <Button label={t('attendance.title')} icon="clock" variant="outline" size="md" onPress={() => router.push('/attendance')} testID="staff-attendance" />
                    <Button label={t('payroll.title')} icon="wallet" variant="outline" size="md" onPress={() => router.push('/payroll')} testID="staff-payroll" />
                  </View>
                  {[...rows.filter((s) => s.active), ...rows.filter((s) => !s.active)].map((s, i, all) => (
                    <Fragment key={s.employee_id}>
                      {!s.active && (i === 0 || all[i - 1]!.active) ? <SectionHeader title={t('staff.archivedSection')} /> : null}
                      <ListRow
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
                    </Fragment>
                  ))}
                  {loginOnly.length ? <SectionHeader title={t('staff.loginOnly')} /> : null}
                  {loginOnly.map((m) => (
                    <ListRow
                      key={m.id}
                      testID={`member-${m.username}`}
                      leading={<Avatar name={m.display_name} size={44} />}
                      title={m.display_name}
                      meta={[[t(`roles.${m.role}`), `@${m.username}`].join(' · ')]}
                      trailing={m.active ? undefined : <StatusPill tone="neutral" label={t('team.disabled')} />}
                      chevron
                      onPress={() => setManaging(m)}
                    />
                  ))}
                </View>
              );
            }}
          </QueryState>
        </View>
      </Screen>
      <ManageLoginSheet member={managing} onClose={() => setManaging(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  code: { gap: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  trailing: { alignItems: 'flex-end', gap: 2 },
});
