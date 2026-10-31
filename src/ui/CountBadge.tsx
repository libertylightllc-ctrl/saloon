import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { semantic, spacing } from '@/theme';

import { Text } from './Text';

/** A red count on a menu row or a sidebar item ("3"; 9+ above nine), like the bell's. Nothing for 0. */
export function CountBadge({ count, style, testID }: { count: number; style?: StyleProp<ViewStyle>; testID?: string }) {
  if (count <= 0) return null;
  return (
    <View style={[styles.badge, { backgroundColor: semantic.error.hover }, style]} testID={testID}>
      <Text variant="micro" color="onPrimary" align="center" tabular>
        {count > 9 ? '9+' : String(count)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: spacing.xs, alignItems: 'center', justifyContent: 'center' },
});
