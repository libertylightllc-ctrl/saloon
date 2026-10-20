import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, Share, StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { bookingUrl, useSetOnlineBooking } from '@/features/booking/api';
import { spacing, useTheme } from '@/theme';
import { Button, Card, FormError, SwitchRow, Text, TextField, useToast } from '@/ui';

/**
 * Branch settings → Online booking (owner, 2026-10-20): switch the salon's booking page on, then copy, share or open
 * its link (saloqo.com/b/<link>) and change the link if wanted. Saved at once.
 */
export function OnlineBookingCard() {
  const { t } = useTranslation();
  const theme = useTheme();
  const toast = useToast();
  const { branch } = useWorkspace();
  const set = useSetOnlineBooking(branch.id);
  const on = (branch.settings as Record<string, unknown>).online_booking === true;
  const url = branch.booking_slug ? bookingUrl(branch.booking_slug) : null;
  const [editing, setEditing] = useState(false);
  const [slug, setSlug] = useState(branch.booking_slug ?? '');

  const copy = async (link: string) => {
    if (Platform.OS === 'web' && navigator.clipboard) {
      await navigator.clipboard.writeText(link);
      toast(t('booking.owner.copied'));
    } else {
      await Share.share({ message: link });
    }
  };

  return (
    <Card variant="outlined" style={styles.card} testID="online-booking">
      <SwitchRow
        label={t('booking.owner.switch')}
        hint={t('booking.owner.hint')}
        value={on}
        disabled={set.isPending}
        onChange={(value) =>
          set.mutate({ on: value }, { onSuccess: () => toast(t(value ? 'booking.owner.turnedOn' : 'booking.owner.turnedOff')) })
        }
        testID="online-booking-switch"
      />
      {on && url ? (
        <View style={styles.block}>
          <View style={[styles.link, { backgroundColor: theme.colors.primary50, borderRadius: theme.radius.md }]}>
            <Text weight="semibold" selectable testID="online-booking-link">
              {url.replace(/^https:\/\/(www\.)?/, '')}
            </Text>
          </View>
          <Text variant="small" color="textSecondary">
            {t('booking.owner.shareHint')}
          </Text>
          <View style={styles.buttons}>
            <Button label={t('booking.owner.copy')} icon="copy" variant="outline" size="md" onPress={() => void copy(url)} testID="online-booking-copy" />
            {Platform.OS !== 'web' ? (
              <Button label={t('booking.owner.share')} icon="share" variant="outline" size="md" onPress={() => void Share.share({ message: url })} />
            ) : null}
            <Button label={t('booking.owner.open')} icon="externalLink" variant="outline" size="md" onPress={() => void Linking.openURL(url)} testID="online-booking-open" />
            <Button label={t('booking.owner.change')} icon="pencil" variant="ghost" size="md" onPress={() => {
                setSlug(branch.booking_slug ?? '');
                setEditing(!editing);
              }} testID="online-booking-change" />
          </View>
          {editing ? (
            <View style={styles.block}>
              <TextField
                label={t('booking.owner.linkLabel')}
                hint={t('booking.owner.linkHint')}
                value={slug}
                onChangeText={(v) => setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                autoCapitalize="none"
                maxLength={40}
                testID="online-booking-slug"
              />
              <Button
                label={t('booking.owner.saveLink')}
                size="md"
                loading={set.isPending}
                onPress={() =>
                  set.mutate({ on, slug }, { onSuccess: () => { setEditing(false); toast(t('booking.owner.linkSaved')); } })
                }
                testID="online-booking-save-link"
              />
            </View>
          ) : null}
        </View>
      ) : null}
      <FormError error={set.error} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  block: { gap: spacing.sm },
  link: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
