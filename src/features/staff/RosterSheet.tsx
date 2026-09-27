import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { spacing, useTheme } from '@/theme';
import { BottomSheet, Button, FormError, Text, TextField, useToast } from '@/ui';

import { useSetRoster, type Shift, type StaffMember } from './api';
import { TIME, WEEKDAYS } from './labels';

interface Day {
  on: boolean;
  start: string;
  end: string;
}

/** The weekly shifts: a switch per day and its hours. Bookings for this person follow it. */
export function RosterSheet({
  person,
  open,
  onClose,
}: {
  person: StaffMember;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={open} onClose={onClose} title={t('staff.roster')}>
      {open ? <RosterForm person={person} onDone={onClose} /> : null}
    </BottomSheet>
  );
}

function RosterForm({ person, onDone }: { person: StaffMember; onDone: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const toast = useToast();
  const { business, branch } = useWorkspace();
  const save = useSetRoster(business.id, branch.id);
  const [days, setDays] = useState<Day[]>(() =>
    WEEKDAYS.map((_, i) => {
      const shift = person.roster.find((r) => r.weekday === i);
      return { on: Boolean(shift), start: shift?.start ?? '10:00', end: shift?.end ?? '20:00' };
    }),
  );
  const set = (i: number, patch: Partial<Day>) =>
    setDays((all) => all.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const valid = days.every(
    (d) => !d.on || (TIME.test(d.start) && TIME.test(d.end) && d.start !== d.end),
  );

  return (
    <>
      <Text color="textSecondary">{t('staff.rosterHint')}</Text>
      {days.map((d, i) => {
        const day = WEEKDAYS[i]!;
        return (
          <View key={day} style={styles.day}>
            <Text variant="bodyStrong" style={styles.name}>
              {t(`common.days.${day}`)}
            </Text>
            <Switch
              value={d.on}
              onValueChange={(on) => set(i, { on })}
              accessibilityLabel={t('staff.worksOn', { day: t(`common.days.${day}`) })}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary400 }}
              thumbColor={d.on ? theme.colors.primary500 : theme.colors.surface}
              testID={`roster-${day}`}
            />
            {d.on ? (
              <>
                <View style={styles.time}>
                  <TextField
                    value={d.start}
                    onChangeText={(start) => set(i, { start })}
                    maxLength={5}
                    aria-label={t('staff.from')}
                    testID={`roster-${day}-start`}
                  />
                </View>
                <View style={styles.time}>
                  <TextField
                    value={d.end}
                    onChangeText={(end) => set(i, { end })}
                    maxLength={5}
                    aria-label={t('staff.to')}
                    testID={`roster-${day}-end`}
                  />
                </View>
              </>
            ) : (
              <Text color="textSecondary" style={styles.flex}>
                {t('staff.off')}
              </Text>
            )}
          </View>
        );
      })}
      {!valid ? (
        <Text style={{ color: theme.colors.primaryText }}>{t('staff.timeFormat')}</Text>
      ) : null}
      <FormError error={save.error} />
      <Button
        label={t('staff.saveRoster')}
        disabled={!valid}
        loading={save.isPending}
        onPress={() =>
          save.mutate(
            {
              employee_id: person.employee_id,
              days: days.flatMap((d, weekday): Shift[] =>
                d.on ? [{ weekday, start: d.start, end: d.end }] : [],
              ),
            },
            {
              onSuccess: () => {
                toast(t('staff.rosterSaved'));
                onDone();
              },
            },
          )
        }
        testID="roster-save"
      />
    </>
  );
}

const styles = StyleSheet.create({
  day: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52 },
  name: { width: 44 },
  time: { flex: 1 },
  flex: { flex: 1 },
});
