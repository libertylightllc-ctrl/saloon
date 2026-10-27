import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { PhotoButtons, PickedPreview } from '@/features/moneyout/ReceiptPhoto';
import type { PickedPhoto } from '@/features/moneyout/receipts';
import { useStaffDirectory } from '@/features/staff/api';
import type { BusinessDate } from '@/lib/dates';
import { spacing } from '@/theme';
import { Button, Chip, DateField, FormError, MoneyInput, Text, TextField, useToast } from '@/ui';

import { useSaveDocument, useUpdateDocument, type HolderType, type Slot } from './api';

/**
 * Add details to a slot, renew it (a new version), add the owner's own record, or (`edit`) correct the current version
 * in place — the owner's own records can be renamed then.
 */
export function DocumentForm({
  slot,
  edit = false,
  onDone,
}: {
  slot: Slot | null;
  edit?: boolean;
  onDone: (id: string, docType: string) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, branch } = useWorkspace();
  const staff = useStaffDirectory(business.id, slot === null);
  const save = useSaveDocument(business.id, branch.id);
  const update = useUpdateDocument(business.id, branch.id);
  const editing = edit && Boolean(slot?.document_id);
  const renewing = !editing && Boolean(slot?.document_id);
  const renamable = editing && slot !== null && !slot.required;
  const [name, setName] = useState(renamable ? slot!.doc_type : '');
  const [holder, setHolder] = useState<HolderType>('premises');
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [number, setNumber] = useState(renewing ? '' : (slot?.number ?? ''));
  const [issued, setIssued] = useState<BusinessDate | ''>(editing ? (slot?.issued_on ?? '') : '');
  const [expires, setExpires] = useState<BusinessDate | ''>(editing ? (slot?.expires_on ?? '') : '');
  const [cost, setCost] = useState<number | null>(slot?.renewal_cost_minor ?? null);
  const [reminder, setReminder] = useState(String(slot?.reminder_days ?? 30));
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const reminderOk = /^\d{1,3}$/.test(reminder) && Number(reminder) <= 365;
  const ok =
    (slot !== null || (name.trim().length > 0 && (holder !== 'employee' || employeeId))) &&
    (!renamable || name.trim().length > 0) &&
    reminderOk &&
    (!issued || !expires || expires >= issued);

  return (
    <>
      {renewing ? <Text color="textSecondary">{t('compliance.renewHint')}</Text> : null}
      {editing ? <Text color="textSecondary">{t('compliance.editHint')}</Text> : null}
      {renamable ? (
        <TextField label={t('compliance.fields.name')} value={name} onChangeText={setName} maxLength={60} testID="doc-name" />
      ) : null}
      {slot === null ? (
        <>
          <TextField label={t('compliance.fields.name')} value={name} onChangeText={setName} maxLength={60} testID="doc-name" />
          <View style={styles.chips}>
            {(['company', 'premises', 'employee'] as const).map((h) => (
              <Chip key={h} label={t(`compliance.holders.${h}`)} selected={holder === h} onPress={() => setHolder(h)} testID={`doc-holder-${h}`} />
            ))}
          </View>
          {holder === 'employee' ? (
            <View style={styles.chips}>
              {(staff.data ?? []).filter((s) => s.active).map((s) => (
                <Chip key={s.employee_id} label={s.full_name} selected={employeeId === s.employee_id} onPress={() => setEmployeeId(s.employee_id)} testID={`doc-person-${s.full_name}`} />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
      <TextField label={t('compliance.fields.number')} value={number} onChangeText={setNumber} maxLength={60} testID="doc-number" />
      <DateField label={t('compliance.fields.issued')} value={issued} onChange={setIssued} clearable testID="doc-issued" />
      <DateField label={t('compliance.fields.expires')} value={expires} onChange={setExpires} min={issued || undefined} clearable testID="doc-expires" />
      <MoneyInput label={t('compliance.fields.cost')} value={cost} onChange={setCost} testID="doc-cost" />
      <TextField label={t('compliance.fields.reminder')} value={reminder} onChangeText={setReminder} keyboardType="number-pad" error={reminderOk ? undefined : t('validation.range')} testID="doc-reminder" />
      <Text variant="bodyStrong">{t('compliance.fields.evidence')}</Text>
      {photo ? <PickedPreview photo={photo} onRemove={() => setPhoto(null)} /> : <PhotoButtons onPicked={setPhoto} />}
      <FormError error={editing ? update.error : save.error} />
      <Button
        label={t(renewing ? 'compliance.renew' : 'common.save')}
        disabled={!ok}
        loading={save.isPending || update.isPending}
        onPress={() =>
          editing
            ? update.mutate(
                {
                  id: slot!.document_id!,
                  doc_type: renamable ? name.trim() : slot!.doc_type,
                  holder_type: slot!.holder_type,
                  number: number.trim() || null,
                  issued_on: issued || null,
                  expires_on: expires || null,
                  renewal_cost_minor: cost,
                  reminder_days: Number(reminder),
                  photo,
                },
                {
                  onSuccess: () => {
                    toast(t('compliance.changesSaved'));
                    onDone(slot!.document_id!, renamable ? name.trim() : slot!.doc_type);
                  },
                },
              )
            : save.mutate(
                {
                  doc_type: slot?.doc_type ?? name.trim(),
                  holder_type: slot?.holder_type ?? holder,
                  branch_id: slot ? slot.branch_id : holder === 'employee' ? null : branch.id,
                  employee_id: slot ? slot.employee_id : holder === 'employee' ? employeeId : null,
                  number: number.trim() || null,
                  issued_on: issued || null,
                  expires_on: expires || null,
                  renewal_cost_minor: cost,
                  reminder_days: Number(reminder),
                  photo,
                },
                {
                  onSuccess: (id) => {
                    toast(t(renewing ? 'compliance.renewed' : 'compliance.saved'));
                    onDone(id, slot?.doc_type ?? name.trim());
                  },
                },
              )
        }
        testID="doc-save"
      />
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
