import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { Button, Card, Text } from '@/ui';

/**
 * Sign-up with a number an open salon's owner already gave (owner's fix list C4): "This number already has a salon on
 * Saloqo. Sign in instead?" The visitor may still go on (two people can share a number, or one owner a second salon).
 */
export function PhoneTaken({ onContinue }: { onContinue: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Card variant="outlined" style={styles.card} testID="sign-up-phone-taken">
      <Text variant="bodyStrong" accessibilityLiveRegion="polite">
        {t('auth.signUp.phoneTaken')}
      </Text>
      <View style={styles.row}>
        <Button label={t('auth.signUp.signIn')} size="md" onPress={() => router.replace('/sign-in')} testID="sign-up-phone-sign-in" />
        <Button label={t('auth.signUp.continueAnyway')} size="md" variant="ghost" onPress={onContinue} testID="sign-up-phone-continue" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
