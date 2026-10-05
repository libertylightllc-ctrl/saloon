import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { StockItem } from '@/features/inventory/api';
import { qtyText } from '@/features/inventory/labels';
import { formatMoney } from '@/lib/money';
import { spacing, useTheme } from '@/theme';
import { Card, StatusPill, Stepper, Text, Thumb } from '@/ui';

/** A retail product in Quick sale: price, what is on the shelf, and a stepper. */
export function ProductTile({
  item,
  index,
  qty,
  onChange,
  width,
}: {
  item: StockItem;
  index: number;
  qty: number;
  onChange: (n: number) => void;
  /** Wider screens: the tile's exact width, so every row lines up; phones: two per row. */
  width?: number;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Card variant="outlined" padding={spacing.md} style={[styles.tile, width ? { flexBasis: width, flexGrow: 0, width } : null, qty > 0 && { borderColor: theme.colors.primary400 }]}>
      <View style={styles.top}>
        <Thumb icon="package" index={index} size={44} />
        <View style={styles.flex}>
          <Text variant="bodyStrong" weight="semibold" numberOfLines={2}>
            {item.name}
          </Text>
          <Text variant="small" color="textSecondary">
            {t('sale.inStock', { qty: qtyText(item.qty, item.unit, t) })}
          </Text>
        </View>
      </View>
      {item.low ? <StatusPill status={item.qty <= 0 ? 'out_of_stock' : 'low'} /> : null}
      {/* Price and stepper sit at the tile's foot, so a row of tiles lines up when one name takes two lines. */}
      <View style={styles.foot}>
        <Text variant="h4" weight="bold" tabular numberOfLines={1}>
          {formatMoney(item.sell_price_minor ?? 0)}
        </Text>
        <Stepper value={qty} onChange={onChange} itemLabel={item.name} fullWidth testID={`product-${item.name}`} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tile: { flexBasis: '46%', flexGrow: 1, gap: spacing.sm },
  foot: { marginTop: 'auto', gap: spacing.sm },
  top: { flexDirection: 'row', gap: spacing.sm },
});
