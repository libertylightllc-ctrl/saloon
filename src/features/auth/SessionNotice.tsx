import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppError, type ErrorCode } from '@/lib/errors';
import { semantic, spacing, useTheme } from '@/theme';
import { FormError, Icon, Text } from '@/ui';

/**
 * Why the last session ended, on the sign-in page. A deleted account is what the person asked for, so it is a
 * confirmation, not an error; everything else (a disabled login, no internet) shows as an error.
 */
export function SessionNotice({ code }: { code: ErrorCode }) {
  const { t } = useTranslation();
  const theme = useTheme();
  if (code !== 'account_deleted') return <FormError error={new AppError(code)} testID="session-notice" />;
  return (
    <View
      testID="session-notice"
      accessibilityRole="alert"
      style={[styles.box, { backgroundColor: semantic.success.surface, borderRadius: theme.radius.md }]}
    >
      <Icon name="circleCheck" size={18} color={semantic.success.pressed} />
      <Text variant="small" style={[styles.text, { color: semantic.success.pressed }]}>
        {t('errors.account_deleted')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md },
  text: { flex: 1 },
});
