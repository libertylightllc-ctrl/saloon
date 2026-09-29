/** Pieces of the landing page: the app preview, a feature card, a step and the salon type card. */
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatMoney } from '@/lib/money';
import { spacing, themes, useTheme, type Mode } from '@/theme';
import { ContourPattern, Icon, Text, type IconName } from '@/ui';

/** A small, true-to-life picture of Home: expected cash and the queue (drawn from the theme, not an image). */
export function AppPreview() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { colors } = theme;
  const queue = [
    { name: 'Omar', service: t('auth.landing.preview.fade'), state: t('auth.landing.preview.waiting', { min: 6 }) },
    { name: 'Sara', service: t('auth.landing.preview.blowDry'), state: t('auth.landing.preview.inChair') },
    { name: 'Faisal', service: t('auth.landing.preview.beard'), state: '12:30' },
  ];
  return (
    <View
      style={[styles.phone, { backgroundColor: colors.surface, borderRadius: theme.radius.lg, boxShadow: theme.shadow.boxShadow }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      <View style={[styles.phoneBand, { backgroundColor: colors.primary500, borderRadius: theme.radius.md }]}>
        <ContourPattern color={colors.primary300} />
        <Text variant="small" color="onPrimary">
          {t('auth.landing.preview.expected')}
        </Text>
        <Text variant="h1" color="onPrimary" tabular>
          {formatMoney(124_000)}
        </Text>
        <Text variant="small" color="onPrimary">
          {t('auth.landing.preview.queueLine', { n: 4 })}
        </Text>
      </View>
      {queue.map((q, i) => (
        <View key={q.name} style={[styles.queueRow, { borderColor: colors.divider }]}>
          <View style={[styles.avatar, { backgroundColor: colors.categoryFills[i % colors.categoryFills.length] }]}>
            <Text variant="bodyStrong" style={{ color: colors.categoryIcons[i % colors.categoryIcons.length] }}>
              {q.name[0]}
            </Text>
          </View>
          <View style={styles.flex}>
            <Text variant="bodyStrong">{q.name}</Text>
            <Text variant="small" color="textSecondary">
              {q.service}
            </Text>
          </View>
          <Text variant="small" color="primaryText">
            {q.state}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function FeatureCard({ icon, title, body, index }: { icon: IconName; title: string; body: string; index: number }) {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <View style={[styles.feature, { backgroundColor: colors.surface, borderRadius: theme.radius.lg, borderColor: colors.divider }]}>
      <View style={[styles.featureIcon, { backgroundColor: colors.categoryFills[index % colors.categoryFills.length] }]}>
        <Icon name={icon} size={20} color={colors.categoryIcons[index % colors.categoryIcons.length]} />
      </View>
      <Text variant="h4">{title}</Text>
      <Text variant="body" color="textSecondary">
        {body}
      </Text>
    </View>
  );
}

export function Step({ n, text }: { n: number; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.step}>
      <View style={[styles.stepNumber, { backgroundColor: theme.colors.primary500 }]}>
        <Text variant="bodyStrong" color="onPrimary">
          {String(n)}
        </Text>
      </View>
      <Text variant="body" style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

/** One salon type, drawn in its own theme so the choice shows what the app will look like. */
export function TypeCard({ mode, onPress }: { mode: Mode; onPress: () => void }) {
  const { t } = useTranslation();
  const preview = themes[mode];
  const { colors } = preview;
  return (
    <Pressable
      testID={`welcome-${mode}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t(`auth.salonType.${mode}`)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderRadius: preview.radius.lg, boxShadow: preview.shadow.boxShadow },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.preview, { backgroundColor: mode === 'gents' ? colors.primary500 : colors.primary50, borderRadius: preview.radius.md }]}>
        {mode === 'gents' ? <ContourPattern color={colors.primary300} /> : null}
        <View style={styles.circles}>
          {(['scissors', 'palette', 'sparkles'] as const).map((icon, i) => (
            <View key={icon} style={[styles.circle, { backgroundColor: colors.categoryFills[i % colors.categoryFills.length] }]}>
              <Icon name={icon} size={16} color={colors.categoryIcons[i % colors.categoryIcons.length]} />
            </View>
          ))}
        </View>
      </View>
      <View style={styles.cardText}>
        <Text variant="h3" style={{ color: colors.primaryText }}>
          {t(`auth.salonType.${mode}`)}
        </Text>
        <Text variant="small" color="textSecondary">
          {t(`auth.welcome.${mode}`)}
        </Text>
      </View>
      <View style={styles.cardAction}>
        <Text variant="bodyStrong" style={{ color: colors.primaryText }}>
          {t('auth.landing.choose')}
        </Text>
        <Icon name="chevronRight" size={18} color={colors.primaryText} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  phone: { padding: spacing.md, gap: spacing.sm, width: '100%', maxWidth: 340, alignSelf: 'center' },
  phoneBand: { padding: spacing.lg, gap: 2, overflow: 'hidden' },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  feature: { padding: spacing.lg, gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, flexGrow: 1 },
  featureIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepNumber: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  card: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  preview: { height: 88, overflow: 'hidden', justifyContent: 'center', paddingHorizontal: spacing.lg },
  circles: { flexDirection: 'row', gap: spacing.md },
  circle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cardText: { gap: 2 },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
