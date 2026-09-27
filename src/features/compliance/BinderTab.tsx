import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useInventory } from '@/features/inventory/api';
import { shareReceipt } from '@/features/sales/receipt';
import { isLanguage, isRtlLanguage } from '@/lib/i18n';
import { useDates } from '@/lib/useDates';
import { spacing, useTheme } from '@/theme';
import { Button, Card, FormError, QueryState, StatusPill, Text } from '@/ui';

import { HYGIENE_ITEMS, useCompliance, useHygieneLogs, useWpsStatus } from './api';
import { DOC_STATUS, useDocName } from './labels';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Everything an inspector asks for, on one screen, and as a PDF to print or share. */
export function BinderTab() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const dates = useDates();
  const docName = useDocName();
  const { business, branch } = useWorkspace();
  const slots = useCompliance(business.id);
  const hygiene = useHygieneLogs(branch.id);
  const wps = useWpsStatus(business.id, true);
  const items = useInventory(branch.id);

  const exportPdf = useMutation({
    mutationFn: async () => {
      const rows = slots.data ?? [];
      const ok = rows.filter((s) => s.status === 'valid' || s.status === 'due_soon').length;
      const rtl = isLanguage(i18n.language) && isRtlLanguage(i18n.language);
      const cell = (v: string) => `<td>${esc(v)}</td>`;
      const html = `<!doctype html><html dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>
        body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:${theme.colors.text};font-size:12px;margin:24px}
        h1{font-size:18px;margin:0} h2{font-size:14px;margin:18px 0 6px} .muted{color:${theme.colors.textSecondary}}
        table{width:100%;border-collapse:collapse} td,th{border-bottom:1px solid ${theme.colors.divider};padding:5px;text-align:start}
      </style></head><body>
        <h1>${esc(t('compliance.binder.pdfTitle'))} — ${esc(business.name)}</h1>
        <div class="muted">${esc(branch.name)} · ${esc(dates.day(new Date().toISOString().slice(0, 10), 'd MMMM yyyy'))} ·
          ${esc(t('compliance.readiness'))} ${rows.length ? Math.round((100 * ok) / rows.length) : 100}%</div>
        <h2>${esc(t('compliance.tabs.register'))}</h2>
        <table><tr><th>${esc(t('compliance.binder.record'))}</th><th>${esc(t('compliance.binder.holder'))}</th>
          <th>${esc(t('compliance.fields.number'))}</th><th>${esc(t('compliance.fields.expires'))}</th><th>${esc(t('compliance.binder.status'))}</th></tr>
          ${rows.map((s) => `<tr>${cell(docName(s.doc_type))}${cell(s.holder_name)}${cell(s.number ?? '—')}${cell(s.expires_on ? dates.day(s.expires_on, 'd MMM yyyy') : '—')}${cell(t(`compliance.status.${s.status}`))}</tr>`).join('')}
        </table>
        <h2>${esc(t('compliance.hygiene.history'))}</h2>
        <table>${(hygiene.data ?? []).slice(0, 7).map((l) => `<tr>${cell(dates.day(l.business_date, 'EEE d MMM'))}${cell(l.members?.display_name ?? '')}${cell(`${Object.values(l.checklist).filter(Boolean).length}/${HYGIENE_ITEMS.length}`)}</tr>`).join('') || `<tr>${cell(t('compliance.hygiene.none'))}</tr>`}</table>
        <h2>${esc(t('compliance.wps.title'))}</h2>
        <div>${wps.data?.period ? esc(t('compliance.wps.proven', { proven: wps.data.proven, required: wps.data.required })) : esc(t('compliance.wps.none'))}</div>
        <h2>${esc(t('compliance.montaji.title'))}</h2>
        <table>${(items.data ?? []).filter((i) => i.active && i.kind !== 'tool').map((i) => `<tr>${cell(i.name)}${cell(i.montaji_reg_no ?? t('compliance.montaji.missing'))}</tr>`).join('')}</table>
      </body></html>`;
      await shareReceipt(html, t('compliance.binder.export'));
    },
  });

  return (
    <QueryState query={slots}>
      {(rows) => (
        <View style={styles.body}>
          <Text color="textSecondary">{t('compliance.binder.hint')}</Text>
          <Button label={t('compliance.binder.export')} icon="printer" onPress={() => exportPdf.mutate()} loading={exportPdf.isPending} testID="binder-export" />
          <FormError error={exportPdf.error} />
          <Card variant="outlined" style={styles.card}>
            {rows.map((s) => (
              <View key={s.slot_key} style={styles.row} testID={`binder-${s.doc_type}-${s.holder_name}`}>
                <Text style={styles.flex}>
                  {docName(s.doc_type)}
                  {s.holder_type === 'employee' ? ` · ${s.holder_name}` : ''}
                </Text>
                <StatusPill status={DOC_STATUS[s.status]} label={t(`compliance.status.${s.status}`)} />
              </View>
            ))}
          </Card>
        </View>
      )}
    </QueryState>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
