/**
 * The plan price on the website, on navy — the terms charge "the price shown on our website" — read from the same
 * settings the salons are billed from, so the two never disagree. Hidden until it loads. One price, the visitor's
 * (owner, 2026-10-08): the UAE price for a visitor in the UAE, the international one anywhere else — where they are by
 * IP (2026-10-12), or by the device's time zone when that cannot be told. Not in the phone apps (storePolicy).
 */
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { usePublicPrices } from '@/features/plan/api';
import { deviceTimeZone } from '@/features/setup/CountryStep';
import { countryOf } from '@/lib/countries';
import { isCurrency } from '@/lib/currencies';
import { visitorCountry } from '@/lib/geo';
import { formatMoney } from '@/lib/money';
import { brandPalette as B, spacing } from '@/theme';
import { Text } from '@/ui';

import { Band, BrandButton, NavyBackdrop, Tick, useLandingLayout } from './parts';

function inUae(country: string | null | undefined): boolean {
  if (country) return country === 'AE';
  const zone = deviceTimeZone();
  return zone !== null && (countryOf('AE')?.timezones.includes(zone) ?? false);
}

export function Pricing({ startLabel, onStart }: { startLabel: string; onStart: () => void }) {
  const { t } = useTranslation();
  const { compact } = useLandingLayout();
  const prices = usePublicPrices();
  const where = useQuery({ queryKey: ['visitor-country'], queryFn: () => visitorCountry(), staleTime: Infinity });
  const p = prices.data;
  if (!p || where.isPending) return null;
  const money = (minor: number, currency: string) => (isCurrency(currency) ? formatMoney(minor, currency) : `${currency} ${minor / 100}`);
  // Priced by people, per salon (owner, 2026-10-08): the base covers the first few who sign in; each one after adds.
  const uae = inUae(where.data);
  const price = uae ? money(p.price_per_branch_minor, p.currency) : money(p.intl_price_per_branch_minor, p.intl_currency);
  const extra = uae ? money(p.extra_person_minor, p.currency) : money(p.intl_extra_person_minor, p.intl_currency);
  return (
    <View style={styles.ground}>
      <NavyBackdrop glowAt={['50%', '35%']} />
      <Band ground="transparent" style={styles.band} testID="landing-pricing">
        <Text variant={compact ? 'sectionCompact' : 'section'} align="center" style={styles.white} accessibilityRole="header">
          {t('auth.landing.pricing.title')}
        </Text>
        {p.trial_days > 0 ? (
          <Text variant="h3" align="center" style={styles.teal} testID="landing-trial">
            {t('auth.landing.pricing.trial', { count: p.trial_days })}
          </Text>
        ) : null}
        <View style={styles.card}>
          <Text variant={compact ? 'heroCompact' : 'hero'} tabular style={styles.white} testID="landing-price">
            {price}
          </Text>
          <Text variant="lead" style={styles.muted}>
            {t('auth.landing.pricing.per', { people: p.included_people })}
          </Text>
          <Text variant="small" align="center" style={styles.muted} testID="landing-price-extra">
            {t('auth.landing.pricing.extra', { price: extra })}
          </Text>
          <View style={styles.rule} />
          {(['everything', 'languages', 'support'] as const).map((k) => (
            <View key={k} style={styles.line}>
              <Tick size={22} />
              <Text style={styles.white}>{t(`auth.landing.pricing.points.${k}`)}</Text>
            </View>
          ))}
          <View style={styles.cta}>
            <BrandButton label={startLabel} icon="chevronRight" onPress={onStart} testID="landing-start-pricing" />
          </View>
        </View>
        <Text align="center" style={[styles.muted, styles.note]}>
          {t('auth.landing.pricing.note')}
        </Text>
      </Band>
    </View>
  );
}

const styles = StyleSheet.create({
  ground: { backgroundColor: B.navy, overflow: 'hidden' },
  band: { paddingVertical: 88, gap: spacing.lg, alignItems: 'center' },
  white: { color: B.onNavy },
  teal: { color: B.teal },
  muted: { color: B.onNavyMuted },
  note: { maxWidth: 620 },
  card: {
    width: '100%',
    maxWidth: 440,
    marginTop: spacing.md,
    padding: spacing['3xl'],
    gap: spacing.sm,
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: B.navyLine,
    backgroundColor: B.navyRaised,
  },
  rule: { alignSelf: 'stretch', height: 1, backgroundColor: B.navyLine, marginVertical: spacing.md },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, alignSelf: 'stretch' },
  cta: { marginTop: spacing.lg, alignSelf: 'stretch', alignItems: 'center' },
});
