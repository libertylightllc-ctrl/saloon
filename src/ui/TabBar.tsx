import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface TabBarItem {
  icon: IconName;
  label: string;
  /** The centre tab (Quick sale) gets a slightly larger icon. */
  prominent?: boolean;
}

/**
 * White bar, five items. Active = primary icon + label; gents add a small bar above the active
 * item like the Barber kit.
 */
export function TabBar({
  state,
  navigation,
  items,
}: BottomTabBarProps & { items: Record<string, TabBarItem> }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { colors } = theme;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
          paddingBottom: insets.bottom || spacing.sm,
        },
      ]}
      accessibilityRole="tablist"
    >
      {state.routes.map((route, index) => {
        const item = items[route.name];
        if (!item) return null;
        const focused = state.index === index;
        const tint = focused ? colors.primary500 : colors.textSecondary;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={item.label}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented)
                navigation.navigate(route.name, route.params);
            }}
            style={styles.item}
          >
            <View
              style={[
                styles.indicator,
                {
                  backgroundColor:
                    focused && theme.variants.tabBarIndicator ? colors.primary500 : 'transparent',
                },
              ]}
            />
            <View style={styles.iconBox}>
              <Icon
                name={item.icon}
                size={item.prominent ? 28 : 24}
                color={tint}
                strokeWidth={focused ? 2 : 1.75}
              />
            </View>
            <Text
              variant="micro"
              align="center"
              weight={focused ? 'semibold' : 'medium'}
              style={{ color: focused ? colors.primaryText : colors.textSecondary }}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  item: { flex: 1, alignItems: 'center', gap: 2, minHeight: 56, paddingBottom: spacing.xs },
  indicator: { width: 24, height: 3, borderRadius: 2, marginBottom: spacing.sm },
  iconBox: { height: 28, justifyContent: 'center' },
});
