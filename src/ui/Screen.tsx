import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { screenPadding, spacing, useTheme } from '@/theme';

export interface ScreenProps {
  header?: ReactNode;
  children: ReactNode;
  /** Body on a white sheet with rounded top corners, as in both reference kits. Default true. */
  sheet?: boolean;
  scroll?: boolean;
  /** Sticky bar at the bottom (checkout, save…). */
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** 'flat' drops the ladies gradient on busy list/form screens. */
  background?: 'theme' | 'flat';
  /** Pad for the home indicator. Off inside tabs, where the tab bar does it. */
  insetBottom?: boolean;
  bodyStyle?: StyleProp<ViewStyle>;
}

export function Screen({
  header,
  children,
  sheet = true,
  scroll = true,
  footer,
  refreshing = false,
  onRefresh,
  background = 'theme',
  insetBottom = true,
  bodyStyle,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const gradient = background === 'theme' ? theme.backgroundGradient : null;
  // The gents band leaves room at its bottom for the sheet to overlap it.
  const overlap = header && sheet && theme.variants.header === 'band' ? theme.radius.sheet : 0;
  const bottomPad = insetBottom && !footer ? insets.bottom : 0;

  const body = (
    <View
      style={[
        styles.body,
        sheet && {
          backgroundColor: theme.colors.surface,
          borderTopStartRadius: theme.radius.sheet,
          borderTopEndRadius: theme.radius.sheet,
          marginTop: -overlap,
        },
        { paddingBottom: spacing['2xl'] + bottomPad },
        bodyStyle,
      ]}
    >
      {children}
    </View>
  );

  const content = (
    <>
      {header}
      {body}
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {gradient ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={{ height: insets.top, backgroundColor: theme.colors.headerArea }} />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.grow}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={theme.colors.primary500}
                />
              ) : undefined
            }
          >
            {content}
          </ScrollView>
        ) : (
          <View style={styles.root}>{content}</View>
        )}
        {footer ? (
          <View
            style={[
              styles.footer,
              {
                backgroundColor: theme.colors.surface,
                borderTopColor: theme.colors.divider,
                paddingBottom: spacing.md + (insetBottom ? insets.bottom : 0),
              },
            ]}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  grow: { flexGrow: 1 },
  body: { flexGrow: 1, paddingTop: spacing['2xl'], paddingHorizontal: screenPadding },
  footer: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
