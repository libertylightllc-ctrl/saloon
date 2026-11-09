import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { formatMoney } from '@/lib/money';
import { spacing } from '@/theme';
import { Button, Card, FormError, StatusPill, Text, useToast } from '@/ui';

import { useFixStockDifference, useStockCheck } from './api';

/**
 * Trial balance (owner's app check A3): when 1200 Stock and the stock's own value differ, say by how much, and let the
 * owner or accountant add one "Stock difference" entry for it after a second tap. Nothing shows while they agree.
 */
export function StockCheckNote() {
  const { t } = useTranslation();
  const toast = useToast();
  const { business } = useWorkspace();
  const check = useStockCheck(business.id);
  const fix = useFixStockDifference(business.id);
  const [confirming, setConfirming] = useState(false);
  const c = check.data;
  if (!c || c.difference_minor === 0) return null;
  const apart = formatMoney(Math.abs(c.difference_minor));
  return (
    <Card variant="outlined" style={styles.card} testID="stock-check">
      <StatusPill tone="warning" label={t('accounts.stockDiffTitle')} />
      <Text variant="small">
        {t('accounts.stockDiff', { books: formatMoney(c.books_minor), stock: formatMoney(c.stock_minor), amount: apart })}
      </Text>
      <FormError error={fix.error} />
      {confirming ? (
        <>
          <Text variant="small" color="textSecondary">
            {t('accounts.stockFixConfirm', { amount: apart })}
          </Text>
          <View style={styles.actions}>
            <Button label={t('common.cancel')} variant="outline" size="sm" onPress={() => setConfirming(false)} testID="stock-fix-cancel" />
            <Button
              label={t('accounts.stockFixDo')}
              size="sm"
              loading={fix.isPending}
              onPress={() =>
                fix.mutate(undefined, {
                  onSuccess: () => {
                    setConfirming(false);
                    toast(t('accounts.stockFixed'));
                  },
                })
              }
              testID="stock-fix-do"
            />
          </View>
        </>
      ) : (
        <Button label={t('accounts.stockFix')} variant="outline" size="sm" onPress={() => setConfirming(true)} testID="stock-fix" />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, alignItems: 'flex-start' },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
