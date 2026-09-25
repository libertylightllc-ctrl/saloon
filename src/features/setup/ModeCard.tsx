import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { spacing, themes, type Mode } from '@/theme';
import { Icon, Text } from '@/ui';

/** A salon type drawn in its own theme, so the choice previews the look. */
export function ModeCard({
  mode,
  selected,
  onPress,
  testID,
}: {
  mode: Mode;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  const preview = themes[mode];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      aria-checked={selected}
      style={[
        styles.modeCard,
        {
          borderRadius: preview.radius.lg,
          borderColor: selected ? preview.colors.primary500 : preview.colors.border,
          backgroundColor: selected ? preview.colors.primary50 : preview.colors.surface,
        },
      ]}
    >
      <View style={[styles.swatch, { backgroundColor: preview.colors.primary500, borderRadius: preview.radius.md }]}>
        <Icon name={mode === 'gents' ? 'scissors' : 'flower'} size={22} color={preview.colors.onPrimary} />
      </View>
      <View style={styles.flex}>
        <Text variant="h4" style={{ color: preview.colors.primaryText }}>
          {t(`auth.salonType.${mode}`)}
        </Text>
        <Text variant="small" color="textSecondary">
          {t(`auth.welcome.${mode}`)}
        </Text>
      </View>
      {selected ? <Icon name="circleCheck" size={22} color={preview.colors.primary500} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  modeCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderWidth: 2 },
  swatch: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
