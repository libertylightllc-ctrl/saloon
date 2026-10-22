/**
 * "Which salon are you?": each type in its own look with its real queue screen, so the choice shows what the app
 * will look like. Choosing sets the look (and the words) of everything after it.
 */
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { brandPalette as B, spacing, themes, type Mode } from '@/theme';
import { Icon, Text } from '@/ui';

import gentsQueue from '../../../assets/images/landing/gents-queue.webp';
import ladiesQueue from '../../../assets/images/landing/ladies-queue.webp';
import { Band, PhoneShot, useLandingLayout } from './parts';

const SHOT = { gents: gentsQueue, ladies: ladiesQueue };

export function TypeChoice({ onChoose, onLayoutY }: { onChoose: (mode: Mode) => void; onLayoutY: (y: number) => void }) {
  const { t } = useTranslation();
  const { wide, compact } = useLandingLayout();
  return (
    <View onLayout={(e) => onLayoutY(e.nativeEvent.layout.y)}>
      <Band ground={B.mist} style={[styles.band, compact && styles.bandCompact]}>
        <View style={styles.head}>
          <Text variant={compact ? 'sectionCompact' : 'section'} align="center" style={styles.ink} accessibilityRole="header">
            {t('auth.landing.typeTitle')}
          </Text>
          <Text variant="lead" align="center" style={styles.muted}>
            {t('auth.welcome.subtitle')}
          </Text>
        </View>
        {/* Side by side on a phone too: one look at both (brief 2.14). */}
        <View style={[styles.cards, (wide || compact) && styles.row, compact && styles.cardsCompact]}>
          {(['gents', 'ladies'] as const).map((mode) => (
            <TypeCard key={mode} mode={mode} compact={compact} onPress={() => onChoose(mode)} />
          ))}
        </View>
      </Band>
    </View>
  );
}

function TypeCard({ mode, compact, onPress }: { mode: Mode; compact: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = themes[mode];
  return (
    <Pressable
      testID={`welcome-${mode}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t(`auth.salonType.${mode}`)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.preview, compact && styles.previewCompact, { backgroundColor: mode === 'gents' ? colors.primary500 : colors.primary100 }]}>
        <PhoneShot source={SHOT[mode]} width={compact ? 104 : 200} tilt={mode === 'gents' ? -3 : 3} />
      </View>
      <View style={[styles.text, compact && styles.textCompact]}>
        <View style={compact ? undefined : styles.flex}>
          <Text variant={compact ? 'h4' : 'h2'} style={{ color: colors.primaryText }}>
            {t(`auth.salonType.${mode}`)}
          </Text>
          {compact ? null : <Text style={styles.muted}>{t(`auth.welcome.${mode}`)}</Text>}
        </View>
        <View style={[styles.go, { backgroundColor: colors.primaryAction }]}>
          <Text variant="bodyStrong" color="onPrimary">
            {t('auth.landing.choose')}
          </Text>
          <Icon name="chevronRight" size={18} color={colors.onPrimary} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  band: { paddingVertical: 88, gap: spacing['3xl'] },
  bandCompact: { paddingVertical: 48, gap: spacing.xl },
  previewCompact: { height: 130, paddingTop: spacing.lg },
  cardsCompact: { gap: spacing.md },
  textCompact: { flexDirection: 'column', alignItems: 'stretch', padding: spacing.md, gap: spacing.sm },
  head: { gap: spacing.md, alignItems: 'center', maxWidth: 720, alignSelf: 'center' },
  ink: { color: B.ink },
  muted: { color: B.inkMuted },
  cards: { gap: spacing.xl },
  row: { flexDirection: 'row' },
  flex: { flex: 1, gap: 2 },
  card: { flex: 1, borderRadius: 28, backgroundColor: B.card, overflow: 'hidden', boxShadow: B.cardShadow },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  preview: { height: 260, alignItems: 'center', paddingTop: spacing['3xl'], overflow: 'hidden' },
  text: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing['2xl'] },
  go: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 999 },
});
