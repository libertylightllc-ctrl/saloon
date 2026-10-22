/**
 * Real customers and real numbers (website brief 2.8), from src/config/site.ts: testimonial cards, a stats strip and
 * "Made in Dubai" with the company's name. Nothing is shown while the config is empty — never sample data.
 */
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';

import { site } from '@/config/site';
import { brandPalette as B, spacing } from '@/theme';
import { Text } from '@/ui';

import { madeInPlace } from './contact';
import { Band, useLandingLayout } from './parts';

export function SocialProof() {
  const { t } = useTranslation();
  const { wide, compact } = useLandingLayout();
  if (!site.testimonials.length && !site.stats.length && !site.legalName) return null;
  return (
    <Band ground={B.card} style={[styles.band, compact && styles.bandCompact]} testID="landing-proof">
      {site.stats.length ? (
        <View style={styles.stats}>
          {site.stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text variant="section" style={styles.ink}>
                {s.value}
              </Text>
              <Text style={styles.muted}>{s.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {site.testimonials.length ? (
        <View style={[styles.cards, wide && styles.row]}>
          {site.testimonials.map((q) => (
            <View key={`${q.name}-${q.salon}`} style={[styles.card, wide && styles.flex]}>
              <Text variant="lead" style={styles.ink}>{`“${q.quote}”`}</Text>
              <View style={styles.person}>
                {q.photoUrl ? <Image source={{ uri: q.photoUrl }} style={styles.photo} accessibilityIgnoresInvertColors /> : null}
                <View style={styles.flex}>
                  <Text variant="bodyStrong" style={styles.ink}>
                    {q.name}
                  </Text>
                  <Text variant="small" style={styles.muted}>
                    {[q.role, q.salon, q.city].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {site.legalName ? (
        <Text align="center" style={styles.muted} testID="landing-made-by">
          {t('auth.landing.proof.madeBy', { name: site.legalName, place: madeInPlace(t) })}
        </Text>
      ) : null}
    </Band>
  );
}

const styles = StyleSheet.create({
  band: { paddingVertical: 72, gap: spacing['2xl'] },
  bandCompact: { paddingVertical: 40 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing['3xl'] },
  stat: { alignItems: 'center', gap: 2 },
  cards: { gap: spacing.lg },
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
  card: { padding: spacing['2xl'], gap: spacing.lg, borderRadius: 22, borderWidth: 1, borderColor: B.hairline, backgroundColor: B.mist },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  photo: { width: 44, height: 44, borderRadius: 22 },
  ink: { color: B.ink },
  muted: { color: B.inkMuted },
});
