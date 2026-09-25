import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brand } from '@/config/brand';
import { useSalonType } from '@/features/auth/salonType';
import { LanguageLink } from '@/features/settings/LanguageSheet';
import { screenPadding, spacing, themes, useTheme, type Mode } from '@/theme';
import { ContourPattern, Icon, Text } from '@/ui';

/** First launch: pick the salon type. The whole app follows it until a branch decides. */
export default function Welcome() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setSalonType } = useSalonType();

  const choose = (mode: Mode) => {
    setSalonType(mode);
    router.replace('/sign-in');
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: insets.top + spacing['2xl'] }]}>
      <View style={styles.intro}>
        <Text variant="display" align="center">
          {brand.appName}
        </Text>
        <Text align="center" color="textOnTint">
          {t('auth.welcome.subtitle')}
        </Text>
      </View>
      <View style={styles.cards}>
        {(['gents', 'ladies'] as const).map((mode) => (
          <TypeCard key={mode} mode={mode} onPress={() => choose(mode)} />
        ))}
      </View>
      <View style={{ paddingBottom: insets.bottom + spacing.lg }}>
        <LanguageLink />
      </View>
    </View>
  );
}

function TypeCard({ mode, onPress }: { mode: Mode; onPress: () => void }) {
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
      <View
        style={[
          styles.preview,
          {
            backgroundColor: mode === 'gents' ? colors.primary500 : colors.primary50,
            borderRadius: preview.radius.md,
          },
        ]}
      >
        {mode === 'gents' ? <ContourPattern color={colors.primary300} /> : null}
        <View style={styles.circles}>
          {(['scissors', 'palette', 'sparkles'] as const).map((icon, i) => (
            <View
              key={icon}
              style={[styles.circle, { backgroundColor: colors.categoryFills[i % colors.categoryFills.length] }]}
            >
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: screenPadding, gap: spacing['2xl'], justifyContent: 'space-between' },
  intro: { gap: spacing.sm, alignItems: 'center' },
  cards: { gap: spacing.lg },
  card: { padding: spacing.lg, gap: spacing.md },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  preview: { height: 88, overflow: 'hidden', justifyContent: 'center', paddingHorizontal: spacing.lg },
  circles: { flexDirection: 'row', gap: spacing.md },
  circle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cardText: { gap: 2 },
});
