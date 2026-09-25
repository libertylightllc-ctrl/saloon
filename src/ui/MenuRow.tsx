import { Pressable, StyleSheet, View } from 'react-native';

import { semantic, spacing, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface MenuRowProps {
  icon: IconName;
  label: string;
  /** Current value shown before the chevron ("English"). */
  value?: string;
  onPress?: () => void;
  /** Picks the icon square's colour (gents cycle through pastels). */
  index?: number;
  danger?: boolean;
  /** Hide the divider under the last row of a group. */
  last?: boolean;
  testID?: string;
}

/** Icon in a small pastel square, label, chevron — the Barber kit's Profile list. */
export function MenuRow({ icon, label, value, onPress, index = 0, danger, last, testID }: MenuRowProps) {
  const theme = useTheme();
  const { categoryFills, categoryIcons } = theme.colors;
  const fill = danger ? semantic.error.surface : categoryFills[index % categoryFills.length];
  const ink = danger ? semantic.error.hover : categoryIcons[index % categoryIcons.length];

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => [
        styles.row,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.divider,
        },
        pressed && { backgroundColor: theme.colors.primary50 },
      ]}
    >
      <View style={[styles.square, { backgroundColor: fill }]}>
        <Icon name={icon} size={16} color={ink} />
      </View>
      <Text style={[styles.label, danger && { color: semantic.error.hover }]} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text variant="small" color="textSecondary" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      <Icon name="chevronRight" size={18} color={theme.colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  square: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
});
