import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { businessDate } from '@/lib/dates';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { Button, Card, FormError, StatusPill, Text, useToast } from '@/ui';

import { useAttendanceDay, useClock } from './api';

/** Home for staff and cashiers: today's shift and a one-tap clock in / out. */
export function ClockCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const dates = useDates();
  const { business, branch, employeeId } = useWorkspace();
  const board = useAttendanceDay(branch.id, businessDate(new Date(), business.timezone));
  const clock = useClock(business.id, branch.id);
  const me = board.data?.find((r) => r.employee_id === employeeId);
  if (!employeeId || !me) return null;

  const action = me.status === 'on_shift' ? 'out' : me.status === 'done' ? null : 'in';
  return (
    <Card variant="outlined" style={styles.card} testID="clock-card">
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text variant="bodyStrong">{t('attendance.myDay')}</Text>
          <Text variant="small" color="textSecondary">
            {me.shift_start ? t('attendance.shift', { from: me.shift_start, to: me.shift_end }) : me.status === 'off' ? t('staff.off') : t('attendance.noShift')}
            {me.clock_in
              ? ` · ${t('attendance.inOut', {
                  in: dates.at(me.clock_in, business.timezone, 'HH:mm'),
                  out: me.clock_out ? dates.at(me.clock_out, business.timezone, 'HH:mm') : '…',
                })}`
              : ''}
          </Text>
        </View>
        {me.late ? <StatusPill tone="warning" label={t('attendance.lateBy', { n: me.late_minutes })} /> : null}
      </View>
      <FormError error={clock.error} />
      {action ? (
        <Button
          label={t(action === 'in' ? 'attendance.clockIn' : 'attendance.clockOut')}
          icon="clock"
          loading={clock.isPending}
          onPress={() =>
            clock.mutate(
              { employee_id: employeeId, action },
              {
                onSuccess: (r) =>
                  toast(
                    action === 'out'
                      ? t('attendance.clockedOutMe')
                      : r.late
                        ? t('attendance.clockedInMeLate', { n: r.late_minutes })
                        : t('attendance.clockedInMe'),
                  ),
              },
            )
          }
          testID={`clock-${action}`}
        />
      ) : (
        <Text color="textSecondary">{t('attendance.dayDone')}</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
});
