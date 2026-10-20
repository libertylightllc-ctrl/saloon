/**
 * saloqo.com/booking/<token>: the customer's own booking, opened right after booking and from its saved link. Shows
 * when and what; directions, a call, a WhatsApp message to the salon from the customer's own WhatsApp (free); cancel
 * before the salon's cut-off.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { waNumber } from '@/features/sales/whatsappText';
import { dialCodeOf } from '@/lib/countries';
import { isCurrency } from '@/lib/currencies';
import { formatMoney } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import { spacing, ThemeProvider } from '@/theme';
import { Button, Card, EmptyState, FormError, HeaderBand, Icon, QueryState, Screen, StatusPill, Text } from '@/ui';

import { useCancelBooking, useMyBooking, type MyBooking } from './api';
import { SalonCard } from './SalonCard';

export function MyBookingScreen({ token }: { token: string }) {
  const { t } = useTranslation();
  const booking = useMyBooking(token);
  return (
    <QueryState query={booking}>
      {(b) =>
        b ? (
          <ThemeProvider mode={b.salon.mode}>
            <BookingDetails token={token} booking={b} />
          </ThemeProvider>
        ) : (
          <Screen header={<HeaderBand title={t('booking.mine')} />}>
            <EmptyState illustration="no-results" message={t('booking.linkNotFound')} />
          </Screen>
        )
      }
    </QueryState>
  );
}

function BookingDetails({ token, booking: b }: { token: string; booking: MyBooking }) {
  const { t } = useTranslation();
  const router = useRouter();
  const dates = useDates();
  const cancel = useCancelBooking(token);
  const [confirm, setConfirm] = useState(false);
  const currency = isCurrency(b.salon.currency) ? b.salon.currency : 'AED';
  const when = dates.at(b.scheduled_at, b.salon.timezone, 'EEEE d MMMM · HH:mm');
  const booked = b.status === 'booked';
  const salonWhatsApp = waNumber(b.salon.phone, dialCodeOf(b.salon.country_code));
  const message = t('booking.whatsappText', {
    name: b.customer_name ?? '',
    services: b.services.map((s) => s.name).join(', '),
    when,
  });

  return (
    <Screen header={<HeaderBand title={t('booking.mine')} subtitle={b.salon.business_name} />}>
      <View style={styles.body}>
        <Card variant="tinted" style={styles.card} testID="my-booking">
          <View style={styles.row}>
            <Icon name={booked ? 'circleCheck' : 'calendarX'} size={28} />
            <View style={styles.flex}>
              <Text variant="h3">{t(booked ? 'booking.booked' : `booking.status.${b.status}`)}</Text>
              <Text weight="semibold" testID="my-booking-when">
                {when}
              </Text>
            </View>
            {booked ? null : <StatusPill tone="neutral" label={t(`booking.status.${b.status}`)} />}
          </View>
          {b.services.map((s) => (
            <View key={s.name} style={styles.line}>
              <Text style={styles.flex}>{s.name}</Text>
              <Text tabular>{formatMoney(s.price_minor, currency)}</Text>
            </View>
          ))}
          {b.staff_name ? <Text color="textSecondary">{t('booking.with', { name: b.staff_name })}</Text> : null}
          {booked ? (
            <Text variant="small" color="textSecondary">
              {t('booking.keepLink')}
            </Text>
          ) : null}
        </Card>

        <SalonCard salon={b.salon} />

        {booked && salonWhatsApp ? (
          <Button
            label={t('booking.whatsappSalon')}
            icon="messageCircle"
            variant="secondary"
            onPress={() => void Linking.openURL(`https://wa.me/${salonWhatsApp}?text=${encodeURIComponent(message)}`)}
            testID="booking-whatsapp"
          />
        ) : null}
        {booked && b.can_cancel && confirm ? (
          <Card variant="outlined" style={styles.card}>
            <Text>{t('booking.cancelText', { when })}</Text>
            <Button
              label={t('booking.cancelConfirm')}
              loading={cancel.isPending}
              onPress={() => cancel.mutate(undefined, { onSettled: () => setConfirm(false) })}
              testID="booking-cancel-confirm"
            />
            <Button label={t('booking.keep')} variant="ghost" onPress={() => setConfirm(false)} />
          </Card>
        ) : booked && b.can_cancel ? (
          <Button label={t('booking.cancel')} icon="calendarX" variant="ghost" onPress={() => setConfirm(true)} testID="booking-cancel" />
        ) : booked ? (
          <Text variant="small" color="textSecondary" testID="booking-too-late">
            {t('booking.tooLate', { count: b.salon.cancel_cutoff_hours })}
          </Text>
        ) : null}
        {b.salon.slug ? (
          <Button
            label={t('booking.again')}
            icon="calendarPlus"
            variant="outline"
            onPress={() => router.push({ pathname: '/b/[slug]', params: { slug: b.salon.slug! } })}
            testID="booking-again"
          />
        ) : null}
        <FormError error={cancel.error} />
      </View>

    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  line: { flexDirection: 'row', gap: spacing.md },
});
