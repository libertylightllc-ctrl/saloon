/** "Everything the counter needs": the two everyday screens large (with the real app), the rest as small cards. */
import { useTranslation } from 'react-i18next';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';

import { brandPalette as B, screenPadding, spacing } from '@/theme';
import { Icon, Text, type IconName } from '@/ui';

import gentsBooking from '../../../assets/images/landing/gents-booking.webp';
import gentsQueue from '../../../assets/images/landing/gents-queue.webp';
import gentsSale from '../../../assets/images/landing/gents-sale.webp';
import { Band, NavyBackdrop, PhoneShot, useLandingLayout } from './parts';
import { useVisitorInUae } from './visitor';

type FeatureKey = 'booking' | 'queue' | 'sale' | 'closing' | 'staff' | 'compliance' | 'stock' | 'reports' | 'roles';
const SMALL: { key: FeatureKey; icon: IconName }[] = [
  { key: 'closing', icon: 'banknote' },
  { key: 'staff', icon: 'clock' },
  { key: 'compliance', icon: 'shield' },
  { key: 'stock', icon: 'boxes' },
  { key: 'reports', icon: 'chart' },
  { key: 'roles', icon: 'userCheck' },
];
const BIG: { feature: FeatureKey; icon: IconName; shot: ImageSourcePropType; dark?: boolean }[] = [
  { feature: 'booking', icon: 'calendarPlus', shot: gentsBooking, dark: true },
  { feature: 'queue', icon: 'users', shot: gentsQueue },
  { feature: 'sale', icon: 'receipt', shot: gentsSale },
];
/** WPS and the UAE checklist are for UAE salons: visitors elsewhere read the general line (brief 2.12). */
const UAE_ONLY: FeatureKey[] = ['staff', 'compliance'];

export function FeatureBento({ onLayoutY }: { onLayoutY?: (y: number) => void }) {
  const { t } = useTranslation();
  const { wide, compact, width } = useLandingLayout();
  const uae = useVisitorInUae();
  const columns = width >= 1100 ? 3 : 2;
  const body = (key: FeatureKey) => t(`auth.landing.features.${key}.${UAE_ONLY.includes(key) && uae === false ? 'bodyIntl' : 'body'}` as 'auth.landing.features.queue.body');
  return (
    <View onLayout={(e) => onLayoutY?.(e.nativeEvent.layout.y)}>
      <Band ground={B.card} style={[styles.band, compact && styles.bandCompact]}>
        <View style={styles.head}>
          <Text variant={compact ? 'sectionCompact' : 'section'} align="center" style={styles.ink} accessibilityRole="header">
            {t('auth.landing.featuresTitle')}
          </Text>
          {compact ? null : (
            <Text variant="lead" align="center" style={styles.muted}>
              {t('auth.landing.featuresLead')}
            </Text>
          )}
        </View>
        {/* The free booking page first (brief 2.6): every salon gets one, no commission. On a phone the large tiles,
            then the small cards, swipe sideways (brief 2.14). */}
        {compact ? (
          <Swipe count={BIG.length} share={0.86} testID="landing-big-swipe">
            {(i, w) => (
              <View key={BIG[i]!.feature} style={{ width: w }}>
                <BigTile {...BIG[i]!} />
              </View>
            )}
          </Swipe>
        ) : (
          <>
            <BigTile {...BIG[0]!} />
            <View style={[styles.bigRow, wide && styles.row]}>
              <BigTile {...BIG[1]!} />
              <BigTile {...BIG[2]!} />
            </View>
          </>
        )}
        {compact ? (
          <Swipe count={SMALL.length} share={0.78} testID="landing-features-swipe">
            {(i, w) => (
              <View key={SMALL[i]!.key} style={[styles.small, { width: w }]}>
                <SmallCard feature={SMALL[i]!.key} icon={SMALL[i]!.icon} body={body(SMALL[i]!.key)} />
              </View>
            )}
          </Swipe>
        ) : (
          <View style={styles.grid}>
            {SMALL.map((f) => (
              <View key={f.key} style={[styles.small, { width: `${100 / columns - 1.6}%` }]}>
                <SmallCard feature={f.key} icon={f.icon} body={body(f.key)} />
              </View>
            ))}
          </View>
        )}
      </Band>
    </View>
  );
}

function SmallCard({ feature, icon, body }: { feature: FeatureKey; icon: IconName; body: string }) {
  const { t } = useTranslation();
  return (
    <>
      <View style={styles.iconRing}>
        <Icon name={icon} size={20} color={B.tealDeep} />
      </View>
      <Text variant="h4" style={styles.ink}>
        {t(`auth.landing.features.${feature}.title`)}
      </Text>
      <Text style={styles.muted} testID={`landing-feature-${feature}`}>
        {body}
      </Text>
    </>
  );
}

/** A row that swipes sideways on a phone, the next card peeking in, with dots (brief 2.14). */
function Swipe({ count, share, testID, children }: { count: number; share: number; testID: string; children: (i: number, width: number) => ReactNode }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const card = Math.round(width * share);
  const step = card + spacing.md;
  return (
    <View style={styles.swipe}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        contentContainerStyle={styles.swipeRow}
        onScroll={(e) => setIndex(Math.min(count - 1, Math.max(0, Math.round(Math.abs(e.nativeEvent.contentOffset.x) / step))))}
        scrollEventThrottle={32}
        testID={testID}
      >
        {Array.from({ length: count }, (_, i) => children(i, card))}
      </ScrollView>
      <View style={styles.dots} accessibilityLabel={t('auth.landing.swipe', { n: index + 1, total: count })}>
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
        ))}
      </View>
    </View>
  );
}

/** A large tile: the words on one side, the real screen rising from the bottom edge on the other. */
function BigTile({ feature, icon, shot, dark = false }: { feature: FeatureKey; icon: IconName; shot: ImageSourcePropType; dark?: boolean }) {
  const { t } = useTranslation();
  const { compact } = useLandingLayout();
  const ink = dark ? B.onNavy : B.ink;
  return (
    <View style={[styles.big, compact && styles.bigStacked, { backgroundColor: dark ? B.navy : B.lilacMist }]}>
      {dark ? <NavyBackdrop glowAt={['80%', '90%']} /> : null}
      <View style={styles.bigCopy}>
        <View style={[styles.iconRing, dark && styles.iconRingDark]}>
          <Icon name={icon} size={20} color={dark ? B.teal : B.tealDeep} />
        </View>
        <Text variant="h2" style={{ color: ink }}>
          {t(`auth.landing.features.${feature}.title`)}
        </Text>
        <Text style={{ color: dark ? B.onNavyMuted : B.inkMuted }}>{t(`auth.landing.features.${feature}.body`)}</Text>
      </View>
      <View style={[styles.bigShot, compact && styles.bigShotStacked]}>
        <PhoneShot source={shot} width={230} tilt={dark ? 4 : -4} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { paddingVertical: 88, gap: spacing['3xl'] },
  bandCompact: { paddingVertical: 48, gap: spacing.xl },
  head: { gap: spacing.md, alignItems: 'center', maxWidth: 720, alignSelf: 'center' },
  ink: { color: B.ink },
  muted: { color: B.inkMuted },
  bigRow: { gap: spacing.lg },
  row: { flexDirection: 'row' },
  big: { flex: 1, minHeight: 380, borderRadius: 28, overflow: 'hidden', flexDirection: 'row' },
  bigCopy: { flex: 1, padding: spacing['3xl'], gap: spacing.md, zIndex: 1 },
  bigShot: { width: 250, paddingTop: spacing['3xl'], marginBottom: -220, alignItems: 'center' },
  // On a phone the screen sits under the words.
  bigStacked: { flexDirection: 'column', minHeight: 0, maxHeight: 470 },
  bigShotStacked: { width: '100%', paddingTop: 0, marginBottom: -330 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, justifyContent: 'space-between' },
  small: { padding: spacing['2xl'], gap: spacing.sm, borderRadius: 22, borderWidth: 1, borderColor: B.hairline, backgroundColor: B.card, boxShadow: B.cardShadow },
  iconRing: { width: 44, height: 44, borderRadius: 22, backgroundColor: B.tealSoft, alignItems: 'center', justifyContent: 'center' },
  iconRingDark: { backgroundColor: B.navyRaised, borderWidth: 1, borderColor: B.navyLine },
  swipe: { gap: spacing.md, marginHorizontal: -screenPadding },
  swipeRow: { gap: spacing.md, paddingHorizontal: screenPadding },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: B.hairline },
  dotOn: { width: 20, backgroundColor: B.tealDeep },
});
