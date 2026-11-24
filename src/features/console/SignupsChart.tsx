import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { countryName } from '@/lib/countries';
import { formatBusinessDate } from '@/lib/dates';
import { chartSeries, spacing, useTheme } from '@/theme';
import { Card, QueryState, Text } from '@/ui';

import { niceStep } from '@/features/reports/ReportChart';

import { useSignups } from './overviewApi';
import { OTHER, stackSignups } from './signups';

const SECTIONS = 4;
const END_SPACE = 16;

/**
 * B8 New sign-ups (owner's brief, Part B): new salons each week for the last 12 weeks, stacked by country (the top
 * five, the rest as Other), with a legend of the 12 weeks' totals. Test salons are left out.
 */
export function SignupsChart() {
  const query = useSignups();
  return <QueryState query={query}>{(s) => <Chart data={stackSignups(s)} />}</QueryState>;
}

function Chart({ data }: { data: ReturnType<typeof stackSignups> }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const colours = [theme.colors.primary500, ...chartSeries];
  const colourOf = (i: number, code: string) => (code === OTHER ? theme.colors.neutral.n60 : colours[i % colours.length]!);
  const nameOf = (code: string) => (code === OTHER ? t('console.signups.other') : countryName(code, i18n.language));
  const label = (week: string) => formatBusinessDate(week, 'd MMM', i18n.language);
  const max = Math.max(0, ...data.weeks.map((w) => w.total));
  const step = niceStep(Math.max(1, max) / SECTIONS);
  const plot = width - 40 - spacing.sm - END_SPACE;
  const slot = data.weeks.length ? Math.max(8, Math.min(40, plot / data.weeks.length)) : 0;
  const barWidth = Math.max(6, slot * 0.6);
  const everyNth = Math.ceil(data.weeks.length / Math.max(1, Math.floor((width - 40) / 44)));
  const summary = data.weeks.map((w) => `${label(w.week)}: ${w.total}`).join(', ');
  return (
    <Card variant="outlined" style={styles.card} testID="console-signups">
      <Text variant="bodyStrong">{t('console.signups.title')}</Text>
      <Text variant="small" color="textSecondary">
        {t('console.signups.sub', { n: data.total })}
      </Text>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${t('console.signups.title')}. ${summary}`}
        testID="console-signups-chart"
      >
        {max === 0 ? (
          <Text variant="small" color="textSecondary" style={styles.none}>
            {t('console.signups.none')}
          </Text>
        ) : width > 0 ? (
          <BarChart
            stackData={data.weeks.map((w, i) => ({
              label: i % everyNth === 0 ? label(w.week) : '',
              stacks: w.parts.some((n) => n > 0)
                ? w.parts.flatMap((n, j) => (n > 0 ? [{ value: n, color: colourOf(j, data.series[j]!.code) }] : []))
                : [{ value: 0, color: theme.colors.divider }],
            }))}
            width={width - 40}
            height={160}
            barWidth={barWidth}
            spacing={Math.max(2, slot - barWidth)}
            initialSpacing={spacing.sm}
            endSpacing={END_SPACE}
            barBorderRadius={3}
            noOfSections={SECTIONS}
            maxValue={step * SECTIONS}
            stepValue={step}
            yAxisLabelWidth={32}
            yAxisThickness={0}
            xAxisThickness={1}
            xAxisColor={theme.colors.divider}
            rulesColor={theme.colors.divider}
            yAxisTextStyle={{ color: theme.colors.textSecondary, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: theme.colors.textSecondary, fontSize: 10 }}
            labelWidth={Math.max(slot * everyNth, 32)}
            disableScroll
            isAnimated={false}
          />
        ) : (
          <View style={styles.room} />
        )}
      </View>
      {data.series.length > 0 ? (
        <View style={styles.legend} testID="console-signups-legend">
          {data.series.map((x, i) => (
            <View key={x.code} style={styles.key}>
              <View style={[styles.dot, { backgroundColor: colourOf(i, x.code) }]} />
              <Text variant="small">{`${nameOf(x.code)} · ${x.total}`}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  none: { paddingVertical: spacing.lg, textAlign: 'center' },
  /** The chart's height until the card's width is known. */
  room: { height: 190 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  key: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
