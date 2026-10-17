/** "Made for salon owners": what the owner gets, each line something the app really does (as in the product video). */
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { brandPalette as B, spacing } from '@/theme';
import { Text } from '@/ui';

import gentsReports from '../../../assets/images/landing/gents-reports.webp';
import { Band, Eyebrow, PhoneShot, Tick, useLandingLayout } from './parts';

const ITEMS = ['live', 'closing', 'pay', 'reminders', 'stock', 'reports'] as const;

export function OwnerBenefits() {
  const { t } = useTranslation();
  const { wide, compact } = useLandingLayout();
  return (
    <Band ground={B.mist} style={[styles.band, wide && styles.row]} testID="landing-owners">
      {wide ? (
        <View style={styles.visual}>
          <View style={styles.halo} />
          <PhoneShot source={gentsReports} width={290} tilt={-4} />
        </View>
      ) : null}
      <View style={[styles.copy, wide && styles.copyWide]}>
        <Eyebrow label={t('auth.landing.owners.eyebrow')} />
        <Text variant={compact ? 'sectionCompact' : 'section'} style={styles.ink} accessibilityRole="header">
          {t('auth.landing.owners.title')}
        </Text>
        <Text variant="lead" style={styles.muted}>
          {t('auth.landing.owners.lead')}
        </Text>
        <View style={styles.list}>
          {ITEMS.map((k) => (
            <View key={k} style={styles.item}>
              <Tick />
              <Text variant="h4" style={[styles.ink, styles.itemText]}>
                {t(`auth.landing.owners.items.${k}`)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Band>
  );
}

const styles = StyleSheet.create({
  band: { paddingVertical: 88, gap: spacing['4xl'] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  visual: { width: 440, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl },
  halo: { position: 'absolute', width: 420, height: 420, borderRadius: 210, backgroundColor: B.lilacMist },
  copy: { gap: spacing.lg },
  copyWide: { flex: 1, maxWidth: 600 },
  ink: { color: B.ink },
  muted: { color: B.inkMuted },
  list: { gap: spacing.lg, marginTop: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemText: { flexShrink: 1 },
});
