import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { BottomSheet, Button, FormError, Text, TextField, useToast } from '@/ui';

import { useSetPaymentDetails, type PaymentDetails } from './api';

const FIELDS = ['bank_name', 'bank_account_name', 'bank_iban', 'bank_swift', 'pay_link_url', 'pay_note'] as const;

/** For the platform owner: where salons pay (shown on every salon's Plan page). Empty fields are not shown. */
export function PaymentDetailsSheet({ open, onClose, current }: { open: boolean; onClose: () => void; current: PaymentDetails | undefined }) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={open} onClose={onClose} title={t('admin.pay.title')}>
      {open ? <Form current={current} onDone={onClose} /> : null}
    </BottomSheet>
  );
}

function Form({ current, onDone }: { current: PaymentDetails | undefined; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const save = useSetPaymentDetails();
  const [values, setValues] = useState<Record<(typeof FIELDS)[number], string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f, current?.[f] ?? ''])) as Record<(typeof FIELDS)[number], string>,
  );
  const field = (key: (typeof FIELDS)[number], extra: { autoCapitalize?: 'none' | 'characters'; multiline?: boolean } = {}) => (
    <TextField
      label={t(`admin.pay.fields.${key}`)}
      value={values[key]}
      onChangeText={(v) => setValues((s) => ({ ...s, [key]: v }))}
      testID={`admin-pay-${key}`}
      {...extra}
    />
  );

  return (
    <View style={styles.body}>
      <Text color="textSecondary">{t('admin.pay.hint')}</Text>
      <Text variant="bodyStrong">{t('admin.pay.transfer')}</Text>
      {field('bank_name')}
      {field('bank_account_name')}
      {field('bank_iban', { autoCapitalize: 'characters' })}
      {field('bank_swift', { autoCapitalize: 'characters' })}
      <Text variant="bodyStrong">{t('admin.pay.card')}</Text>
      {field('pay_link_url', { autoCapitalize: 'none' })}
      {field('pay_note', { multiline: true })}
      <FormError error={save.error} />
      <Button
        label={t('common.save')}
        loading={save.isPending}
        onPress={() =>
          save.mutate(values, {
            onSuccess: () => {
              toast(t('admin.pay.saved'));
              onDone();
            },
          })
        }
        testID="admin-pay-save"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
});
