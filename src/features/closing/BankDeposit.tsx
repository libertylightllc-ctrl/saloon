import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { businessDate, shiftBusinessDate, type BusinessDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { BottomSheet, Button, DateStrip, FormError, Text, TextField, useToast } from '@/ui';

import { useRecordBankDeposit, type Closing } from './api';

/**
 * Cash taken out to the bank at an approved close: the day it reached the bank and the slip number, recorded by the
 * owner, a manager or the accountant. It moved to the bank account when the close was approved; this changes no money.
 */
export function BankDeposit({ closing }: { closing: Closing }) {
  const { t } = useTranslation();
  const dates = useDates();
  const { role } = useWorkspace();
  const [open, setOpen] = useState(false);
  const amount = formatMoney(closing.taken_out_minor);

  if (closing.banked_on) {
    return (
      <Text color="textSecondary" testID="closing-banked">
        {closing.bank_ref
          ? t('closing.bank.reachedRef', { amount, date: dates.day(closing.banked_on, 'EEE d MMM'), ref: closing.bank_ref })
          : t('closing.bank.reached', { amount, date: dates.day(closing.banked_on, 'EEE d MMM') })}
      </Text>
    );
  }
  return (
    <View style={styles.block}>
      <Text color="textSecondary">{t('closing.bank.notYet', { amount })}</Text>
      {can(role, 'bankDeposit') ? (
        <View style={styles.row}>
          <Button
            label={t('closing.bank.record')}
            icon="landmark"
            variant="outline"
            size="md"
            onPress={() => setOpen(true)}
            testID="closing-bank-record"
          />
        </View>
      ) : null}
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t('closing.bank.record')}>
        {open ? <DepositForm closing={closing} onDone={() => setOpen(false)} /> : null}
      </BottomSheet>
    </View>
  );
}

function DepositForm({ closing, onDone }: { closing: Closing; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, branch } = useWorkspace();
  const record = useRecordBankDeposit(branch.id, business.id);
  const today = businessDate(new Date(), business.timezone);
  // From the day of the close up to today, at most the last 30 days.
  const days: BusinessDate[] = [];
  for (let d = today; d >= closing.business_date && days.length < 30; d = shiftBusinessDate(d, -1)) days.unshift(d);
  const [day, setDay] = useState<BusinessDate>(today);
  const [ref, setRef] = useState('');
  return (
    <>
      <Text color="textSecondary">{t('closing.bank.hint', { amount: formatMoney(closing.taken_out_minor) })}</Text>
      <Text variant="bodyStrong">{t('closing.bank.day')}</Text>
      <DateStrip dates={days} value={day} onChange={setDay} />
      <TextField label={t('closing.bank.ref')} value={ref} onChangeText={setRef} maxLength={60} testID="closing-bank-ref" />
      <FormError error={record.error} />
      <Button
        label={t('common.save')}
        loading={record.isPending}
        onPress={() =>
          record.mutate(
            { closing_id: closing.id, banked_on: day, ref: ref.trim() },
            {
              onSuccess: () => {
                toast(t('closing.bank.saved'));
                onDone();
              },
            },
          )
        }
        testID="closing-bank-save"
      />
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  row: { flexDirection: 'row' },
});
