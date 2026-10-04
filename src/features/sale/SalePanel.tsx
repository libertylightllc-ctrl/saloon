import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';
import { Button, Icon, Text } from '@/ui';

import { CheckoutForm, type CheckoutProps } from './CheckoutSheet';

export const PANEL_WIDTH = 380;

/** Tablets and computers: the sale being built, always open beside the services (Option A / B). */
export function SalePanel({ onClear, ...props }: CheckoutProps & { onClear: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { colors } = theme;
  return (
    <View
      style={[styles.panel, { backgroundColor: colors.surface, borderRadius: theme.radius.lg, borderColor: colors.divider }]}
      testID="sale-panel"
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Text variant="h3" accessibilityRole="header" style={styles.flex}>
            {t('sale.current')}
          </Text>
          {props.lines.length ? <Button label={t('sale.clear')} variant="ghost" size="sm" onPress={onClear} testID="sale-clear" /> : null}
        </View>
        {props.lines.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.primary50, borderRadius: theme.radius.md }]}>
            <Icon name="receipt" size={28} color={colors.primaryText} />
            <Text color="textOnTint" align="center">
              {t('sale.subtitle')}
            </Text>
          </View>
        ) : (
          <CheckoutForm {...props} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  panel: { width: PANEL_WIDTH, alignSelf: 'stretch', borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  body: { padding: spacing.xl, gap: spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing['2xl'] },
});
