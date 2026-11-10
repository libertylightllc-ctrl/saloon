import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { formatMoney, type Minor } from '@/lib/money';
import { spacing } from '@/theme';
import { Card, IconButton, MoneyInput, Stepper, Text } from '@/ui';

import type { BasketLine } from './basket';

/**
 * The basket's lines with their quantities. Logins that may change a service's price at checkout (owner; a manager
 * with a reason; the front desk with a manager's PIN) get a pencil that opens the price under the line.
 */
export function CheckoutLines({
  lines,
  onQtyChange,
  onPriceChange,
  canChangePrice,
  listPrice,
}: {
  lines: BasketLine[];
  onQtyChange: (key: string, qty: number) => void;
  onPriceChange?: (key: string, price: Minor) => void;
  canChangePrice: boolean;
  listPrice: (serviceId: string) => Minor | undefined;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <Card variant="outlined" style={styles.card}>
      {lines.map((line) => {
        const list = line.serviceId ? listPrice(line.serviceId) : undefined;
        const editable = canChangePrice && !!onPriceChange && line.kind === 'service';
        return (
          <View key={line.key} style={styles.item}>
            <View style={styles.line}>
              <View style={styles.flex}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {line.name}
                </Text>
                <Text variant="small" color={line.priceChanged ? 'primaryText' : 'textSecondary'} tabular>
                  {formatMoney(line.unitPriceMinor * line.qty)}
                  {line.priceChanged && list !== undefined ? ` · ${t('sale.listPrice', { amount: formatMoney(list) })}` : ''}
                </Text>
              </View>
              {editable ? (
                <IconButton
                  icon="pencil"
                  variant="plain"
                  accessibilityLabel={t('sale.changePriceOf', { name: line.name })}
                  onPress={() => setEditing(editing === line.key ? null : line.key)}
                  testID={`price-edit-${line.name}`}
                />
              ) : null}
              <Stepper value={line.qty} onChange={(n) => onQtyChange(line.key, n)} itemLabel={line.name} showAddAtZero={false} />
            </View>
            {editable && editing === line.key ? (
              <MoneyInput
                label={t('sale.priceFor', { name: line.name })}
                value={line.unitPriceMinor}
                onChange={(v) => onPriceChange!(line.key, v ?? 0)}
                testID={`price-${line.name}`}
              />
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  item: { gap: spacing.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
