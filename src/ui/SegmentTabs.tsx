import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { useOnBand } from './layoutContext';
import { Text } from './Text';

export interface TabItem<K extends string> {
  key: K;
  label: string;
  count?: number;
}

export interface SegmentTabsProps<K extends string> {
  items: readonly TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  /** White labels on the violet band. Detected automatically inside <HeaderBand>. */
  onBand?: boolean;
}

/**
 * Gents: underline tabs (white on the band, violet on white). Ladies: pill tabs — active is a
 * filled coral pill with white text (Fashly "Popular / Facial / Hair").
 */
export function SegmentTabs<K extends string>({
  items,
  value,
  onChange,
  onBand: onBandProp,
}: SegmentTabsProps<K>) {
  const theme = useTheme();
  const insideBand = useOnBand();
  const onBand = onBandProp ?? insideBand;
  const { colors } = theme;
  const pill = theme.variants.segmentTabs === 'pill';

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, pill ? styles.pillRow : styles.lineRow]}
      accessibilityRole="tablist"
    >
      {items.map((item) => {
        const active = item.key === value;
        const label = item.count === undefined ? item.label : `${item.label} ${item.count}`;
        const ink = pill
          ? active
            ? colors.onPrimary
            : colors.text
          : onBand
            ? active
              ? colors.onPrimary
              : colors.primary100
            : active
              ? colors.primaryText
              : colors.textSecondary;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            hitSlop={pill ? 4 : 0}
            style={[
              pill ? styles.pill : styles.line,
              pill && {
                borderRadius: theme.radius.sm,
                backgroundColor: active ? colors.primaryAction : 'transparent',
              },
            ]}
          >
            <Text
              variant="bodyStrong"
              weight={active ? 'semibold' : 'regular'}
              style={{ color: ink }}
              tabular
            >
              {label}
            </Text>
            {!pill ? (
              <View
                style={[
                  styles.underline,
                  {
                    backgroundColor: active
                      ? onBand
                        ? colors.onPrimary
                        : colors.primary500
                      : 'transparent',
                  },
                ]}
              />
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** The spec's name for the same component (03-SCREENS). */
export const PillTabs = SegmentTabs;

const styles = StyleSheet.create({
  row: { flexGrow: 1 },
  pillRow: { gap: spacing.sm },
  lineRow: { gap: spacing.xl },
  pill: { minHeight: 36, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  line: { minHeight: 44, justifyContent: 'center', gap: spacing.xs, paddingTop: spacing.sm },
  underline: { height: 3, borderRadius: 2, alignSelf: 'stretch' },
});
