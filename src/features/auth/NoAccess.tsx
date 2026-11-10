import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { Button, HeaderBand, Illustration, Screen, Text } from '@/ui';

/** A page this login may not open (brief Part B, rule 2): it says so instead of showing the page. */
export function NoAccess() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen header={<HeaderBand title={t('noAccess.header')} onBack />}>
      <View style={styles.body} testID="no-access">
        <Illustration name="no-access" size={140} />
        <Text variant="h3" align="center">
          {t('noAccess.title')}
        </Text>
        <Text align="center" color="textSecondary" style={styles.message}>
          {t('noAccess.body')}
        </Text>
        <Button label={t('noAccess.home')} variant="secondary" size="md" onPress={() => router.replace('/')} testID="no-access-home" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing['3xl'] },
  message: { maxWidth: 320 },
});
