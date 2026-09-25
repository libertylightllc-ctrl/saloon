import { Pressable, StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface CategoryCircleProps {
  icon: IconName;
  label: string;
  /** Position in the row; gents cycle through pastel colours, ladies stay one coral tint. */
  index?: number;
  selected?: boolean;
  onPress?: () => void;
}

export function CategoryCircle({ icon, label, index = 0, selected, onPress }: CategoryCircleProps) {
  const theme = useTheme();
  const { categoryFills, categoryIcons } = theme.colors;
  const size = theme.sizes.category;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-selected={selected}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: categoryFills[index % categoryFills.length],
          },
          selected && { borderWidth: 2, borderColor: theme.colors.primary500 },
        ]}
      >
        <Icon name={icon} size={24} color={categoryIcons[index % categoryIcons.length]} />
      </View>
      <Text variant="micro" color="textSecondary" align="center" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm, width: 68 },
  circle: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
});
