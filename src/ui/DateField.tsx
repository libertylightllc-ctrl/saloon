/**
 * A date picked on a month calendar instead of typed as year-month-day (owner's fix list #8, 26 Oct 2026). The field
 * shows the date in words ("24 Jan 2027"); tapping it opens the month below it, Monday first as the UAE week. Built
 * from the app's own parts, so it works the same on the web and on phones. The value stays a business date
 * ('2027-01-24'), or '' when an optional date is cleared.
 */
import { getDay, getDaysInMonth } from 'date-fns';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { businessDate, monthKey, shiftBusinessDate, type BusinessDate, type MonthKey } from '@/lib/dates';
import { useDates } from '@/lib/useDates';
import { semantic, spacing, useTheme } from '@/theme';

import { MonthSwitcher } from './DatePickers';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';

/** A Monday, to name the week's days in the app language. */
const A_MONDAY = '2024-01-01';

/** The month's days in weeks, Monday first; null where the month has not started or has ended. */
function weeks(month: MonthKey): (BusinessDate | null)[][] {
  const first = new Date(`${month}-01T12:00:00`);
  const lead = (getDay(first) + 6) % 7;
  const cells = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: getDaysInMonth(first) }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

export function DateField({
  label,
  value,
  onChange,
  min,
  clearable = false,
  hint,
  error,
  testID,
}: {
  label: string;
  value: BusinessDate | '';
  onChange: (date: BusinessDate | '') => void;
  /** The first day that can be picked. */
  min?: BusinessDate;
  /** An optional date: a cross takes it away. */
  clearable?: boolean;
  hint?: string;
  error?: string;
  testID?: string;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const dates = useDates();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<MonthKey>(monthKey(value || min || businessDate()));
  const borderColor = error ? semantic.error.main : open ? theme.colors.primary400 : theme.colors.border;
  return (
    <View style={styles.wrap}>
      <Text variant="bodyStrong" color="text">
        {label}
      </Text>
      <View style={[styles.field, { borderColor, borderWidth: open || error ? 1.5 : 1, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface }]}>
        <Pressable
          style={styles.open}
          onPress={() => setOpen(!open)}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value ? dates.day(value, 'd MMMM yyyy') : t('common.chooseDate')}`}
          aria-expanded={open}
          testID={testID}
        >
          <Icon name="calendar" size={18} color={theme.colors.textSecondary} />
          <Text color={value ? 'text' : 'textDisabled'} style={styles.flex}>
            {value ? dates.day(value, 'd MMM yyyy') : t('common.chooseDate')}
          </Text>
        </Pressable>
        {clearable && value ? (
          <IconButton icon="x" variant="plain" size={32} accessibilityLabel={t('common.clearDate')} onPress={() => onChange('')} testID={testID ? `${testID}-clear` : undefined} />
        ) : null}
      </View>
      {open ? (
        <View style={[styles.calendar, { borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface }]} testID={testID ? `${testID}-calendar` : undefined}>
          <MonthSwitcher value={month} onChange={setMonth} onBand={false} />
          <View style={styles.week}>
            {Array.from({ length: 7 }, (_, i) => (
              <Text key={i} variant="small" color="textSecondary" align="center" style={styles.cell}>
                {dates.day(shiftBusinessDate(A_MONDAY, i), 'EEEEEE')}
              </Text>
            ))}
          </View>
          {weeks(month).map((week, w) => (
            <View key={w} style={styles.week}>
              {week.map((day, i) => {
                if (!day) return <View key={i} style={styles.cell} />;
                const chosen = day === value;
                const blocked = !!min && day < min;
                return (
                  <Pressable
                    key={day}
                    disabled={blocked}
                    onPress={() => {
                      onChange(day);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={dates.day(day, 'EEEE d MMMM yyyy')}
                    aria-selected={chosen}
                    style={[styles.cell, styles.day, { borderRadius: theme.radius.sm, backgroundColor: chosen ? theme.colors.primaryAction : 'transparent' }]}
                    testID={testID ? `${testID}-day-${day}` : undefined}
                  >
                    <Text tabular align="center" style={{ color: chosen ? theme.colors.onPrimary : blocked ? theme.colors.textDisabled : theme.colors.text }}>
                      {dates.day(day, 'd')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
      {error ? (
        <Text variant="small" style={{ color: semantic.error.hover }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" color="textSecondary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  field: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingStart: spacing.lg, paddingEnd: spacing.sm, gap: spacing.sm },
  open: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  calendar: { borderWidth: 1, padding: spacing.md, gap: spacing.xs, maxWidth: 360 },
  week: { flexDirection: 'row' },
  cell: { flex: 1, minHeight: 40 },
  day: { alignItems: 'center', justifyContent: 'center' },
});
