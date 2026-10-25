/**
 * The plan price on the website, on navy — the terms charge "the price shown on our website" — read from the same
 * settings the salons are billed from, so the two never disagree. Hidden until it loads. One price, the visitor's
 * (owner, 2026-10-08): the UAE price for a visitor in the UAE, the international one anywhere else — where they are by
 * IP (2026-10-12), or by the device's time zone when that cannot be told. Not in the phone apps (storePolicy).
 */
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { brandPalette as B, spacing } from '@/theme';
import { Text } from '@/ui';

import { demoHref } from './contact';
import { Band, BrandButton, NavyBackdrop, Tick, useLandingLayout } from './parts';
import { useLandingPrice } from './price';

export function Pricing({ startLabel, onStart, onLayoutRange }: { startLabel: string; onStart: () => void; onLayoutRange?: (top: number, bottom: number) => void }) {
  const { t } = useTranslation();
  const { compact } = useLandingLayout();
  const p = useLandingPrice();
  if (!p) return null;
  return (
    <View style={styles.ground} onLayout={(e) => onLayoutRange?.(e.nativeEvent.layout.y, e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
      <NavyBackdrop glowAt={['50%', '35%']} />
      <Band ground="transparent" style={[styles.band, compact && styles.bandCompact]} testID="landing-pricing">
        <Text variant={compact ? 'sectionCompact' : 'section'} align="center" style={styles.white} accessibilityRole="header">
          {t('auth.landing.pricing.title')}
        </Text>
        <Text variant="h3" align="center" style={styles.teal} testID="landing-trial">
          {t('auth.landing.pricing.trial')}
        </Text>
        <View style={styles.card}>
          <Text variant={compact ? 'heroCompact' : 'hero'} tabular style={styles.white} testID="landing-price">
            {p.price}
          </Text>
          <Text variant="lead" style={styles.muted}>
            {t('auth.landing.pricing.per', { people: p.people })}
          </Text>
          <Text variant="small" align="center" style={styles.muted} testID="landing-price-extra">
            {t('auth.landing.pricing.extra', { price: p.extra })}
          </Text>
          <Text variant="bodyStrong" align="center" style={styles.teal} testID="landing-per-day">
            {t('auth.landing.pricing.perDay', { price: p.perDay })}
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
            <Text variant="small" align="center" style={styles.tealSoft}>
              {t('auth.landing.trust.noRenew')}
            </Text>
            {demoHref ? (
              <BrandButton label={t('auth.landing.demo')} kind="textOnNavy" href={demoHref.href} external testID="landing-demo-pricing" />
            ) : null}
          </View>
        </View>
      </Band>
    </View>
  );
}

const styles = StyleSheet.create({
  ground: { backgroundColor: B.navy, overflow: 'hidden' },
  band: { paddingVertical: 88, gap: spacing.lg, alignItems: 'center' },
  bandCompact: { paddingVertical: 48 },
  white: { color: B.onNavy },
  teal: { color: B.teal },
  tealSoft: { color: B.tealSoft },
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
  cta: { marginTop: spacing.lg, alignSelf: 'stretch', alignItems: 'center', gap: spacing.sm },
});
