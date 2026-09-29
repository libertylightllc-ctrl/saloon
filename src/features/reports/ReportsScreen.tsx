import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { businessMonth, type MonthKey } from '@/lib/dates';
import { fileSlug, printHtml, shareCsv, sharePdf } from '@/lib/exportFile';
import { isLanguage, isRtlLanguage } from '@/lib/i18n';
import { useDates } from '@/lib/useDates';
import { semantic, spacing, useTheme } from '@/theme';
import { Button, FormError, HeaderBand, KpiCard, MonthSwitcher, PillTabs, QueryState, Screen } from '@/ui';

import { REPORT_TYPES, useOwnerControl, useReport, type ReportType } from './api';
import { ControlLine, useControlWords } from './ControlLine';
import { buildReport, csvHeader, type ReportView } from './definitions';
import { reportCsv, reportHtml } from './export';
import { ReportChart } from './ReportChart';
import { ReportTable } from './ReportTable';

/** Reports (owner and accountant): pick a report and a month; summary, chart, table; print, PDF and CSV. */
export function ReportsScreen({ asTab = false }: { asTab?: boolean }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const dates = useDates();
  const { business, branch } = useWorkspace();
  const params = useLocalSearchParams<{ type?: string }>();
  const [type, setType] = useState<ReportType>(
    REPORT_TYPES.includes(params.type as ReportType) ? (params.type as ReportType) : 'monthly',
  );
  const [month, setMonth] = useState<MonthKey>(businessMonth(new Date(), business.timezone));
  const report = useReport(type, business.id, branch.id, month);
  const control = useOwnerControl(branch.id);
  const controlWords = useControlWords();
  const view = useMemo<ReportView | null>(
    () => (report.data && report.data.type === type ? buildReport(report.data, { t, day: dates.day }) : null),
    [report.data, type, t, dates.day],
  );

  const title = t(`reports.types.${type}`);
  const period = dates.day(`${month}-01`, 'MMMM yyyy');
  const docName = `${fileSlug(business.name)}-${type}-${month}`;
  const html = () =>
    reportHtml(view!, {
      businessName: business.name,
      branchName: branch.name,
      title,
      period,
      control: control.data ? controlWords(control.data) : [],
      generated: t('reports.generated', { at: dates.at(new Date(), business.timezone, 'd MMM yyyy HH:mm') }),
      rtl: isLanguage(i18n.language) && isRtlLanguage(i18n.language),
      ink: theme.colors.text,
      muted: theme.colors.textSecondary,
      line: theme.colors.divider,
      error: semantic.error.main,
      warning: semantic.warning.main,
    });
  const pdf = useMutation({ mutationFn: () => sharePdf(html(), title) });
  const print = useMutation({ mutationFn: () => printHtml(html()) });
  const csv = useMutation({ mutationFn: () => shareCsv(docName, reportCsv(view!, csvHeader(type, t)), title) });
  const web = Platform.OS === 'web';

  return (
    <Screen
      refreshing={report.isRefetching}
      onRefresh={() => {
        void report.refetch();
        void control.refetch();
      }}
      header={
        <HeaderBand title={t('reports.title')} subtitle={t('reports.subtitle')} onBack={asTab ? undefined : true}>
          <PillTabs<ReportType>
            items={REPORT_TYPES.map((key) => ({ key, label: t(`reports.types.${key}`) }))}
            value={type}
            onChange={setType}
            testID="report-type"
          />
          <MonthSwitcher value={month} onChange={setMonth} />
        </HeaderBand>
      }
      footer={
        <View style={styles.footer}>
          {!web ? (
            <View style={styles.flex}>
              <Button label={t('reports.print')} icon="printer" variant="outline" disabled={!view} loading={print.isPending} onPress={() => print.mutate()} testID="report-print" />
            </View>
          ) : null}
          <View style={styles.flex}>
            <Button
              label={t(web ? 'reports.printPdf' : 'reports.pdf')}
              icon="fileText"
              variant="outline"
              disabled={!view}
              loading={pdf.isPending}
              onPress={() => pdf.mutate()}
              testID="report-pdf"
            />
          </View>
          <View style={styles.flex}>
            <Button label={t('reports.csv')} icon="download" disabled={!view} loading={csv.isPending} onPress={() => csv.mutate()} testID="report-csv" />
          </View>
        </View>
      }
    >
      <View style={styles.body}>
        <FormError error={pdf.error ?? print.error ?? csv.error} />
        <ControlLine query={control} />
        <QueryState query={report}>
          {() =>
            view ? (
              <View style={styles.body}>
                <View style={styles.kpis}>
                  {view.kpis.map((k) => (
                    <KpiCard key={k.key} label={k.label} value={k.value} delta={k.delta} style={styles.kpi} testID={`report-kpi-${k.key}`} />
                  ))}
                </View>
                <ReportChart chart={view.chart} />
                <ReportTable view={view} />
              </View>
            ) : null
          }
        </QueryState>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  kpi: { flexGrow: 1, flexBasis: '45%' },
  footer: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
