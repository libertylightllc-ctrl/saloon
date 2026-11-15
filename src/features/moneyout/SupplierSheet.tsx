import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useWorkspace } from '@/features/auth/session';
import { phoneOk, phoneToSave } from '@/lib/phone';
import { BottomSheet, Button, FormError, TextField, useToast } from '@/ui';

import { useSaveSupplier, type Supplier } from './api';

/** Add a supplier (owner or cashier) or edit one (owner). Mounted fresh each time it opens. */
export function SupplierSheet({
  supplier,
  open,
  onClose,
  onSaved,
}: {
  supplier?: Supplier | null;
  open: boolean;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={open} onClose={onClose} title={t(supplier ? 'purchases.editSupplier' : 'purchases.newSupplier')}>
      {open ? <SupplierForm supplier={supplier ?? null} onDone={(id) => (onSaved ? onSaved(id) : onClose())} /> : null}
    </BottomSheet>
  );
}

function SupplierForm({ supplier, onDone }: { supplier: Supplier | null; onDone: (id: string) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business } = useWorkspace();
  const save = useSaveSupplier(business.id);
  const [name, setName] = useState(supplier?.name ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [terms, setTerms] = useState(String(supplier?.terms_days ?? 0));
  const termsOk = /^\d{1,3}$/.test(terms) && Number(terms) <= 365;
  const phoneValid = phoneOk(phone, business.country_code);

  return (
    <>
      <TextField label={t('purchases.supplierName')} value={name} onChangeText={setName} maxLength={80} testID="supplier-name" />
      <TextField
        label={t('purchases.supplierPhone')}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        error={phoneValid ? undefined : t('validation.phone')}
        testID="supplier-phone"
      />
      <TextField
        label={t('purchases.terms')}
        hint={t('purchases.termsHint')}
        value={terms}
        onChangeText={setTerms}
        keyboardType="number-pad"
        error={termsOk ? undefined : t('validation.range')}
        testID="supplier-terms"
      />
      <FormError error={save.error} />
      <Button
        label={t('common.save')}
        disabled={!name.trim() || !termsOk || !phoneValid}
        loading={save.isPending}
        onPress={() =>
          save.mutate(
            { id: supplier?.id, name: name.trim(), phone: phoneToSave(phone, business.country_code), terms_days: Number(terms) },
            {
              onSuccess: (id) => {
                toast(t('purchases.supplierSaved'));
                onDone(id);
              },
            },
          )
        }
        testID="supplier-save"
      />
    </>
  );
}
