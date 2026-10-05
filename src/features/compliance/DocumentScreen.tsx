import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { PhotoButtons } from '@/features/moneyout/ReceiptPhoto';
import { useReceiptUrl } from '@/features/moneyout/receipts';
import { formatMoney } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import { spacing, useTheme } from '@/theme';
import { Button, Card, EmptyState, FormError, HeaderBand, QueryState, Screen, SectionHeader, StatusPill, Text, useToast } from '@/ui';

import { useAttachEvidence, useCompliance, useVersions } from './api';
import { DocumentActions, type DocumentStage } from './DocumentActions';
import { DocumentForm } from './DocumentForm';
import { DOC_STATUS, useDocName } from './labels';

function Row({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={styles.row}>
      <Text color="textSecondary" style={styles.flex}>
        {label}
      </Text>
      <Text variant="bodyStrong" tabular testID={testID}>
        {value}
      </Text>
    </View>
  );
}

/** One record: current version, its scan, earlier versions; add details, renew, edit or delete it. Owner. */
export function DocumentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const toast = useToast();
  const dates = useDates();
  const docName = useDocName();
  const params = useLocalSearchParams<{ type?: string; branch?: string; employee?: string; new?: string }>();
  const { business, branch } = useWorkspace();
  const slots = useCompliance(business.id);
  const [sheet, setSheet] = useState<DocumentStage | null>(null);
  const slot =
    params.new === '1'
      ? null
      : (slots.data?.find(
          (s) => s.doc_type === params.type && (params.employee ? s.employee_id === params.employee : !s.employee_id && s.branch_id === params.branch),
        ) ?? null);
  const versions = useVersions(business.id, slot);
  const evidence = useReceiptUrl(slot?.evidence_path, 'documents');
  const attach = useAttachEvidence(business.id, branch.id);

  if (params.new === '1') {
    return (
      <Screen header={<HeaderBand title={t('compliance.addOther')} onBack />}>
        <View style={styles.body}>
          <DocumentForm slot={null} onDone={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <>
      <Screen header={<HeaderBand title={slot ? docName(slot.doc_type) : t('compliance.title')} subtitle={slot?.holder_name} onBack />}>
        <QueryState query={slots}>
          {() =>
            !slot ? (
              <EmptyState illustration="no-results" message={t('errors.not_found')} />
            ) : (
              <View style={styles.body}>
                <Card variant="outlined" style={styles.card}>
                  <StatusPill status={DOC_STATUS[slot.status]} label={t(`compliance.status.${slot.status}`)} />
                  {slot.document_id ? (
                    <>
                      <Row label={t('compliance.fields.number')} value={slot.number ?? '—'} testID="doc-detail-number" />
                      <Row label={t('compliance.fields.issued')} value={slot.issued_on ? dates.day(slot.issued_on, 'd MMM yyyy') : '—'} />
                      <Row label={t('compliance.fields.expires')} value={slot.expires_on ? dates.day(slot.expires_on, 'd MMM yyyy') : '—'} testID="doc-detail-expires" />
                      {slot.renewal_cost_minor !== null ? <Row label={t('compliance.fields.cost')} value={formatMoney(slot.renewal_cost_minor)} /> : null}
                      <Row label={t('compliance.fields.version')} value={String(slot.version)} testID="doc-detail-version" />
                    </>
                  ) : (
                    <Text color="textSecondary">{t('compliance.noDocument')}</Text>
                  )}
                  <Button
                    label={t(slot.document_id ? 'compliance.renew' : 'compliance.addDetails')}
                    icon={slot.document_id ? 'rotate' : 'plus'}
                    size="md"
                    onPress={() => setSheet(slot.document_id ? 'renew' : 'add')}
                    testID="doc-edit"
                  />
                  <View style={styles.actions}>
                    {slot.document_id ? (
                      <Button
                        label={t('compliance.editDetails')}
                        icon="pencil"
                        variant="secondary"
                        size="md"
                        onPress={() => setSheet('edit')}
                        testID="doc-edit-details"
                      />
                    ) : null}
                    <Button label={t('compliance.delete')} icon="trash" variant="ghost" size="md" onPress={() => setSheet('delete')} testID="doc-delete" />
                  </View>
                </Card>
                {slot.document_id ? (
                  <View style={styles.card}>
                    <SectionHeader title={t('compliance.fields.evidence')} />
                    {evidence.data ? (
                      <Pressable role="button" aria-label={t('receipts.view')} testID="doc-evidence">
                        <Image source={{ uri: evidence.data }} style={[styles.thumb, { borderRadius: theme.radius.md }]} />
                      </Pressable>
                    ) : slot.evidence_path ? null : (
                      <>
                        <Text color="textSecondary">{t('compliance.addEvidenceHint')}</Text>
                        <PhotoButtons
                          loading={attach.isPending}
                          onPicked={(photo) => attach.mutate({ document_id: slot.document_id!, photo }, { onSuccess: () => toast(t('compliance.evidenceAdded')) })}
                        />
                        <FormError error={attach.error} />
                      </>
                    )}
                  </View>
                ) : null}
                <QueryState query={versions} isEmpty={(rows) => rows.length < 2} empty={null}>
                  {(rows) => (
                    <View style={styles.card}>
                      <SectionHeader title={t('compliance.versions')} />
                      {rows.map((v) => (
                        <View key={v.id} style={styles.row} testID={`doc-version-${v.version}`}>
                          <Text style={styles.flex}>{t('compliance.versionLine', { n: v.version, number: v.number ?? '—' })}</Text>
                          <Text color="textSecondary">{v.expires_on ? dates.day(v.expires_on, 'd MMM yyyy') : '—'}</Text>
                          {v.active ? <StatusPill status="valid" label={t('compliance.current')} /> : null}
                        </View>
                      ))}
                    </View>
                  )}
                </QueryState>
              </View>
            )
          }
        </QueryState>
      </Screen>
      <DocumentActions
        slot={sheet ? slot : null}
        start={sheet ?? 'menu'}
        onClose={() => setSheet(null)}
        onDeleted={() => router.back()}
        // A renamed record keeps its page.
        onSaved={(docType) => {
          if (docType !== params.type) router.setParams({ type: docType });
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  flex: { flex: 1 },
  thumb: { width: 160, height: 160 },
});
