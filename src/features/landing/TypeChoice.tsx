/**
 * "Which salon are you?": each type in its own look with its real queue screen, so the choice shows what the app
 * will look like. Choosing sets the look (and the words) of everything after it.
 */
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { MODE_SHOT } from '@/features/mode/modeLook';
import { brandPalette as B, MODES, spacing, themes, type Mode } from '@/theme';
import { Icon, Text } from '@/ui';

import { Band, PhoneShot, useLandingLayout } from './parts';
import { Swipe } from './Swipe';


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
        {/* Four types (brief 5.4). On a phone one row that swipes sideways, two at a time, so the page stays as short
            as brief 2.14 asks; two by two on a tablet; all four in a row on a wide screen. */}
        {compact ? (
          <Swipe count={MODES.length} share={0.42} testID="landing-types-swipe">
            {(i, w) => (
              <View key={MODES[i]} style={{ width: w }}>
                <TypeCard mode={MODES[i]!} compact stacked tilt={i % 2 ? 3 : -3} onPress={() => onChoose(MODES[i]!)} />
              </View>
            )}
          </Swipe>
        ) : (
          <View style={[styles.cards, styles.row, styles.wrap]}>
            {MODES.map((mode, i) => (
              <View key={mode} style={wide ? styles.quarter : styles.half}>
                <TypeCard mode={mode} compact={false} stacked={wide} tilt={i % 2 ? 3 : -3} onPress={() => onChoose(mode)} />
              </View>
            ))}
          </View>
        )}
      </Band>
    </View>
  );
}

/** `stacked`: the words above the button (a phone, or four cards in a row on a wide screen). */
function TypeCard({ mode, compact, stacked, tilt, onPress }: { mode: Mode; compact: boolean; stacked: boolean; tilt: number; onPress: () => void }) {
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
      {/* The banded looks (gents, unisex) on their strong colour, the soft ones (ladies, wellness) on a pale tint. */}
      <View style={[styles.preview, compact && styles.previewCompact, { backgroundColor: themes[mode].variants.header === 'band' ? colors.primary500 : colors.primary100 }]}>
        <PhoneShot source={MODE_SHOT[mode]} width={compact ? 104 : 200} tilt={tilt} />
      </View>
      <View style={[styles.text, stacked && styles.textCompact, stacked && !compact && styles.textStacked]}>
        <View style={stacked ? undefined : styles.flex}>
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
  textStacked: { padding: spacing.xl, flex: 1, justifyContent: 'space-between' },
  textCompact: { flexDirection: 'column', alignItems: 'stretch', padding: spacing.md, gap: spacing.sm },
  head: { gap: spacing.md, alignItems: 'center', maxWidth: 720, alignSelf: 'center' },
  ink: { color: B.ink },
  muted: { color: B.inkMuted },
  cards: { gap: spacing.xl },
  wrap: { flexWrap: 'wrap' },
  // Two to a row (the gap shared), or four on a wide screen.
  half: { flexBasis: '46%', flexGrow: 1 },
  quarter: { flexBasis: '22%', flexGrow: 1 },
  row: { flexDirection: 'row' },
  flex: { flex: 1, gap: 2 },
  card: { flex: 1, borderRadius: 28, backgroundColor: B.card, overflow: 'hidden', boxShadow: B.cardShadow },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  preview: { height: 260, alignItems: 'center', paddingTop: spacing['3xl'], overflow: 'hidden' },
  text: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing['2xl'] },
  go: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 999 },
});
