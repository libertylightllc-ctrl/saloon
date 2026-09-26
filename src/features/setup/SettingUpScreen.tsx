import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { brand } from '@/config/brand';
import { spacing } from '@/theme';
import { Illustration, Screen, Text } from '@/ui';

/** Shown on a public web address before a hosted database is connected — never a sign-in that cannot work. */
export function SettingUpScreen() {
  const { t } = useTranslation();
  return (
    <Screen background="gradient">
      <View style={styles.body} testID="setting-up">
        <Illustration name="promo-setup" />
        <Text variant="h2" align="center">
          {brand.appName}
        </Text>
        <Text variant="h4" align="center">
          {t('settingUp.title', { name: brand.appName })}
        </Text>
        <Text align="center" color="textSecondary">
          {t('settingUp.body')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing['3xl'] },
});
