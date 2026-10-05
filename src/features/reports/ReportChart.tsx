import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { formatMoney } from '@/lib/money';
import { semantic, spacing, useTheme } from '@/theme';
import { Card, Text } from '@/ui';

import type { ReportView } from './definitions';

/** Whole currency units on the axis, shortened: 1,250 → "1.3k". */
function axisLabel(label: string): string {
  const n = Number(label);
  if (!Number.isFinite(n)) return label;
  const abs = Math.abs(n);
  if (abs >= 1000) return `${n < 0 ? '-' : ''}${(abs / 1000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

/** A round step for the axis (1, 1.5, 2, 2.5, 3, 4, 5, 6 or 8 × a power of ten): lines read 0 · 250 · 500 · 750 · 1k. */
export function niceStep(rough: number): number {
  if (rough <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((f) => f * power >= rough) ?? 10;
  return step * power;
}

const SECTIONS = 4;
/** Room after the last bar, so its label is not cut off at the card's edge. */
const END_SPACE = 16;

/** The report's bar chart. Negative bars (a short till) are drawn below the line in the error colour. */
export function ReportChart({ chart }: { chart: ReportView['chart'] }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const bars = chart.bars;
  const unit = chart.money ? 100 : 1;
  const values = bars.map((b) => b.value / unit);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const plot = width - 48 - spacing.sm - END_SPACE;
  const slot = bars.length ? Math.max(10, Math.min(36, plot / bars.length)) : 0;
  const step = niceStep(Math.max(max, -min) / SECTIONS);
  // Below the line (a short till): whole steps of the same size.
  const below = min < 0 ? Math.ceil(-min / step) : 0;
  const barWidth = Math.max(6, slot * 0.6);
  const everyNth = Math.ceil(bars.length / Math.max(1, Math.floor((width - 48) / 28)));
  const summary = bars
    .filter((b) => b.value !== 0)
    .map((b) => `${b.label}: ${chart.money ? formatMoney(b.value) : b.value}`)
    .join(', ');

  return (
    <Card variant="outlined" style={styles.card}>
      <Text variant="bodyStrong">{chart.title}</Text>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${chart.title}. ${summary}`}
        testID="report-chart"
      >
        {width > 0 && bars.length > 0 && (max > 0 || min < 0) ? (
          <BarChart
            data={bars.map((b, i) => ({
              value: b.value / unit,
              label: i % everyNth === 0 ? b.label : '',
              frontColor: b.value < 0 ? semantic.error.main : theme.colors.primary500,
            }))}
            width={width - 48}
            height={160}
            barWidth={barWidth}
            spacing={Math.max(2, slot - barWidth)}
            initialSpacing={spacing.sm}
            endSpacing={END_SPACE}
            barBorderRadius={3}
            noOfSections={SECTIONS}
            maxValue={max > 0 ? step * SECTIONS : undefined}
            stepValue={max > 0 ? step : undefined}
            mostNegativeValue={below ? -step * below : undefined}
            noOfSectionsBelowXAxis={below}
            formatYLabel={axisLabel}
            yAxisLabelWidth={40}
            yAxisThickness={0}
            xAxisThickness={1}
            xAxisColor={theme.colors.divider}
            rulesColor={theme.colors.divider}
            yAxisTextStyle={{ color: theme.colors.textSecondary, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: theme.colors.textSecondary, fontSize: 10 }}
            labelWidth={Math.max(slot, 24)}
            disableScroll
            isAnimated={false}
          />
        ) : (
          <Text variant="small" color="textSecondary" style={styles.none}>
            —
          </Text>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  none: { paddingVertical: spacing.lg, textAlign: 'center' },
});
