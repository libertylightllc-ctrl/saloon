import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { useSession, useWorkspace } from '@/features/auth/session';
import { useSetOpeningCash } from '@/features/team/api';
import { spacing } from '@/theme';
import { Button, Card, FormError, MoneyInput, SectionHeader, Text, useToast } from '@/ui';

/** Cash in the drawer on day one. Posted once (Dr cash, Cr owner equity); later changes go through cash closing. */
export function OpeningCashCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const { reload } = useSession();
  const { branch } = useWorkspace();
  const set = useSetOpeningCash(branch.id);
  const [amount, setAmount] = useState<number | null>(null);
  const done = (branch.settings as Record<string, unknown>).opening_cash_set === true;

  return (
    <Card variant="outlined" style={styles.card}>
      <SectionHeader title={t('branch.openingCash')} />
      {done ? (
        <Text color="textSecondary" testID="opening-cash-done">
          {t('branch.openingCashDone')}
        </Text>
      ) : (
        <>
          <Text variant="small" color="textSecondary">
            {t('branch.openingCashHint')}
          </Text>
          <MoneyInput label={t('branch.fields.openingCash')} value={amount} onChange={setAmount} testID="opening-cash" />
          <FormError error={set.error} />
          <Button
            label={t('branch.setOpeningCash')}
            variant="secondary"
            disabled={!amount}
            loading={set.isPending}
            onPress={() =>
              set.mutate(amount!, {
                onSuccess: () => {
                  toast(t('branch.openingCashSaved'));
                  void reload();
                },
              })
            }
            testID="opening-cash-save"
          />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({ card: { gap: spacing.md } });
