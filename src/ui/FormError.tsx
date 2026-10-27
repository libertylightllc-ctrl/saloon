import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { errorCode, errorDetail } from '@/lib/errors';
import { formatMoney } from '@/lib/money';
import { semantic, spacing, useTheme } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

/** What went wrong and what to do, from an error thrown by an RPC, Auth or an Edge Function. */
export function FormError({ error, testID }: { error: unknown; testID?: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  if (!error) return null;
  const code = errorCode(error);
  const detail = errorDetail(error);
  const message = t(`errors.${code}`);
  // "Not enough stock: Beard Color 20 ml"; "… Cash in the drawer: AED 60.00." (the drawer's minor units).
  const extra =
    code === 'insufficient_stock' && detail
      ? detail
      : code === 'not_enough_cash' && detail && /^\d+$/.test(detail)
        ? t('errors.cashInDrawer', { amount: formatMoney(Number(detail)) })
        : null;
  return (
    <View
      testID={testID ?? 'form-error'}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[styles.box, { backgroundColor: semantic.error.surface, borderRadius: theme.radius.md }]}
    >
      <Icon name="alert" size={18} color={semantic.error.pressed} />
      <Text variant="small" style={[styles.text, { color: semantic.error.pressed }]}>
        {extra ? `${message} ${extra}` : message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md },
  text: { flex: 1 },
});
