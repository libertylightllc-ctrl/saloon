import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { Service } from '@/features/catalog/api';
import { recipeText } from '@/features/catalog/recipeText';
import { formatMoney } from '@/lib/money';
import { spacing, useTheme } from '@/theme';
import { Card, Icon, Stepper, Text, Thumb, type IconName } from '@/ui';

/** A service in Quick sale: duration, what it uses from stock, price and a stepper. */
export function ServiceTile({
  service,
  icon,
  index,
  qty,
  onChange,
}: {
  service: Service;
  icon: IconName;
  index: number;
  qty: number;
  onChange: (n: number) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const recipe = recipeText(service.recipe, t);
  return (
    <Card
      variant="outlined"
      padding={spacing.md}
      style={[styles.tile, qty > 0 && { borderColor: theme.colors.primary400 }]}
    >
      <View style={styles.tileTop}>
        <Thumb icon={icon} index={index} size={44} />
        <View style={styles.flex}>
          <Text variant="bodyStrong" weight="semibold" numberOfLines={2}>
            {service.name}
          </Text>
          <View style={styles.duration}>
            <Icon name="clock" size={12} color={theme.colors.textSecondary} />
            <Text variant="small" color="textSecondary">
              {t('common.minutes', { n: service.duration_min })}
            </Text>
          </View>
        </View>
      </View>
      {recipe ? (
        <Text variant="small" color="textSecondary" numberOfLines={1}>
          {recipe}
        </Text>
      ) : null}
      <Text variant="h4" weight="bold" tabular numberOfLines={1}>
        {formatMoney(service.price_minor)}
      </Text>
      <Stepper value={qty} onChange={onChange} itemLabel={service.name} fullWidth testID={`tile-${service.name}`} />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tile: { flexBasis: '46%', flexGrow: 1, gap: spacing.sm, justifyContent: 'center' },
  tileTop: { flexDirection: 'row', gap: spacing.sm },
  duration: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
