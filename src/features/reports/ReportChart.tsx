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

/** The report's bar chart. Negative bars (a short till) are drawn below the line in the error colour. */
export function ReportChart({ chart }: { chart: ReportView['chart'] }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const bars = chart.bars;
  const unit = chart.money ? 100 : 1;
  const values = bars.map((b) => b.value / unit);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const slot = bars.length ? Math.max(10, Math.min(36, (width - 48) / bars.length)) : 0;
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
            barBorderRadius={3}
            noOfSections={4}
            maxValue={max > 0 ? max * 1.1 : undefined}
            mostNegativeValue={min < 0 ? min * 1.1 : undefined}
            noOfSectionsBelowXAxis={min < 0 ? 2 : 0}
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
