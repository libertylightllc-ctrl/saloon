import { useTranslation } from 'react-i18next';
import { Image, Linking, StyleSheet, View } from 'react-native';

import { logoUrl } from '@/features/settings/logo';
import { spacing, useTheme } from '@/theme';
import { Button, Card, Icon, Text } from '@/ui';

import type { BookingSalon } from './api';

/** Google Maps finds the salon by its name and address (no map pin is stored yet). */
export function mapsUrl(salon: Pick<BookingSalon, 'business_name' | 'branch_name' | 'address'>): string {
  const query = [salon.business_name, salon.branch_name !== salon.business_name ? salon.branch_name : null, salon.address]
    .filter(Boolean)
    .join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** The salon on its public pages: logo, name, address; directions and a call. */
export function SalonCard({ salon }: { salon: BookingSalon }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Card variant="outlined" style={styles.card} testID="booking-salon">
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
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 72, height: 48 },
  mark: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
