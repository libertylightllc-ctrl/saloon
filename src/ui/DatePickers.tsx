/** MonthSwitcher, DateStrip and TimeSlotGrid — the Barber kit's "Select Date & Time". */
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { shiftMonth, type BusinessDate, type MonthKey } from '@/lib/dates';
import { spacing, useTheme } from '@/theme';

import { useOnBand } from './layoutContext';
import { IconButton } from './IconButton';
import { Text } from './Text';

const toDate = (date: BusinessDate) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};

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
        {format(toDate(`${value}-01`), 'MMMM yyyy')}
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
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {dates.map((date) => {
        const selected = date === value;
        const day = toDate(date);
        return (
          <Pressable
            key={date}
            onPress={() => onChange(date)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={format(day, 'EEEE d MMMM')}
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
              {format(day, 'EEE')}
            </Text>
            <Text
              variant="h3"
              align="center"
              tabular
              style={{ color: selected ? colors.onPrimary : colors.text }}
            >
              {format(day, 'd')}
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
            disabled={!slot.available}
            onPress={() => onChange(slot.time)}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: !slot.available }}
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
