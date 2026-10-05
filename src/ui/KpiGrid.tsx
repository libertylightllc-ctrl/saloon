import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '@/theme';

type CardElement = ReactElement<{ style?: StyleProp<ViewStyle> }>;

/**
 * Number cards that wrap instead of sliding sideways (owner's call 2026-10-05): two to a row on phones — an odd last
 * card takes the whole row — and more to a row where there is room. Each card fills its cell, so a row's bottoms line up.
 */
export function KpiGrid({ children, minCell = 140 }: { children: ReactNode; minCell?: number }) {
  return (
    <View style={styles.grid}>
      {Children.toArray(children)
        .filter((card): card is CardElement => isValidElement(card))
        .map((card, i) => (
          <View key={card.key ?? i} style={[styles.cell, { flexBasis: minCell }]}>
            {cloneElement(card, { style: [styles.fill, card.props.style] })}
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { flexGrow: 1 },
  fill: { flexGrow: 1, minWidth: 0 },
});
