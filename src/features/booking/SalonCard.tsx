import { useTranslation } from 'react-i18next';
import { Image, Linking, StyleSheet, View } from 'react-native';

import { instagramUrl } from '@/features/settings/bookingProfile';
import { logoUrl } from '@/features/settings/logo';
import { spacing, useTheme } from '@/theme';
import { Button, Card, Icon, Text } from '@/ui';

import type { BookingSalon } from './api';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
/** The week as people read it: Monday first. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

/** "Open Mon–Sat", "Open Mon, Tue, Thu–Sat", "Open every day" (0 = Sunday); null without days. */
export function openDaysText(days: number[] | null | undefined, t: (key: string, values?: Record<string, unknown>) => string): string | null {
  if (!days?.length) return null;
  if (WEEK.every((d) => days.includes(d))) return t('booking.everyDay');
  const runs: number[][] = [];
  for (const d of WEEK.filter((x) => days.includes(x))) {
    const last = runs[runs.length - 1];
    if (last && WEEK.indexOf(last[last.length - 1]!) === WEEK.indexOf(d) - 1) last.push(d);
    else runs.push([d]);
  }
  const name = (d: number) => t(`common.days.${DAY_KEYS[d]}`);
  const parts = runs.map((r) => (r.length >= 3 ? `${name(r[0]!)}–${name(r[r.length - 1]!)}` : r.map(name).join(', ')));
  return t('booking.openDays', { days: parts.join(', ') });
}

/** Google Maps finds the salon by its name and address (no map pin is stored yet). */
export function mapsUrl(salon: Pick<BookingSalon, 'business_name' | 'branch_name' | 'address'>): string {
  const query = [salon.business_name, salon.branch_name !== salon.business_name ? salon.branch_name : null, salon.address]
    .filter(Boolean)
    .join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * The salon on its public pages: the cover photo, logo, name, address and open days; directions, a call and its
 * Instagram (website brief 5.1).
 */
export function SalonCard({ salon }: { salon: BookingSalon & { open_days?: number[] } }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const days = openDaysText(salon.open_days, t as (key: string, values?: Record<string, unknown>) => string);
  return (
    <Card variant="outlined" style={styles.card} testID="booking-salon">
      {salon.cover_path ? (
        <Image
          source={{ uri: logoUrl(salon.cover_path) }}
          style={[styles.cover, { borderRadius: theme.radius.md }]}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          testID="booking-cover"
        />
      ) : null}
      <View style={styles.row}>
        {salon.logo_path ? (
          <Image source={{ uri: logoUrl(salon.logo_path) }} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
        ) : (
          <View style={[styles.mark, { backgroundColor: theme.colors.primary50, borderRadius: theme.radius.md }]}>
            <Icon name="scissors" size={22} color={theme.colors.primary500} />
          </View>
        )}
        <View style={styles.flex}>
          <Text variant="h3" accessibilityRole="header">
            {salon.business_name}
          </Text>
          {salon.branch_name !== salon.business_name ? <Text color="textSecondary">{salon.branch_name}</Text> : null}
          {salon.address ? (
            <Text variant="small" color="textSecondary">
              {salon.address}
            </Text>
          ) : null}
          {days ? (
            <Text variant="small" color="textSecondary" testID="booking-open-days">
              {days}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.buttons}>
        <Button
          label={t('booking.directions')}
          icon="mapPin"
          variant="outline"
          size="md"
          onPress={() => void Linking.openURL(mapsUrl(salon))}
          testID="booking-directions"
        />
        {salon.phone ? (
          <Button
            label={t('booking.call')}
            icon="phone"
            variant="outline"
            size="md"
            onPress={() => void Linking.openURL(`tel:${salon.phone!.replace(/[^\d+]/g, '')}`)}
            testID="booking-call"
          />
        ) : null}
        {salon.instagram ? (
          <Button
            label={t('booking.instagram')}
            icon="atSign"
            variant="outline"
            size="md"
            href={instagramUrl(salon.instagram)}
            external
            testID="booking-instagram-link"
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  cover: { width: '100%', aspectRatio: 1200 / 630 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 72, height: 48 },
  mark: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
