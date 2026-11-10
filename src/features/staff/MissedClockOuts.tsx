import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { atBusinessTime, businessDate, shiftBusinessDate } from '@/lib/dates';
import { levelOf } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { BottomSheet, Button, Card, FormError, ListRow, SegmentTabs, Text, TextField, useToast } from '@/ui';

import { useFixClockOut, useMissedClockOuts, type MissedClockOut } from './api';
import { TIME } from './labels';

/**
 * Clock-ins on earlier days with no clock-out (owner and managers): each is fixed with the time the person left; a
 * manager also says why. The time is on the day of the clock-in, or the next morning for a shift past midnight.
 */
export function MissedClockOuts() {
  const { t } = useTranslation();
  const dates = useDates();
  const { business, branch, role } = useWorkspace();
  const today = businessDate(new Date(), business.timezone);
  const allowed = levelOf(role, 'fixAttendance') !== null;
  const missed = useMissedClockOuts(branch.id, today, allowed);
  const [fixing, setFixing] = useState<MissedClockOut | null>(null);
  if (!allowed || !missed.data?.length) return null;

  return (
    <Card variant="outlined" style={styles.card} testID="missed-clock-outs">
      <Text variant="h4">{t('attendance.missed.title', { count: missed.data.length })}</Text>
      {missed.data.map((m) => (
        <ListRow
          key={m.id}
          title={m.employees?.full_name ?? '—'}
          meta={[
            t('attendance.missed.line', {
              day: dates.day(m.business_date, 'EEE d MMM'),
              time: dates.at(m.clock_in, business.timezone, 'HH:mm'),
            }),
          ]}
          trailing={
            <Button
              label={t('attendance.missed.fix')}
              size="sm"
              variant="secondary"
              onPress={() => setFixing(m)}
              testID={`missed-fix-${m.employees?.full_name ?? m.id}`}
            />
          }
        />
      ))}
      <BottomSheet open={fixing !== null} onClose={() => setFixing(null)} title={t('attendance.missed.sheetTitle', { name: fixing?.employees?.full_name ?? '' })}>
        {fixing ? <FixForm row={fixing} onDone={() => setFixing(null)} /> : null}
      </BottomSheet>
    </Card>
  );
}

type Day = 'same' | 'next';

function FixForm({ row, onDone }: { row: MissedClockOut; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const dates = useDates();
  const { business, branch, role } = useWorkspace();
  const fix = useFixClockOut(business.id, branch.id);
  const [time, setTime] = useState('');
  const [day, setDay] = useState<Day>('same');
  const [reason, setReason] = useState('');
  const needsReason = levelOf(role, 'fixAttendance') === 'reason';
  const timeOk = TIME.test(time);
  const ready = timeOk && (!needsReason || reason.trim().length >= 3);
  const on = day === 'same' ? row.business_date : shiftBusinessDate(row.business_date, 1);

  return (
    <>
      <Text color="textSecondary">
        {t('attendance.missed.hint', {
          day: dates.day(row.business_date, 'EEEE d MMMM'),
          time: dates.at(row.clock_in, business.timezone, 'HH:mm'),
        })}
      </Text>
      <TextField
        label={t('attendance.missed.left')}
        hint={t('attendance.missed.leftHint')}
        value={time}
        onChangeText={setTime}
        maxLength={5}
        keyboardType="numbers-and-punctuation"
        error={time && !timeOk ? t('validation.time') : undefined}
        testID="missed-time"
      />
      <View style={styles.row}>
        <SegmentTabs<Day>
          items={[
            { key: 'same', label: dates.day(row.business_date, 'EEE d MMM') },
            { key: 'next', label: dates.day(shiftBusinessDate(row.business_date, 1), 'EEE d MMM') },
          ]}
          value={day}
          onChange={setDay}
          testID="missed-day"
        />
      </View>
      <TextField
        label={t(needsReason ? 'attendance.missed.reason' : 'attendance.missed.reasonOptional')}
        value={reason}
        onChangeText={setReason}
        maxLength={200}
        testID="missed-reason"
      />
      <FormError error={fix.error} />
      <Button
        label={t('attendance.missed.save')}
        disabled={!ready}
        loading={fix.isPending}
        onPress={() =>
          fix.mutate(
            { id: row.id, at: atBusinessTime(on, time, business.timezone).toISOString(), reason: reason.trim() },
            {
              onSuccess: () => {
                toast(t('attendance.missed.saved', { name: row.employees?.full_name ?? '' }));
                onDone();
              },
            },
          )
        }
        testID="missed-save"
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row' },
});
