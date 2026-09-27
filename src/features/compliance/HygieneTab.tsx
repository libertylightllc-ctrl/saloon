import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { PhotoButtons, PickedPreview } from '@/features/moneyout/ReceiptPhoto';
import type { PickedPhoto } from '@/features/moneyout/receipts';
import { businessDate } from '@/lib/dates';
import { can } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { Button, Card, CheckRow, FormError, QueryState, SectionHeader, StatusPill, Text, TextField, useToast } from '@/ui';

import { HYGIENE_ITEMS, useHygieneLogs, useSignHygiene } from './api';

/** Today's hygiene checklist, signed by whoever is on the desk, and the last two weeks. */
export function HygieneTab() {
  const { t } = useTranslation();
  const dates = useDates();
  const { business, branch, role } = useWorkspace();
  const logs = useHygieneLogs(branch.id);
  const today = businessDate(new Date(), business.timezone);
  return (
    <QueryState query={logs}>
      {(rows) => {
        const signed = rows.find((l) => l.business_date === today);
        return (
          <View style={styles.body}>
            {signed ? (
              <Card variant="outlined" style={styles.card} testID="hygiene-today">
                <StatusPill status="valid" label={t('compliance.hygiene.signedBy', { name: signed.members?.display_name ?? '' })} />
                <Text color="textSecondary">
                  {t('compliance.hygiene.done', { n: Object.values(signed.checklist).filter(Boolean).length, total: HYGIENE_ITEMS.length })}
                </Text>
              </Card>
            ) : can(role, 'signHygiene') ? (
              <SignForm />
            ) : null}
            <SectionHeader title={t('compliance.hygiene.history')} />
            {rows.length === 0 ? <Text color="textSecondary">{t('compliance.hygiene.none')}</Text> : null}
            {rows.map((l) => {
              const done = Object.values(l.checklist).filter(Boolean).length;
              return (
                <View key={l.id} style={styles.row} testID={`hygiene-${l.business_date}`}>
                  <Text style={styles.flex}>{dates.day(l.business_date, 'EEE d MMM')}</Text>
                  <Text color="textSecondary">{l.members?.display_name}</Text>
                  <StatusPill status={done === HYGIENE_ITEMS.length ? 'valid' : 'low'} label={`${done}/${HYGIENE_ITEMS.length}`} />
                </View>
              );
            })}
          </View>
        );
      }}
    </QueryState>
  );
}

function SignForm() {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, branch } = useWorkspace();
  const sign = useSignHygiene(business.id, branch.id);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const evidenceRequired = (branch.settings as Record<string, unknown> | null)?.require_hygiene_evidence === true;
  return (
    <Card variant="outlined" style={styles.card}>
      <Text variant="h4">{t('compliance.hygiene.today')}</Text>
      {HYGIENE_ITEMS.map((item) => (
        <CheckRow key={item} label={t(`compliance.hygiene.items.${item}`)} value={Boolean(checks[item])} onChange={(v) => setChecks((c) => ({ ...c, [item]: v }))} testID={`hygiene-${item}`} />
      ))}
      <TextField label={t('compliance.hygiene.note')} value={note} onChangeText={setNote} maxLength={200} testID="hygiene-note" />
      <Text variant="small" color="textSecondary">
        {t(evidenceRequired ? 'compliance.hygiene.photoRequired' : 'compliance.hygiene.photoOptional')}
      </Text>
      {photo ? <PickedPreview photo={photo} onRemove={() => setPhoto(null)} /> : <PhotoButtons onPicked={setPhoto} />}
      <FormError error={sign.error} />
      <Button
        label={t('compliance.hygiene.sign')}
        disabled={evidenceRequired && !photo}
        loading={sign.isPending}
        onPress={() =>
          sign.mutate(
            { checklist: checks, note: note.trim() || null, photo, date: businessDate(new Date(), business.timezone) },
            { onSuccess: () => toast(t('compliance.hygiene.signed')) },
          )
        }
        testID="hygiene-sign"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
