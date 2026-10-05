import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { usePublicPrices } from '@/features/plan/api';
import { isCurrency } from '@/lib/currencies';
import { formatMoney } from '@/lib/money';
import { spacing, useTheme } from '@/theme';
import { Text } from '@/ui';

/**
 * The plan price on the website — the terms charge "the price shown on our website" — read from the same settings the
 * salons are billed from, so the two never disagree. Hidden until it loads.
 */
export function LandingPricing({ wide }: { wide: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const prices = usePublicPrices();
  const p = prices.data;
  if (!p) return null;
  const money = (minor: number, currency: string) => (isCurrency(currency) ? formatMoney(minor, currency) : `${currency} ${minor / 100}`);
  const tiers = [
    { key: 'uae', price: money(p.price_per_branch_minor, p.currency) },
    { key: 'elsewhere', price: money(p.intl_price_per_branch_minor, p.intl_currency) },
  ] as const;
  return (
    <View style={styles.block} testID="landing-pricing">
      <Text variant="h1" align="center">
        {t('auth.landing.pricing.title')}
      </Text>
      <View style={[styles.tiers, wide && styles.tiersRow]}>
        {tiers.map((tier) => (
          <View key={tier.key} style={[styles.tier, wide && styles.flex, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg }]}>
            <Text variant="bodyStrong" color="textSecondary">
              {t(`auth.landing.pricing.${tier.key}`)}
            </Text>
            <Text variant="display" tabular testID={`landing-price-${tier.key}`}>
              {tier.price}
            </Text>
            <Text color="textSecondary">{t('auth.landing.pricing.per')}</Text>
          </View>
        ))}
      </View>
      <Text align="center" color="textSecondary">
        {t('auth.landing.pricing.note')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.lg },
  tiers: { gap: spacing.md },
  tiersRow: { flexDirection: 'row' },
  tier: { padding: spacing.xl, gap: spacing.xs, alignItems: 'center' },
  flex: { flex: 1 },
});
