import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useTax } from '@/features/tax/useTax';
import { formatMoney } from '@/lib/money';
import { spacing } from '@/theme';
import { Text } from '@/ui';

import type { Totals } from './basket';

/** Subtotal, discount, tax (and a second tax), tip, deposit and the amount due. */
export function CheckoutTotals({ totals }: { totals: Totals }) {
  const { t } = useTranslation();
  const tax = useTax();
  const row = (label: string, value: string, strong = false, testID?: string) => (
    <View style={styles.totalRow}>
      <Text variant={strong ? 'h4' : 'body'} color={strong ? 'text' : 'textSecondary'} style={styles.flex}>
        {label}
      </Text>
      <Text variant={strong ? 'h3' : 'bodyStrong'} weight={strong ? 'bold' : 'medium'} tabular testID={testID}>
        {value}
      </Text>
    </View>
  );


  return (
    <View style={styles.totals}>
      {row(t('sale.subtotal'), formatMoney(totals.subtotal))}
      {totals.discount ? row(t('sale.discount'), formatMoney(-totals.discount)) : null}
      {row(
        tax.rule ? tax.label : t('sale.vat'),
        !tax.rule
          ? t('sale.vatNotApplied')
          : totals.taxAdded
            ? formatMoney(totals.vat - totals.tax2)
            : t('sale.vatIncluded', { amount: formatMoney(totals.vat - totals.tax2) }),
        false,
        'checkout-vat',
      )}
      {tax.rule && tax.second
        ? row(
            tax.second.label,
            totals.taxAdded ? formatMoney(totals.tax2) : t('sale.vatIncluded', { amount: formatMoney(totals.tax2) }),
            false,
            'checkout-tax2',
          )
        : null}
      {totals.tip ? row(t('sale.tip'), formatMoney(totals.tip)) : null}
      {totals.depositApplied ? row(t('sale.depositApplied'), formatMoney(-totals.depositApplied)) : null}
      {row(t('sale.amountDue'), formatMoney(totals.due), true, 'checkout-due')}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  totals: { gap: spacing.xs },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
