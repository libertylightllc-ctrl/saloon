import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';
import { FormError, Text } from '@/ui';

import { useGoogleEnabled, useGoogleSignIn } from './google';

/** "Continue with Google" and an "or" line; nothing at all until Google is switched on in Supabase. */
export function GoogleButton() {
  const { t } = useTranslation();
  const theme = useTheme();
  const enabled = useGoogleEnabled();
  const google = useGoogleSignIn();
  if (!enabled.data) return null;
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('auth.google.action')}
        disabled={google.isPending}
        onPress={() => google.mutate()}
        testID="google-sign-in"
        style={({ pressed }) => [
          styles.button,
          { borderColor: theme.colors.divider, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md },
          (pressed || google.isPending) && styles.pressed,
        ]}
      >
        {/* A plain "G": the app draws no third-party logos. */}
        <View style={[styles.g, { backgroundColor: theme.colors.primary50 }]}>
          <Text variant="bodyStrong" color="primaryText">
            {t('auth.google.mark')}
          </Text>
        </View>
        <Text variant="bodyStrong">{t('auth.google.action')}</Text>
      </Pressable>
      <FormError error={google.error} />
      <View style={styles.or}>
        <View style={[styles.line, { backgroundColor: theme.colors.divider }]} />
        <Text variant="small" color="textSecondary">
          {t('auth.google.or')}
        </Text>
        <View style={[styles.line, { backgroundColor: theme.colors.divider }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  button: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1 },
  pressed: { opacity: 0.8 },
  g: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  or: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});
