import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { AdminSalon } from '@/features/plan/api';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { Button, FormError, Text, TextField, useToast } from '@/ui';

import { useSetAccess, type AccessAction } from './api';

/** A salon's access in words: free for good, pilot or free until a date, paid until a date. */
export function accessLabel(s: Pick<AdminSalon, 'access_type' | 'free_until' | 'paid_until'>, t: TFunction, day: (d: string) => string): string {
  if (s.access_type === 'comp') return t('console.access.comp');
  if (s.access_type === 'paid' && s.paid_until) return t('admin.until', { date: day(s.paid_until) });
  if (s.free_until) return t(s.access_type === 'pilot' ? 'console.access.pilotUntil' : 'console.access.freeUntil', { date: day(s.free_until) });
  return t('console.access.none');
}

/**
 * One salon's access (full update, Phase 6 g): pilot for 60 or 90 days or until a date, 30 more days, a new end date,
 * end now, free for good, and a note. The server records each change with its old and new values.
 */
export function AccessForm({ salon, onDone }: { salon: AdminSalon; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const dates = useDates();
  const set = useSetAccess();
  const [date, setDate] = useState(salon.free_until ?? '');
  const [note, setNote] = useState(salon.admin_note ?? '');
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date.trim());
  const run = (action: AccessAction, extra: { days?: number; until?: string; note?: string } = {}) =>
    set.mutate(
      { businessId: salon.business_id, action, ...extra },
      {
        onSuccess: () => {
          toast(t('console.access.saved'));
          onDone();
        },
      },
    );
  const small = (key: string, label: string, onPress: () => void, disabled = false) => (
    <Button key={key} size="sm" variant="secondary" label={label} onPress={onPress} disabled={disabled || set.isPending} testID={`access-${key}`} />
  );
  return (
    <View style={styles.box} testID="console-access">
      <Text variant="h4">{t('console.access.title')}</Text>
      <Text color="textSecondary" testID="console-access-now">
        {accessLabel(salon, t, (d) => dates.day(d, 'd MMM yyyy'))}
      </Text>
      <View style={styles.wrap}>
        {small('pilot-60', t('console.access.pilotDays', { days: 60 }), () => run('pilot', { days: 60 }))}
        {small('pilot-90', t('console.access.pilotDays', { days: 90 }), () => run('pilot', { days: 90 }))}
        {small('extend', t('console.access.extend'), () => run('extend'))}
        {small('comp', t('console.access.compAction'), () => run('comp'))}
        {small('end-now', t('console.access.endNow'), () => run('end_now'))}
      </View>
      <TextField
        label={t('console.access.date')}
        placeholder="2027-01-24"
        value={date}
        onChangeText={setDate}
        maxLength={10}
        testID="access-date"
      />
      <View style={styles.wrap}>
        {small('pilot-until', t('console.access.pilotUntilAction'), () => run('pilot', { until: date.trim() }), !dateOk)}
        {small('set-end', t('console.access.setEnd'), () => run('set_end', { until: date.trim() }), !dateOk)}
      </View>
      <TextField label={t('console.access.note')} value={note} onChangeText={setNote} multiline maxLength={500} testID="access-note" />
      {small('note-save', t('console.access.saveNote'), () => run('note', { note }))}
      <FormError error={set.error} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
