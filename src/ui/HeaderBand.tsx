/**
 * Screen header, drawn per theme (02-DESIGN-SYSTEM §2):
 * - gents: violet band (primary500) from the top of the screen with a faint contour pattern,
 *   white title and back arrow, 28-px rounded bottom corners.
 * - ladies: light header on blush, centred dark title, coral square back button.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { screenPadding, spacing, tapTarget, useTheme } from '@/theme';

import { BackButton } from './BackButton';
import { ContourPattern } from './ContourPattern';
import { OnBandContext, useHeaderOverlap } from './layoutContext';
import { Text } from './Text';

export interface HeaderBandProps {
  title?: string;
  subtitle?: string;
  /** Shows the back button. Pass `true` to go back in the navigation stack. */
  onBack?: (() => void) | true;
  right?: ReactNode;
  /** Replaces the title row (Home: avatar + greeting, or the wordmark). */
  top?: ReactNode;
  /** Content under the title: search, tabs, chips. */
  children?: ReactNode;
}

export function HeaderBand({ title, subtitle, onBack, right, top, children }: HeaderBandProps) {
  const theme = useTheme();
  const overlap = useHeaderOverlap();
  const band = theme.variants.header === 'band';

  const content = (
    <>
      {top ?? (
        <View style={styles.titleRow}>
          <View style={styles.side}>
            {onBack ? <BackButton onPress={onBack === true ? undefined : onBack} /> : null}
          </View>
          <Text
            variant="h3"
            align="center"
            numberOfLines={1}
            color={band ? 'onPrimary' : 'text'}
            accessibilityRole="header"
            style={styles.title}
          >
            {title}
          </Text>
          <View style={[styles.side, styles.sideEnd]}>{right}</View>
        </View>
      )}
      {subtitle ? (
        <Text align="center" color={band ? 'onPrimary' : 'textOnTint'} style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}
      {children}
    </>
  );

  if (!band) {
    return <View style={[styles.header, styles.light]}>{content}</View>;
  }

  return (
    <View
      style={[
        styles.header,
        styles.band,
        {
          backgroundColor: theme.colors.primary500,
          borderBottomStartRadius: theme.radius.xl,
          borderBottomEndRadius: theme.radius.xl,
          paddingBottom: spacing['2xl'] + overlap,
        },
      ]}
    >
      <ContourPattern color={theme.colors.primary300} />
      <OnBandContext.Provider value>{content}</OnBandContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: screenPadding, gap: spacing.lg },
  band: { overflow: 'hidden', paddingTop: spacing.xs },
  light: { paddingBottom: spacing.xl },
  titleRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  side: { minWidth: tapTarget, flexDirection: 'row', alignItems: 'center' },
  sideEnd: { justifyContent: 'flex-end', gap: spacing.sm },
  title: { flex: 1 },
  subtitle: { paddingHorizontal: spacing.lg },
});
