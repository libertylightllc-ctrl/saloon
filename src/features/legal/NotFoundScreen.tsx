import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { Button, EmptyState, Screen, Text } from '@/ui';

/** An address that does not exist (a typo, an old link): a plain way home instead of the developer's route list. */
export function NotFoundScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.body} testID="not-found">
        <Text variant="h2" align="center" accessibilityRole="header">
          {t('notFound.title')}
        </Text>
        <EmptyState illustration="no-results" message={t('notFound.body')} />
        <Button label={t('notFound.home')} icon="home" onPress={() => router.replace('/')} testID="not-found-home" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', gap: spacing.xl, paddingVertical: spacing['4xl'] },
});
