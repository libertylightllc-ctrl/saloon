/** The top of the website's home page: on navy, what Saloqo is, the way in, and the real app floating beside it. */
import { StatusBar } from 'expo-status-bar';
import { useRef } from 'react';
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
import { demoHref, hasWhatsApp, whatsappUrl } from './contact';
import { useVisitorInUae } from './visitor';
import { Band, BrandButton, Eyebrow, NavyBackdrop, PhoneShot, useLandingLayout } from './parts';

const FACTS: { key: 'booking' | 'languages' | 'devices' | 'private'; icon: IconName }[] = [
  { key: 'booking', icon: 'calendarPlus' },
  { key: 'languages', icon: 'languages' },
  { key: 'devices', icon: 'smartphone' },
  { key: 'private', icon: 'shield' },
];

export function Hero({
  createLabel,
  onCreate,
  onSignIn,
  onSeeHow,
  onCtaBottom,
  trialLine,
}: {
  createLabel: string;
  onCreate: () => void;
  onSignIn: () => void;
  /** "See how it works" (phones without a WhatsApp number): to the video, or the features. */
  onSeeHow: () => void;
  /** Where the main button ends, from the top of the window (the sticky bar shows once it has scrolled away). */
  onCtaBottom?: (windowY: number) => void;
  /** "No card needed" under the button (website only; the phone apps do not talk about paying). */
  trialLine: string | null;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { wide, compact } = useLandingLayout();
  const uae = useVisitorInUae();
  const cta = useRef<View>(null);
  const facts = (
    <View style={styles.facts}>
      {FACTS.filter((f) => !(compact && f.key === 'private')).map((f) => (
        <View key={f.key} style={styles.fact}>
          <Icon name={f.icon} size={16} color={B.teal} />
          {f.key === 'languages' ? (
            <LanguageTicker onDark />
          ) : (
            <Text variant="bodyStrong" style={styles.onNavy} testID={`landing-fact-${f.key}`}>
              {t(`auth.landing.facts.${f.key}`)}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
  return (
    <View style={styles.ground}>
      <StatusBar style="light" />
      <NavyBackdrop glowAt={wide ? ['72%', '45%'] : ['50%', '70%']} />
      <Band ground="transparent" style={{ paddingTop: insets.top + spacing.lg, paddingBottom: wide ? 96 : 40 }}>
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <BrandMark size={36} />
            <Text variant="h3" style={styles.onNavy}>
              {brand.appName}
            </Text>
          </View>
          <View style={styles.topActions}>
            <LanguageButton onBand />
            {/* On a phone a small link, so the page's one big button is the way in (brief 2.2). */}
            <BrandButton label={t('auth.landing.signIn')} kind={compact ? 'textOnNavy' : 'outlineOnNavy'} small={compact} onPress={onSignIn} testID="landing-sign-in" />
          </View>
        </View>

        <View style={[styles.body, wide ? styles.bodyWide : styles.bodyNarrow, compact && styles.bodyCompact]}>
          <View style={[styles.copy, wide && styles.copyWide, compact && styles.copyCompact]}>
            <Eyebrow label={t('auth.landing.eyebrow')} onNavy />
            <Text variant={compact ? 'heroCompact' : 'hero'} style={[styles.onNavy, styles.headline]} accessibilityRole="header">
              {/* "…to the last dirham" for UAE visitors, "…to the last cent" for everyone else (full update brief). */}
              {t(uae === false ? 'auth.landing.headlineIntl' : 'auth.landing.headline')}
            </Text>
            <Text variant="lead" style={styles.muted}>
              {t(compact ? 'auth.landing.leadShort' : 'auth.landing.lead')}
            </Text>
            <View
              ref={cta}
              style={styles.ctas}
              onLayout={() => cta.current?.measure((_x, _y, _w, h, _px, py) => onCtaBottom?.(py + h))}
            >
              <BrandButton label={createLabel} icon="chevronRight" onPress={onCreate} testID="landing-create" />
              {compact ? (
                hasWhatsApp ? (
                  <BrandButton label={t('auth.landing.whatsapp')} kind="whatsapp" icon="messageCircle" href={whatsappUrl()} external testID="landing-whatsapp" />
                ) : (
                  <BrandButton label={t('auth.landing.seeHow')} kind="outlineOnNavy" onPress={onSeeHow} testID="landing-see-how" />
                )
              ) : demoHref ? (
                <BrandButton label={t('auth.landing.demo')} kind="outlineOnNavy" href={demoHref.href} external testID="landing-demo" />
              ) : null}
            </View>
            <View style={styles.trust}>
              {trialLine ? (
                <Text variant="small" style={styles.tealLine}>
                  {trialLine}
                </Text>
              ) : null}
              <Text variant="small" style={styles.tealLine} testID="landing-trust-data">
                {t('auth.landing.trust.dataYours')}
              </Text>
            </View>
            {compact ? null : facts}
          </View>
          {/* On a phone the app shows on the first screen, a little cropped (brief 2.1). */}
          <View style={compact ? styles.visualCrop : undefined} testID="landing-hero-visual">
            <HeroVisual size={wide ? 1 : compact ? 0.64 : 0.86} />
          </View>
          {compact ? <View style={styles.copyCompact}>{facts}</View> : null}
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
  bodyCompact: { marginTop: spacing['2xl'], gap: spacing.xl },
  copyCompact: { gap: spacing.md, width: '100%' },
  // The phones cut off at the bottom: enough to see the app without a whole extra screen.
  visualCrop: { height: 330, overflow: 'hidden' },
  trust: { gap: 2 },
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
