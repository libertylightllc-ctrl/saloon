import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
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

import { HeaderOverlapContext } from './layoutContext';

export interface ScreenProps {
  header?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  /** Sticky bar at the bottom (checkout, save…). */
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /**
   * Ladies: 'gradient' (peach → pink → lavender) for home and onboarding, 'flat' (#FFF7F5) for
   * lists and forms. Gents are always flat lavender.
   */
  background?: 'gradient' | 'flat';
  /** Pull the first card up over the gents band (Home's "Expected cash" card). */
  overlapHeader?: boolean;
  /** Pad for the home indicator. Off inside tabs, where the tab bar does it. */
  insetBottom?: boolean;
  bodyStyle?: StyleProp<ViewStyle>;
}

/** Distance the body overlaps the band when `overlapHeader` is on. */
const OVERLAP = spacing['3xl'];

export function Screen({
  header,
  children,
  scroll = true,
  footer,
  refreshing = false,
  onRefresh,
  background = 'flat',
  overlapHeader,
  insetBottom = true,
  bodyStyle,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const gradient = background === 'gradient' ? theme.backgroundGradient : null;
  const band = Boolean(header) && theme.variants.header === 'band';
  const sheet = theme.variants.body === 'sheet';
  const overlap = band && overlapHeader ? OVERLAP : 0;
  const bottomPad = insetBottom && !footer ? insets.bottom : 0;

  const body = (
    <View
      style={[
        styles.body,
        sheet && {
          backgroundColor: theme.colors.surface,
          borderTopStartRadius: theme.radius.sheet,
          borderTopEndRadius: theme.radius.sheet,
        },
        { marginTop: -overlap, paddingTop: overlap ? 0 : spacing['2xl'] },
        { paddingBottom: spacing['2xl'] + bottomPad },
        bodyStyle,
      ]}
    >
      {children}
    </View>
  );

  const content = (
    <HeaderOverlapContext.Provider value={overlap}>
      {header}
      {body}
    </HeaderOverlapContext.Provider>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={band ? 'light' : 'dark'} />
      {gradient ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {/* The gents band continues under the status bar. */}
      <View
        style={{
          height: insets.top,
          backgroundColor: band ? theme.colors.primary500 : theme.colors.headerArea,
        }}
      />
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
  body: { flexGrow: 1, paddingHorizontal: screenPadding },
  footer: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
