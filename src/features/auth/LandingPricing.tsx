import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { usePublicPrices } from '@/features/plan/api';
import { deviceTimeZone } from '@/features/setup/CountryStep';
import { countryOf } from '@/lib/countries';
import { isCurrency } from '@/lib/currencies';
import { formatMoney } from '@/lib/money';
import { spacing, useTheme } from '@/theme';
import { Text } from '@/ui';

/**
 * The plan price on the website — the terms charge "the price shown on our website" — read from the same settings the
 * salons are billed from, so the two never disagree. Hidden until it loads. One price, the visitor's (owner,
 * 2026-10-08): the UAE price on a phone or computer set to the UAE's time zone, the international one anywhere else.
 */
function inUae(): boolean {
  const zone = deviceTimeZone();
  return zone !== null && (countryOf('AE')?.timezones.includes(zone) ?? false);
}

export function LandingPricing({ wide }: { wide: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const prices = usePublicPrices();
  const p = prices.data;
  if (!p) return null;
  const money = (minor: number, currency: string) => (isCurrency(currency) ? formatMoney(minor, currency) : `${currency} ${minor / 100}`);
  // Priced by people, per salon (owner, 2026-10-08): the base covers the first few who sign in; each one after adds.
  const uae = inUae();
  const price = uae ? money(p.price_per_branch_minor, p.currency) : money(p.intl_price_per_branch_minor, p.intl_currency);
  const extra = uae ? money(p.extra_person_minor, p.currency) : money(p.intl_extra_person_minor, p.intl_currency);
  return (
    <View style={styles.block} testID="landing-pricing">
      <Text variant="h1" align="center">
        {t('auth.landing.pricing.title')}
      </Text>
      <View style={[styles.tier, wide && styles.tierWide, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg }]}>
        <Text variant="display" tabular testID="landing-price">
          {price}
        </Text>
        <Text color="textSecondary">{t('auth.landing.pricing.per', { people: p.included_people })}</Text>
        <Text variant="small" color="textSecondary" align="center" testID="landing-price-extra">
          {t('auth.landing.pricing.extra', { price: extra })}
        </Text>
      </View>
      <Text align="center" color="textSecondary">
        {t('auth.landing.pricing.note')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.lg },
  tier: { padding: spacing.xl, gap: spacing.xs, alignItems: 'center' },
  // One card, not stretched across a computer screen.
  tierWide: { alignSelf: 'center', minWidth: 360 },
});
