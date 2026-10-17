/** The top of the website's home page: on navy, what Saloqo is, the way in, and the real app floating beside it. */
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brand } from '@/config/brand';
import { LanguageTicker } from '@/features/auth/LanguageTicker';
import { LanguageButton } from '@/features/settings/LanguageSheet';
import { brandPalette as B, spacing } from '@/theme';
import { BrandMark, Icon, Text, type IconName } from '@/ui';

import gentsQueue from '../../../assets/images/landing/gents-queue.webp';
import ladiesHome from '../../../assets/images/landing/ladies-home.webp';
import queueCard from '../../../assets/images/landing/queue-card.webp';
import star from '../../../assets/images/splash-icon.png';
import { Band, BrandButton, Eyebrow, NavyBackdrop, PhoneShot, useLandingLayout } from './parts';

const FACTS: { key: 'languages' | 'devices' | 'private'; icon: IconName }[] = [
  { key: 'languages', icon: 'languages' },
  { key: 'devices', icon: 'smartphone' },
  { key: 'private', icon: 'shield' },
];

export function Hero({
  createLabel,
  onCreate,
  onSignIn,
  trialLine,
}: {
  createLabel: string;
  onCreate: () => void;
  onSignIn: () => void;
  /** "No card needed" under the button (website only; the phone apps do not talk about paying). */
  trialLine: string | null;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { wide, compact } = useLandingLayout();
  return (
    <View style={styles.ground}>
      <StatusBar style="light" />
      <NavyBackdrop glowAt={wide ? ['72%', '45%'] : ['50%', '70%']} />
      <Band ground="transparent" style={{ paddingTop: insets.top + spacing.lg, paddingBottom: wide ? 96 : 56 }}>
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <BrandMark size={36} />
            <Text variant="h3" style={styles.onNavy}>
              {brand.appName}
            </Text>
          </View>
          <View style={styles.topActions}>
            <LanguageButton onBand />
            {compact ? null : <BrandButton label={t('auth.landing.signIn')} kind="outlineOnNavy" onPress={onSignIn} testID="landing-sign-in" />}
          </View>
        </View>

        <View style={[styles.body, wide ? styles.bodyWide : styles.bodyNarrow]}>
          <View style={[styles.copy, wide && styles.copyWide]}>
            <Eyebrow label={t('auth.landing.eyebrow')} onNavy />
            <Text variant={compact ? 'heroCompact' : 'hero'} style={[styles.onNavy, styles.headline]} accessibilityRole="header">
              {t('auth.landing.headline')}
            </Text>
            <Text variant="lead" style={styles.muted}>
              {t('auth.landing.lead')}
            </Text>
            <View style={styles.ctas}>
              <BrandButton label={createLabel} icon="chevronRight" onPress={onCreate} testID="landing-create" />
              {compact ? <BrandButton label={t('auth.landing.signIn')} kind="outlineOnNavy" onPress={onSignIn} testID="landing-sign-in" /> : null}
            </View>
            {trialLine ? (
              <Text variant="small" style={styles.tealLine}>
                {trialLine}
              </Text>
            ) : null}
            <Text variant="small" style={styles.muted}>
              {t('auth.landing.staffNote')}
            </Text>
            <View style={styles.facts}>
              {FACTS.map((f) => (
                <View key={f.key} style={styles.fact}>
                  <Icon name={f.icon} size={16} color={B.teal} />
                  {f.key === 'languages' ? (
                    <LanguageTicker onDark />
                  ) : (
                    <Text variant="bodyStrong" style={styles.onNavy}>
                      {t(`auth.landing.facts.${f.key}`)}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
          <HeroVisual size={wide ? 1 : compact ? 0.72 : 0.86} />
        </View>
      </Band>
    </View>
  );
}

/** Both looks of the real app, a queue card and a "cash balanced" chip floating over the glowing star. */
function HeroVisual({ size }: { size: number }) {
  const { t } = useTranslation();
  const front = 270 * size;
  return (
    <View style={[styles.visual, { width: 500 * size, height: 640 * size }]} aria-hidden>
      <Image source={star} style={[styles.star, { width: 300 * size, height: 300 * size, top: -40 * size, start: -50 * size }]} />
      <PhoneShot source={gentsQueue} width={front * 0.86} tilt={7} style={{ position: 'absolute', top: 10 * size, end: 0 }} />
      <PhoneShot source={ladiesHome} width={front} tilt={-5} style={{ position: 'absolute', top: 40 * size, start: 40 * size }} />
      <Image
        source={queueCard}
        resizeMode="contain"
        style={[styles.card, { width: 290 * size, height: 160 * size, bottom: 40 * size, start: 0, transform: [{ rotate: '-3deg' }] }]}
      />
      <View style={[styles.chip, { top: 70 * size, end: 10 * size }]}>
        <Icon name="check" size={16} color={B.tealDeep} strokeWidth={2.6} />
        <Text variant="bodyStrong" style={{ color: B.navy }}>
          {t('auth.landing.balanced')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ground: { backgroundColor: B.navy, overflow: 'hidden' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  body: { marginTop: spacing['4xl'] },
  bodyWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing['4xl'] },
  bodyNarrow: { gap: spacing['4xl'], alignItems: 'center' },
  copy: { gap: spacing.lg, width: '100%' },
  copyWide: { flex: 1, maxWidth: 580 },
  headline: { maxWidth: 600 },
  onNavy: { color: B.onNavy },
  muted: { color: B.onNavyMuted, maxWidth: 560 },
  tealLine: { color: B.tealSoft },
  ctas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl, marginTop: spacing.md },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  visual: { position: 'relative', flexShrink: 0 },
  star: { position: 'absolute', opacity: 0.9 },
  card: { position: 'absolute', borderRadius: 18, boxShadow: B.liftShadow },
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: B.tealSoft,
    boxShadow: B.cardShadow,
  },
});
