import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { spacing, useTheme } from '@/theme';
import { Button, FormError, Icon, Text, TextField, useToast } from '@/ui';

import { pickCover, useSetCover, useSetInstagram } from './bookingProfile';
import { logoUrl } from './logo';

/**
 * Branch settings → Online booking, once the page is on (website brief 5.1): a cover photo for the top of the booking
 * page and the salon's Instagram. Saved at once.
 */
export function BookingProfileFields() {
  const { t } = useTranslation();
  const theme = useTheme();
  const toast = useToast();
  const { business, branch } = useWorkspace();
  const cover = useSetCover(business.id, branch.id);
  const instagram = useSetInstagram(branch.id);
  const [handle, setHandle] = useState(branch.instagram ? `@${branch.instagram}` : '');
  const [pickError, setPickError] = useState<unknown>(null);
  const [picking, setPicking] = useState(false);

  const add = () => {
    setPickError(null);
    setPicking(true);
    pickCover()
      .then((photo) => photo && cover.mutate(photo, { onSuccess: () => toast(t('booking.owner.coverSaved')) }))
      .catch(setPickError)
      .finally(() => setPicking(false));
  };
  const saved = branch.instagram ? `@${branch.instagram}` : '';

  return (
    <View style={styles.block} testID="booking-profile">
      <Text variant="bodyStrong">{t('booking.owner.cover')}</Text>
      <Text variant="small" color="textSecondary">
        {t('booking.owner.coverHint')}
      </Text>
      <View style={[styles.cover, { backgroundColor: theme.colors.surface, borderColor: theme.colors.divider, borderRadius: theme.radius.md }]}>
        {branch.cover_path ? (
          <Image source={{ uri: logoUrl(branch.cover_path) }} style={styles.photo} resizeMode="cover" accessibilityLabel={t('booking.owner.cover')} testID="booking-cover-preview" />
        ) : (
          <Icon name="image" size={28} color={theme.colors.textSecondary} />
        )}
      </View>
      <View style={styles.buttons}>
        <Button
          label={t(branch.cover_path ? 'booking.owner.coverChange' : 'booking.owner.coverAdd')}
          icon="image"
          variant="outline"
          size="md"
          loading={picking || (cover.isPending && cover.variables !== null)}
          onPress={add}
          testID="booking-cover-add"
        />
        {branch.cover_path ? (
          <Button
            label={t('booking.owner.coverRemove')}
            icon="trash"
            variant="ghost"
            size="md"
            loading={cover.isPending && cover.variables === null}
            onPress={() => cover.mutate(null, { onSuccess: () => toast(t('booking.owner.coverRemoved')) })}
            testID="booking-cover-remove"
          />
        ) : null}
      </View>
      <FormError error={pickError ?? cover.error} />

      <TextField
        label={t('booking.owner.instagram')}
        hint={t('booking.owner.instagramHint')}
        value={handle}
        onChangeText={setHandle}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={80}
        placeholder={t('booking.owner.instagramPlaceholder')}
        testID="booking-instagram"
      />
      {handle.trim() !== saved ? (
        <Button
          label={t('booking.owner.saveInstagram')}
          size="md"
          loading={instagram.isPending}
          onPress={() =>
            instagram.mutate(handle, {
              onSuccess: (kept) => {
                setHandle(kept ? `@${kept}` : '');
                toast(t(kept ? 'booking.owner.instagramSaved' : 'booking.owner.instagramRemoved'));
              },
            })
          }
          testID="booking-instagram-save"
        />
      ) : null}
      <FormError error={instagram.error} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  cover: { width: '100%', aspectRatio: 1200 / 630, maxWidth: 420, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
