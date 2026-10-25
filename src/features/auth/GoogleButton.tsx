import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { googleBrand as G, spacing, useTheme } from '@/theme';
import { FormError, Text } from '@/ui';

import { useGoogleEnabled, useGoogleSignIn } from './google';

/** Google's "G", as Google draws it for sign-in buttons. */
function GoogleMark() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48" accessible={false}>
      <Path fill={G.red} d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill={G.blue} d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill={G.yellow} d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill={G.green} d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

/**
 * "Continue with Google" (Google's light button: white, grey border, the four-colour "G") and an "or" line; nothing at
 * all until Google is switched on in Supabase.
 */
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
          { borderColor: G.border, backgroundColor: G.surface, borderRadius: theme.radius.md },
          (pressed || google.isPending) && styles.pressed,
        ]}
      >
        <GoogleMark />
        <Text variant="bodyStrong" style={{ color: G.text }}>
          {t('auth.google.action')}
        </Text>
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
  button: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, borderWidth: 1 },
  pressed: { opacity: 0.8 },
  or: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});
