import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { semantic, spacing, useTheme } from '@/theme';
import { Card, Text } from '@/ui';

import type { ReportView } from './definitions';

const FIRST = 150;
const OTHER = 104;
/** Rows drawn on screen; the PDF and CSV always hold them all. */
const SHOWN = 200;

/** The report's rows. Wider than a phone, so it scrolls sideways inside its card. */
export function ReportTable({ view }: { view: ReportView }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const rows = view.rows.slice(0, SHOWN);
  const width = FIRST + OTHER * (view.columns.length - 1);
  const tone = (t?: 'error' | 'warning') => (t ? semantic[t].main : theme.colors.text);

  return (
    <Card variant="outlined" padding={0} style={styles.card}>
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.scroll}>
        <View style={{ width }} testID="report-table">
          <View style={[styles.row, styles.head, { borderColor: theme.colors.divider }]}>
            {view.columns.map((c, i) => (
              <Text
                key={c.label}
                variant="small"
                color="textSecondary"
                align={c.numeric ? 'end' : 'start'}
                style={{ width: i === 0 ? FIRST : OTHER }}
                numberOfLines={2}
              >
                {c.label}
              </Text>
            ))}
          </View>
          {rows.map((r) => (
            <View key={r.id} style={[styles.row, { borderColor: theme.colors.divider }]} testID={`report-row-${r.id}`}>
              {r.cells.map((cell, i) => (
                <Text
                  key={i}
                  variant={i === 0 ? 'bodyStrong' : 'small'}
                  tabular={view.columns[i]?.numeric}
                  align={view.columns[i]?.numeric ? 'end' : 'start'}
                  style={[{ width: i === 0 ? FIRST : OTHER }, i > 0 && r.tone ? { color: tone(r.tone) } : null]}
                  numberOfLines={2}
                >
                  {cell}
                </Text>
              ))}
            </View>
          ))}
          {view.rows.length > SHOWN ? (
            <Text variant="small" color="textSecondary" style={styles.empty} testID="report-more">
              {t('reports.moreRows', { shown: SHOWN, total: view.rows.length })}
            </Text>
          ) : null}
          {view.rows.length === 0 ? (
            <Text color="textSecondary" style={styles.empty} testID="report-empty">
              {view.empty}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  scroll: { padding: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  head: { paddingTop: 0 },
  empty: { paddingVertical: spacing.lg },
});
