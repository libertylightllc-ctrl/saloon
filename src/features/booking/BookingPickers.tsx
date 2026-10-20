/** The booking page's choices: services, who, which day, what time. */
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { type CurrencyCode } from '@/lib/currencies';
import { shiftBusinessDate, type BusinessDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import { spacing, useTheme } from '@/theme';
import { Chip, Icon, Text } from '@/ui';

import type { BookingPage } from './api';

/** How many days ahead the page offers (the server allows 30). */
export const DAYS_AHEAD = 14;

export function ServiceList({
  page,
  currency,
  picked,
  onToggle,
}: {
  page: BookingPage;
  currency: CurrencyCode;
  picked: string[];
  onToggle: (id: string) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const groups = page.categories
    .map((c) => ({ ...c, services: page.services.filter((s) => s.category_id === c.id) }))
    .filter((g) => g.services.length > 0);
  return (
    <View style={styles.list}>
      {groups.map((g) => (
        <View key={g.id} style={styles.group}>
          <Text variant="small" weight="semibold" color="textSecondary" style={styles.caps}>
            {g.name}
          </Text>
          {g.services.map((s) => {
            const on = picked.includes(s.id);
            return (
              <Pressable
                key={s.id}
                role="checkbox"
                aria-checked={on}
                onPress={() => onToggle(s.id)}
                testID={`booking-service-${s.name}`}
                style={[
                  styles.service,
                  { borderColor: on ? theme.colors.primary500 : theme.colors.border, borderRadius: theme.radius.md },
                  on && { backgroundColor: theme.colors.primary50 },
                ]}
              >
                <View style={styles.flex}>
                  <Text weight="semibold">{s.name}</Text>
                  {s.duration_min ? (
                    <Text variant="small" color="textSecondary">
                      {t('booking.minutes', { count: s.duration_min })}
                    </Text>
                  ) : null}
                </View>
                <Text weight="semibold" tabular>
                  {formatMoney(s.price_minor, currency)}
                </Text>
                <View
                  style={[
                    styles.tick,
                    { borderColor: on ? theme.colors.primary500 : theme.colors.border, borderRadius: theme.radius.sm },
                    on && { backgroundColor: theme.colors.primaryAction },
                  ]}
                >
                  {on ? <Icon name="check" size={14} color={theme.colors.onPrimary} strokeWidth={2.6} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Anyone, or one person by first name. */
export function StaffChips({ page, value, onChange }: { page: BookingPage; value: string | null; onChange: (id: string | null) => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.chips} accessibilityRole="radiogroup">
      <Chip label={t('booking.anyone')} selected={value === null} onPress={() => onChange(null)} testID="booking-staff-any" />
      {page.staff.map((s) => (
        <Chip key={s.id} label={s.name} selected={value === s.id} onPress={() => onChange(s.id)} testID={`booking-staff-${s.name}`} />
      ))}
    </View>
  );
}

/** The next days, today first; days the salon is closed cannot be picked. */
export function DayChips({ page, value, onChange }: { page: BookingPage; value: BusinessDate | null; onChange: (d: BusinessDate) => void }) {
  const { t } = useTranslation();
  const dates = useDates();
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => shiftBusinessDate(page.salon.today, i));
  const open = (d: BusinessDate) => page.salon.open_days.includes(new Date(`${d}T12:00:00Z`).getUTCDay());
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
      {days.map((d, i) =>
        open(d) ? (
          <Chip
            key={d}
            label={i === 0 ? t('booking.today') : i === 1 ? t('booking.tomorrow') : dates.day(d, 'EEE d MMM')}
            selected={value === d}
            onPress={() => onChange(d)}
            testID={`booking-day-${d}`}
          />
        ) : null,
      )}
    </ScrollView>
  );
}

/** The free start times, in the salon's time zone and the person's own clock (12 or 24 hours). */
export function TimeGrid({
  slots,
  timeZone,
  value,
  onChange,
}: {
  slots: { slot: string; starts_at: string }[];
  timeZone: string;
  value: string | null;
  onChange: (startsAt: string) => void;
}) {
  const dates = useDates();
  return (
    <View style={styles.chips}>
      {slots.map((s) => (
        <Chip
          key={s.starts_at}
          label={dates.at(s.starts_at, timeZone, 'HH:mm')}
          selected={value === s.starts_at}
          onPress={() => onChange(s.starts_at)}
          testID={`booking-time-${s.slot}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.lg },
  group: { gap: spacing.sm },
  caps: { textTransform: 'uppercase', letterSpacing: 0.6 },
  service: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1 },
  flex: { flex: 1, gap: 2 },
  tick: { width: 22, height: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  days: { gap: spacing.sm, paddingVertical: 2 },
});
