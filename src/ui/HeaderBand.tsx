/**
 * Screen header, drawn per theme (02-DESIGN-SYSTEM §2):
 * - gents: dark title on lavender, then a violet band with rounded top corners and a faint
 *   contour pattern; the white body sheet overlaps the band's bottom.
 * - ladies: light header on blush, centred dark title, coral square back button.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { screenPadding, spacing, tapTarget, useTheme } from '@/theme';

import { BackButton } from './BackButton';
import { ContourPattern } from './ContourPattern';
import { Text } from './Text';

const OnBandContext = createContext(false);

/** True inside the gents violet band: content there uses white text and white tabs. */
export function useOnBand(): boolean {
  return useContext(OnBandContext);
}

export interface HeaderBandProps {
  title?: string;
  subtitle?: string;
  /** Shows the back button. Pass `true` to go back in the navigation stack. */
  onBack?: (() => void) | true;
  right?: ReactNode;
  /** Replaces the title row (Home: avatar + greeting, or the wordmark). */
  top?: ReactNode;
  /** Band content (gents) or content under the title (ladies): search, tabs, chips. */
  children?: ReactNode;
}

export function HeaderBand({ title, subtitle, onBack, right, top, children }: HeaderBandProps) {
  const theme = useTheme();
  const band = theme.variants.header === 'band';

  const titleRow = top ?? (
    <View style={styles.titleRow}>
      <View style={styles.side}>
        {onBack ? <BackButton onPress={onBack === true ? undefined : onBack} /> : null}
      </View>
      <Text variant="h3" align="center" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={[styles.side, styles.sideEnd]}>{right}</View>
    </View>
  );

  return (
    <View style={{ backgroundColor: theme.colors.headerArea }}>
      {titleRow}
      {band ? (
        <View
          style={[
            styles.band,
            {
              backgroundColor: theme.colors.primary500,
              borderTopStartRadius: theme.radius.sheet,
              borderTopEndRadius: theme.radius.sheet,
              paddingBottom: spacing.xl + theme.radius.sheet,
            },
          ]}
        >
          <ContourPattern color={theme.colors.primary300} />
          {subtitle ? (
            <Text align="center" color="onPrimary" style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
          <OnBandContext.Provider value>{children}</OnBandContext.Provider>
        </View>
      ) : (
        <View style={styles.light}>
          {subtitle ? (
            <Text align="center" color="textOnTint" style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: screenPadding,
    gap: spacing.sm,
  },
  side: { minWidth: tapTarget, flexDirection: 'row', alignItems: 'center' },
  sideEnd: { justifyContent: 'flex-end', gap: spacing.sm },
  title: { flex: 1 },
  band: {
    overflow: 'hidden',
    paddingTop: spacing.xl,
    paddingHorizontal: screenPadding,
    gap: spacing.lg,
  },
  light: { paddingHorizontal: screenPadding, paddingBottom: spacing.xl, gap: spacing.lg },
  subtitle: { paddingHorizontal: spacing.lg },
});
