/** MonthSwitcher, DateStrip and TimeSlotGrid — the Barber kit's "Select Date & Time". */
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { shiftMonth, type BusinessDate, type MonthKey } from '@/lib/dates';
import { useDates } from '@/lib/useDates';
import { spacing, useTheme } from '@/theme';

import { useOnBand } from './layoutContext';
import { IconButton } from './IconButton';
import { Text } from './Text';

export function MonthSwitcher({
  value,
  onChange,
  onBand: onBandProp,
}: {
  value: MonthKey;
  onChange: (month: MonthKey) => void;
  onBand?: boolean;
}) {
  const { t } = useTranslation();
  const dates = useDates();
  const insideBand = useOnBand();
  const onBand = onBandProp ?? insideBand;
  return (
    <View style={styles.month}>
      <IconButton
        icon="chevronLeft"
        size={32}
        variant={onBand ? 'surface' : 'tinted'}
        accessibilityLabel={t('common.previousMonth')}
        onPress={() => onChange(shiftMonth(value, -1))}
      />
      <Text variant="h4" align="center" color={onBand ? 'onPrimary' : 'text'} style={styles.flex}>
        {dates.day(`${value}-01`, 'MMMM yyyy')}
      </Text>
      <IconButton
        icon="chevronRight"
        size={32}
        variant={onBand ? 'surface' : 'tinted'}
        accessibilityLabel={t('common.nextMonth')}
        onPress={() => onChange(shiftMonth(value, 1))}
      />
    </View>
  );
}

export function DateStrip({
  dates,
  value,
  onChange,
}: {
  dates: readonly BusinessDate[];
  value: BusinessDate;
  onChange: (date: BusinessDate) => void;
}) {
  const theme = useTheme();
  const { colors } = theme;
  const names = useDates();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {dates.map((date) => {
        const selected = date === value;
        return (
          <Pressable
            key={date}
            testID={`date-${date}`}
            onPress={() => onChange(date)}
            accessibilityRole="button"
            aria-selected={selected}
            accessibilityLabel={names.day(date, 'EEEE d MMMM')}
            style={[
              styles.day,
              {
                borderRadius: theme.radius.md,
                backgroundColor: selected ? colors.primaryAction : colors.surface,
                borderColor: selected ? colors.primaryAction : colors.border,
              },
            ]}
          >
            <Text
              variant="small"
              align="center"
              style={{ color: selected ? colors.onPrimary : colors.textSecondary }}
            >
              {names.day(date, 'EEE')}
            </Text>
            <Text
              variant="h3"
              align="center"
              tabular
              style={{ color: selected ? colors.onPrimary : colors.text }}
            >
              {names.day(date, 'd')}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export function TimeSlotGrid({
  slots,
  value,
  onChange,
}: {
  slots: readonly TimeSlot[];
  value?: string;
  onChange: (time: string) => void;
}) {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <View style={styles.grid}>
      {slots.map((slot) => {
        const selected = slot.time === value;
        return (
          <Pressable
            key={slot.time}
            testID={`slot-${slot.time}`}
            disabled={!slot.available}
            onPress={() => onChange(slot.time)}
            accessibilityRole="button"
            aria-selected={selected}
            aria-disabled={!slot.available}
            accessibilityLabel={slot.time}
            style={[
              styles.slot,
              {
                borderRadius: theme.radius.button,
                backgroundColor: selected
                  ? colors.primaryAction
                  : slot.available
                    ? colors.surface
                    : colors.inputFill,
                borderColor: selected
                  ? colors.primaryAction
                  : slot.available
                    ? colors.border
                    : colors.inputFill,
              },
            ]}
          >
            <Text
              variant="bodyStrong"
              align="center"
              tabular
              style={[
                {
                  color: selected
                    ? colors.onPrimary
                    : slot.available
                      ? colors.text
                      : colors.textDisabled,
                },
                !slot.available && styles.strike,
              ]}
            >
              {slot.time}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  month: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  strip: { gap: spacing.sm },
  day: { width: 56, height: 72, borderWidth: 1, justifyContent: 'center', gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: { flexBasis: '22%', flexGrow: 1, height: 44, borderWidth: 1, justifyContent: 'center' },
  strike: { textDecorationLine: 'line-through' },
});
