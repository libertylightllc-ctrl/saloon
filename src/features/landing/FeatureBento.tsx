/** "Everything the counter needs": the two everyday screens large (with the real app), the rest as small cards. */
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { brandPalette as B, spacing } from '@/theme';
import { Icon, Text, type IconName } from '@/ui';

import gentsQueue from '../../../assets/images/landing/gents-queue.webp';
import gentsSale from '../../../assets/images/landing/gents-sale.webp';
import { Band, NavyBackdrop, PhoneShot, useLandingLayout } from './parts';

type FeatureKey = 'queue' | 'sale' | 'closing' | 'staff' | 'compliance' | 'stock' | 'reports' | 'roles';
const SMALL: { key: FeatureKey; icon: IconName }[] = [
  { key: 'closing', icon: 'banknote' },
  { key: 'staff', icon: 'clock' },
  { key: 'compliance', icon: 'shield' },
  { key: 'stock', icon: 'boxes' },
  { key: 'reports', icon: 'chart' },
  { key: 'roles', icon: 'userCheck' },
];

export function FeatureBento() {
  const { t } = useTranslation();
  const { wide, compact, width } = useLandingLayout();
  const columns = width >= 1100 ? 3 : compact ? 1 : 2;
  return (
    <Band ground={B.card} style={styles.band}>
      <View style={styles.head}>
        <Text variant={compact ? 'sectionCompact' : 'section'} align="center" style={styles.ink} accessibilityRole="header">
          {t('auth.landing.featuresTitle')}
        </Text>
        <Text variant="lead" align="center" style={styles.muted}>
          {t('auth.landing.featuresLead')}
        </Text>
      </View>
      <View style={[styles.bigRow, wide && styles.row]}>
        <BigTile feature="queue" icon="users" shot={gentsQueue} dark />
        <BigTile feature="sale" icon="receipt" shot={gentsSale} />
      </View>
      <View style={styles.grid}>
        {SMALL.map((f) => (
          <View key={f.key} style={[styles.small, { width: columns === 1 ? '100%' : `${100 / columns - 1.6}%` }]}>
            <View style={styles.iconRing}>
              <Icon name={f.icon} size={20} color={B.tealDeep} />
            </View>
            <Text variant="h4" style={styles.ink}>
              {t(`auth.landing.features.${f.key}.title`)}
            </Text>
            <Text style={styles.muted}>{t(`auth.landing.features.${f.key}.body`)}</Text>
          </View>
        ))}
      </View>
    </Band>
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
  head: { gap: spacing.md, alignItems: 'center', maxWidth: 720, alignSelf: 'center' },
  ink: { color: B.ink },
  muted: { color: B.inkMuted },
  bigRow: { gap: spacing.lg },
  row: { flexDirection: 'row' },
  big: { flex: 1, minHeight: 380, borderRadius: 28, overflow: 'hidden', flexDirection: 'row' },
  bigCopy: { flex: 1, padding: spacing['3xl'], gap: spacing.md, zIndex: 1 },
  bigShot: { width: 250, paddingTop: spacing['3xl'], marginBottom: -220, alignItems: 'center' },
  // On a phone the screen sits under the words.
  bigStacked: { flexDirection: 'column', minHeight: 0, maxHeight: 640 },
  bigShotStacked: { width: '100%', paddingTop: 0, marginBottom: -260 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, justifyContent: 'space-between' },
  small: { padding: spacing['2xl'], gap: spacing.sm, borderRadius: 22, borderWidth: 1, borderColor: B.hairline, backgroundColor: B.card, boxShadow: B.cardShadow },
  iconRing: { width: 44, height: 44, borderRadius: 22, backgroundColor: B.tealSoft, alignItems: 'center', justifyContent: 'center' },
  iconRingDark: { backgroundColor: B.navyRaised, borderWidth: 1, borderColor: B.navyLine },
});
