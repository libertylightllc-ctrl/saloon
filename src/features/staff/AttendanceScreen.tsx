import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { clockText } from '@/lib/clock';
import { businessDate, formatAt, shiftBusinessDate, type BusinessDate } from '@/lib/dates';
import { can } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import {
  Avatar,
  BottomSheet,
  Button,
  DateStrip,
  EmptyState,
  FormError,
  HeaderBand,
  ListRow,
  QueryState,
  Screen,
  SegmentTabs,
  StatusPill,
  TextField,
  useToast,
  type StatusKey,
} from '@/ui';

import { useAttendanceDay, useClock, type AttendanceRow, type AttendanceStatus, type ClockAction } from './api';
import { TIME } from './labels';

const STATUS: Record<AttendanceStatus, StatusKey> = {
  on_shift: 'in_progress',
  on_break: 'pending_approval',
  done: 'completed',
  not_in: 'waiting',
  off: 'cancelled',
};

/** What the front desk can record for someone in each state; the first is offered on the row. */
const ACTIONS: Record<AttendanceStatus, ClockAction[]> = {
  not_in: ['in'],
  off: ['in'],
  on_shift: ['out', 'break_start'],
  on_break: ['break_end', 'out'],
  done: ['resume'],
};

/** The day's attendance board: who is in, who is late, who is off. The owner and cashier record for others. */
export function AttendanceScreen() {
  const { t } = useTranslation();
  const dates = useDates();
  const { business, branch, role } = useWorkspace();
  const today = businessDate(new Date(), business.timezone);
  const [date, setDate] = useState<BusinessDate>(today);
  const board = useAttendanceDay(branch.id, date);
  const [recording, setRecording] = useState<AttendanceRow | null>(null);
  const canRecord = can(role, 'recordAttendance') && date === today;

  return (
    <>
      <Screen
        refreshing={board.isRefetching}
        onRefresh={() => void board.refetch()}
        header={<HeaderBand title={t('attendance.title')} subtitle={dates.day(date, 'EEEE d MMMM')} onBack />}
      >
        <View style={styles.body}>
          <DateStrip dates={Array.from({ length: 14 }, (_, i) => shiftBusinessDate(today, i - 13))} value={date} onChange={setDate} />
          <QueryState query={board} isEmpty={(rows) => rows.length === 0} empty={<EmptyState illustration="no-results" message={t('attendance.empty')} />}>
            {(rows) => (
              <View style={styles.list}>
                {rows.map((r) => (
                  <ListRow
                    key={r.employee_id}
                    testID={`attendance-${r.full_name}`}
                    leading={<Avatar name={r.full_name} size={40} />}
                    title={r.full_name}
                    meta={[
                      r.shift_start ? t('attendance.shift', { from: clockText(r.shift_start), to: clockText(r.shift_end ?? '') }) : r.status === 'off' ? t('staff.off') : t('attendance.noShift'),
                      ...(r.break_minutes > 0 ? [t('attendance.breaksTotal', { n: r.break_minutes })] : []),
                      ...(r.clock_in
                        ? [
                            t('attendance.inOut', {
                              in: dates.at(r.clock_in, business.timezone, 'HH:mm'),
                              out: r.clock_out ? dates.at(r.clock_out, business.timezone, 'HH:mm') : '…',
                            }),
                          ]
                        : []),
                    ]}
                    badges={
                      <View style={styles.badges}>
                        <StatusPill status={STATUS[r.status]} label={t(`attendance.status.${r.status}`)} />
                        {r.late ? <StatusPill tone="warning" label={t('attendance.lateBy', { n: r.late_minutes })} /> : null}
                      </View>
                    }
                    trailing={
                      canRecord ? (
                        <Button
                          label={t(`attendance.actions.${ACTIONS[r.status][0]!}`)}
                          size="sm"
                          variant="secondary"
                          onPress={() => setRecording(r)}
                          testID={`attendance-${r.full_name}-${ACTIONS[r.status][0]!}`}
                        />
                      ) : undefined
                    }
                  />
                ))}
              </View>
            )}
          </QueryState>
        </View>
      </Screen>
      <BottomSheet
        open={recording !== null}
        onClose={() => setRecording(null)}
        title={recording ? t('attendance.recordFor', { name: recording.full_name }) : ''}
      >
        {recording ? <RecordForm row={recording} onDone={() => setRecording(null)} /> : null}
      </BottomSheet>
    </>
  );
}

/** What happened and when (defaults to now), for someone without the app: clock in or out, a break, back to work. */
function RecordForm({ row, onDone }: { row: AttendanceRow; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const dates = useDates();
  const { business, branch } = useWorkspace();
  const clock = useClock(business.id, branch.id);
  const choices = ACTIONS[row.status];
  const [action, setAction] = useState<ClockAction>(choices[0]!);
  const [time, setTime] = useState(() => formatAt(new Date(), business.timezone, 'HH:mm', dates.language));
  const valid = TIME.test(time);
  const at = () => {
    // The chosen time today, in the branch's time zone.
    const now = new Date();
    const current = formatAt(now, business.timezone, 'HH:mm', dates.language);
    const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
    return new Date(now.getTime() - (minutes(current) - minutes(time)) * 60_000).toISOString();
  };
  return (
    <>
      {choices.length > 1 ? (
        <SegmentTabs<ClockAction>
          items={choices.map((a) => ({ key: a, label: t(`attendance.actions.${a}`) }))}
          value={action}
          onChange={setAction}
          testID="attendance-action"
        />
      ) : null}
      <TextField label={t('attendance.time')} hint={t('attendance.timeHint')} value={time} onChangeText={setTime} maxLength={5} testID="attendance-time" />
      <FormError error={clock.error} />
      <Button
        label={t(`attendance.actions.${action}`)}
        disabled={!valid}
        loading={clock.isPending}
        onPress={() =>
          clock.mutate(
            { employee_id: row.employee_id, action, at: at() },
            {
              onSuccess: (r) => {
                toast(
                  action === 'out'
                    ? t('attendance.clockedOut', { name: row.full_name })
                    : action === 'in'
                      ? r.late
                        ? t('attendance.clockedInLate', { name: row.full_name, n: r.late_minutes })
                        : t('attendance.clockedIn', { name: row.full_name })
                      : t(`attendance.recorded.${action}`, { name: row.full_name }),
                );
                onDone();
              },
            },
          )
        }
        testID="attendance-confirm"
      />
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  list: { gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
