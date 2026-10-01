import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { businessDate } from '@/lib/dates';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { BottomSheet, Button, Card, FormError, StatusPill, Text, useToast } from '@/ui';

import { useAttendanceDay, useClock, type ClockAction } from './api';

/**
 * Home for staff and cashiers: today's shift, clock in, breaks and clock out. Clocking out asks first (a stray tap
 * used to end the day), and a day clocked out can go on ("Back to work": the time away counts as a break).
 */
export function ClockCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const dates = useDates();
  const { business, branch, employeeId } = useWorkspace();
  const board = useAttendanceDay(branch.id, businessDate(new Date(), business.timezone));
  const clock = useClock(business.id, branch.id);
  const [confirmOut, setConfirmOut] = useState(false);
  const me = board.data?.find((r) => r.employee_id === employeeId);
  if (!employeeId || !me) return null;

  const time = (at: string) => dates.at(at, business.timezone, 'HH:mm');
  const run = (action: ClockAction) =>
    clock.mutate(
      { employee_id: employeeId, action },
      {
        onSuccess: (r) => {
          setConfirmOut(false);
          toast(
            action === 'out'
              ? t('attendance.clockedOutMe')
              : action === 'break_start'
                ? t('attendance.breakStartedMe')
                : action === 'break_end'
                  ? t('attendance.breakEndedMe')
                  : action === 'resume'
                    ? t('attendance.backAtWorkMe')
                    : r.late
                      ? t('attendance.clockedInMeLate', { n: r.late_minutes })
                      : t('attendance.clockedInMe'),
          );
        },
      },
    );
  const busy = (action: ClockAction) => clock.isPending && clock.variables?.action === action;

  const summary = [
    me.shift_start ? t('attendance.shift', { from: me.shift_start, to: me.shift_end }) : me.status === 'off' ? t('staff.off') : t('attendance.noShift'),
    me.clock_in ? t('attendance.inOut', { in: time(me.clock_in), out: me.clock_out ? time(me.clock_out) : '…' }) : null,
    me.break_minutes > 0 ? t('attendance.breaksTotal', { n: me.break_minutes }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <Card variant="outlined" style={styles.card} testID="clock-card">
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text variant="bodyStrong">{t('attendance.myDay')}</Text>
            <Text variant="small" color="textSecondary">
              {summary}
            </Text>
          </View>
          {me.status === 'on_break' ? <StatusPill status="waiting" label={t('attendance.status.on_break')} /> : null}
          {me.late ? <StatusPill tone="warning" label={t('attendance.lateBy', { n: me.late_minutes })} /> : null}
        </View>
        <FormError error={clock.error} />
        {me.status === 'on_shift' ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button label={t('attendance.startBreak')} icon="coffee" variant="secondary" loading={busy('break_start')} onPress={() => run('break_start')} testID="clock-break-start" />
            </View>
            <View style={styles.flex}>
              <Button label={t('attendance.clockOut')} icon="logOut" variant="outline" onPress={() => setConfirmOut(true)} testID="clock-out" />
            </View>
          </View>
        ) : me.status === 'on_break' ? (
          <>
            <Text color="textSecondary">{me.break_started_at ? t('attendance.onBreakSince', { time: time(me.break_started_at) }) : null}</Text>
            <Button label={t('attendance.endBreak')} icon="clock" loading={busy('break_end')} onPress={() => run('break_end')} testID="clock-break-end" />
            <Button label={t('attendance.clockOut')} variant="ghost" size="sm" onPress={() => setConfirmOut(true)} testID="clock-out" />
          </>
        ) : me.status === 'done' ? (
          <>
            <Text color="textSecondary">{t('attendance.dayDone')}</Text>
            <Text variant="small" color="textSecondary">
              {t('attendance.backHint')}
            </Text>
            <Button label={t('attendance.backToWork')} variant="ghost" size="sm" icon="repeat" loading={busy('resume')} onPress={() => run('resume')} testID="clock-resume" />
          </>
        ) : (
          <Button label={t('attendance.clockIn')} icon="clock" loading={busy('in')} onPress={() => run('in')} testID="clock-in" />
        )}
      </Card>
      <BottomSheet open={confirmOut} onClose={() => setConfirmOut(false)} title={t('attendance.confirmOutTitle')}>
        <Text color="textSecondary">{t('attendance.confirmOutBody')}</Text>
        <FormError error={clock.error} />
        <Button label={t('attendance.clockOut')} icon="logOut" loading={busy('out')} onPress={() => run('out')} testID="clock-out-confirm" />
        {me.status === 'on_shift' ? (
          <Button label={t('attendance.takeBreak')} icon="coffee" variant="secondary" loading={busy('break_start')} onPress={() => run('break_start')} testID="clock-take-break" />
        ) : null}
        <Button label={t('common.cancel')} variant="ghost" onPress={() => setConfirmOut(false)} testID="clock-out-cancel" />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1, gap: 2 },
});
