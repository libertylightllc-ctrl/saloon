import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import type { SaleResult } from '@/features/sales/api';
import { useShareReceipt } from '@/features/sales/useReceipt';
import { formatMoney } from '@/lib/money';
import { spacing } from '@/theme';
import { BottomSheet, Button, FormError, StatusPill, SuccessCheck, Text } from '@/ui';

export function SaleDoneSheet({
  sale,
  onClose,
}: {
  sale: (SaleResult & { method: string }) | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const share = useShareReceipt();
  return (
    <BottomSheet open={sale !== null} onClose={onClose}>
      {sale ? (
        <View style={styles.done} testID="sale-done">
          <SuccessCheck />
          <Text variant="h3" align="center">
            {t('sale.doneTitle', { number: `#${sale.number}` })}
          </Text>
          <Text variant="display" align="center" tabular testID="sale-done-total">
            {formatMoney(sale.total_minor)}
          </Text>
          <Text align="center" color="textSecondary">
            {t('sale.paidWith', { method: t(`sale.methods.${sale.method}` as 'sale.methods.cash') })}
          </Text>
          {sale.warnings.map((w) => (
            <StatusPill
              key={w}
              tone="warning"
              label={t('sale.lowStock', { items: w.replace(/^low_stock:\s*/, '') })}
            />
          ))}
        </View>
      ) : null}
      <FormError error={share.error} />
      {sale ? (
        <Button
          label={t(Platform.OS === 'web' ? 'sale.printReceipt' : 'sale.shareReceipt')}
          icon={Platform.OS === 'web' ? 'printer' : 'share'}
          variant="secondary"
          loading={share.isPending}
          onPress={() => share.mutate(sale.sale_id)}
          testID="share-receipt"
        />
      ) : null}
      <Button label={t('sale.newSale')} onPress={onClose} testID="new-sale" />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ done: { alignItems: 'center', gap: spacing.sm } });
