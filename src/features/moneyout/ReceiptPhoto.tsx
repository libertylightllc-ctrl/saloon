import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { spacing, useTheme } from '@/theme';
import { BottomSheet, Button, FormError, Skeleton, Text, useToast } from '@/ui';

import { pickPhoto, useAttachReceipt, useReceiptUrl, type PickedPhoto, type ReceiptKind } from './receipts';

/** "Take photo" (phones) and "Choose photo". Errors (camera refused, too large) show under the buttons. */
export function PhotoButtons({ onPicked, loading }: { onPicked: (photo: PickedPhoto) => void; loading?: boolean }) {
  const { t } = useTranslation();
  const [error, setError] = useState<unknown>(null);
  const pick = (source: 'camera' | 'library') => {
    setError(null);
    pickPhoto(source)
      .then((photo) => photo && onPicked(photo))
      .catch(setError);
  };
  return (
    <View style={styles.block}>
      <View style={styles.buttons}>
        {Platform.OS !== 'web' ? (
          <Button label={t('receipts.takePhoto')} icon="image" variant="outline" size="md" loading={loading} onPress={() => pick('camera')} testID="receipt-camera" />
        ) : null}
        <Button label={t('receipts.choosePhoto')} icon="image" variant="outline" size="md" loading={loading} onPress={() => pick('library')} testID="receipt-choose" />
      </View>
      <FormError error={error} />
    </View>
  );
}

/** A picked photo before saving: small preview and "Remove". */
export function PickedPreview({ photo, onRemove }: { photo: PickedPhoto; onRemove: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={styles.picked}>
      <Image source={{ uri: photo.uri }} style={[styles.thumb, { borderRadius: theme.radius.md }]} accessibilityLabel={t('receipts.photo')} testID="receipt-preview" />
      <Button label={t('receipts.remove')} icon="x" variant="ghost" size="sm" onPress={onRemove} testID="receipt-remove" />
    </View>
  );
}

/** On a saved expense or bill: the photo (tap for full size), or a way to add one. */
export function ReceiptPhoto({ kind, rowId, path, canAttach }: { kind: ReceiptKind; rowId: string; path: string | null; canAttach: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const toast = useToast();
  const { business } = useWorkspace();
  const url = useReceiptUrl(path);
  const attach = useAttachReceipt(kind, business.id);
  const [full, setFull] = useState(false);

  if (path) {
    return (
      <View style={styles.block}>
        <Text variant="bodyStrong">{t('receipts.photo')}</Text>
        {url.data ? (
          <Pressable role="button" aria-label={t('receipts.view')} onPress={() => setFull(true)} testID="receipt-photo">
            <Image source={{ uri: url.data }} style={[styles.thumb, { borderRadius: theme.radius.md }]} resizeMode="cover" />
          </Pressable>
        ) : (
          <Skeleton width={120} height={120} />
        )}
        <BottomSheet open={full} onClose={() => setFull(false)} title={t('receipts.photo')}>
          {full && url.data ? <Image source={{ uri: url.data }} style={styles.full} resizeMode="contain" testID="receipt-full" /> : null}
        </BottomSheet>
      </View>
    );
  }
  if (!canAttach) return null;
  return (
    <View style={styles.block}>
      <Text variant="bodyStrong">{t('receipts.photo')}</Text>
      <Text variant="small" color="textSecondary">
        {t('receipts.none')}
      </Text>
      <PhotoButtons
        loading={attach.isPending}
        onPicked={(photo) => attach.mutate({ rowId, photo }, { onSuccess: () => toast(t('receipts.added')) })}
      />
      <FormError error={attach.error} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  picked: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 120, height: 120 },
  full: { width: '100%', height: 480 },
});
