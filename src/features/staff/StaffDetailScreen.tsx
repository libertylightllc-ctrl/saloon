import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatBps, formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { Avatar, Button, Card, EmptyState, FormError, HeaderBand, QueryState, Screen, SectionHeader, StatusPill, Text, useToast } from '@/ui';

import { useAttendanceHistory, useRemoveStaff, useStaffDirectory } from './api';
import { useRoleTitle, WEEKDAYS } from './labels';
import { LoginCard } from './LoginCard';
import { RemoveStaffSheet } from './RemoveStaffSheet';
import { RosterSheet } from './RosterSheet';

function Row({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={styles.row}>
      <Text color="textSecondary" style={styles.flex}>
        {label}
      </Text>
      <Text variant="bodyStrong" tabular testID={testID}>
        {value}
      </Text>
    </View>
  );
}

/** One person: pay terms, weekly roster and recent attendance. The owner edits. */
export function StaffDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dates = useDates();
  const roleTitle = useRoleTitle();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { business, branch, role } = useWorkspace();
  const staff = useStaffDirectory(business.id);
  const history = useAttendanceHistory(id);
  const [editingRoster, setEditingRoster] = useState(false);
  const [removing, setRemoving] = useState(false);
  const person = staff.data?.find((s) => s.employee_id === id);
  const owner = can(role, 'manageStaff');
  const toast = useToast();
  const restore = useRemoveStaff(business.id, branch.id);

  return (
    <>
      <Screen header={<HeaderBand title={person?.full_name ?? t('staff.title')} subtitle={person ? roleTitle(person.role_title) : undefined} onBack />}>
        <QueryState query={staff}>
          {() =>
            !person ? (
              <EmptyState illustration="no-results" message={t('errors.not_found')} />
            ) : (
              <View style={styles.body}>
                <Card variant="outlined" style={styles.card}>
                  <View style={styles.row}>
                    <Avatar name={person.full_name} size={56} />
                    <View style={styles.flex}>
                      <Text variant="h4">{person.full_name}</Text>
                      <Text color="textSecondary">{person.username ? t('staff.login', { username: person.username }) : t('staff.noLogin')}</Text>
                    </View>
                  </View>
                  {person.employee_code ? <Row label={t('staff.fields.code')} value={person.employee_code} /> : null}
                  <Row label={t('staff.fields.salary')} value={formatMoney(person.base_salary_minor)} testID="staff-detail-salary" />
                  <Row label={t('staff.fields.commission')} value={`${formatBps(person.commission_bps)}`} testID="staff-detail-commission" />
                  <Row label={t('staff.wps')} value={person.wps_required ? t('staff.wpsYes') : t('staff.wpsNo')} />
                  {person.phone ? <Row label={t('staff.fields.phone')} value={person.phone} /> : null}
                  {owner ? (
                    <Button
                      label={t('common.edit')}
                      icon="pencil"
                      variant="outline"
                      size="md"
                      onPress={() => router.push({ pathname: '/staff/form', params: { id: person.employee_id } })}
                      testID="staff-edit"
                    />
                  ) : null}
                </Card>

                <LoginCard person={person} />

                <SectionHeader
                  title={t('staff.roster')}
                  actionLabel={owner ? t('staff.editRoster') : undefined}
                  onAction={owner ? () => setEditingRoster(true) : undefined}
                  testID="staff-roster-edit"
                />
                <Card variant="outlined" style={styles.card} testID="staff-roster">
                  {person.roster.length === 0 ? <Text color="textSecondary">{t('staff.noRosterHint')}</Text> : null}
                  {person.roster.length > 0
                    ? WEEKDAYS.map((d, i) => {
                        const shift = person.roster.find((r) => r.weekday === i);
                        return <Row key={d} label={t(`common.days.${d}`)} value={shift ? `${shift.start}–${shift.end}` : t('staff.off')} />;
                      })
                    : null}
                </Card>

                <SectionHeader title={t('staff.recentDays')} />
                <QueryState query={history} isEmpty={(rows) => rows.length === 0} empty={<Text color="textSecondary">{t('staff.noAttendance')}</Text>}>
                  {(rows) => (
                    <Card variant="outlined" style={styles.card}>
                      {rows.map((a) => (
                        <View key={a.id} style={styles.row} testID={`staff-day-${a.business_date}`}>
                          <Text style={styles.flex}>{dates.day(a.business_date, 'EEE d MMM')}</Text>
                          <Text tabular>
                            {dates.at(a.clock_in, business.timezone, 'HH:mm')}–{a.clock_out ? dates.at(a.clock_out, business.timezone, 'HH:mm') : '…'}
                          </Text>
                          {a.late ? <StatusPill tone="warning" label={t('attendance.lateBy', { n: a.late_minutes })} /> : null}
                        </View>
                      ))}
                    </Card>
                  )}
                </QueryState>

                {owner && person.active ? (
                  <Button label={t('staff.remove.button')} icon="trash" variant="ghost" onPress={() => setRemoving(true)} testID="staff-remove" />
                ) : null}
                {owner && !person.active ? (
                  <Card variant="outlined" style={styles.card} testID="staff-archived">
                    <Text color="textSecondary">{t('staff.remove.archivedBody')}</Text>
                    <FormError error={restore.error} />
                    <Button
                      label={t('staff.remove.restore')}
                      icon="repeat"
                      variant="secondary"
                      loading={restore.isPending}
                      onPress={() =>
                        restore.mutate(
                          { employee_id: person.employee_id, action: 'restore' },
                          { onSuccess: () => toast(t('staff.remove.restored', { name: person.full_name })) },
                        )
                      }
                      testID="staff-restore"
                    />
                  </Card>
                ) : null}
              </View>
            )
          }
        </QueryState>
      </Screen>
      {person ? <RosterSheet person={person} open={editingRoster} onClose={() => setEditingRoster(false)} /> : null}
      {person && owner ? <RemoveStaffSheet person={person} open={removing} onClose={() => setRemoving(false)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
