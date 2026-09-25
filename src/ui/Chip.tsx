import { Pressable, StyleSheet, View } from 'react-native';

import { spacing, useTheme, type Tone } from '@/theme';

import { Icon, type IconName } from './Icon';
import { useToneColors } from './StatusPill';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  /** Summary chips (Queue "Waiting 2 · longest 6 min") use a status tone. */
  tone?: Tone;
  testID?: string;
}

export function Chip({ label, selected, onPress, icon, tone, testID }: ChipProps) {
  const theme = useTheme();
  const toneColors = useToneColors(tone ?? 'neutral');
  const { colors } = theme;

  const fill = tone ? toneColors.fill : selected ? colors.primary50 : colors.surface;
  const border = tone ? toneColors.fill : selected ? colors.primary500 : colors.border;
  const ink = tone ? toneColors.ink : selected ? colors.primaryText : colors.text;

  const body = (
    <View style={[styles.chip, { backgroundColor: fill, borderColor: border }]}>
      {icon ? <Icon name={icon} size={14} color={ink} /> : null}
      <Text
        variant="small"
        weight={selected ? 'semibold' : 'medium'}
        style={{ color: ink }}
        tabular
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      aria-selected={selected}
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 32,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
  },
  pressed: { opacity: 0.7 },
});
