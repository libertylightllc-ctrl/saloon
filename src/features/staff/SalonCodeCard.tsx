import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useSession, useWorkspace } from '@/features/auth/session';
import { supabase } from '@/lib/supabase';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { BottomSheet, Button, Card, FormError, Text, TextField, useToast } from '@/ui';

/** A salon code as the server keeps it: lower case, no spaces. */
export const tidyCode = (code: string) => code.trim().toLowerCase();
export const SALON_CODE = /^[a-z0-9]{4,12}$/;

/** The owner changes the salon code once; every staff login moves to it in the same step (F3, migration 105). */
function useChangeSalonCode(businessId: string) {
  const { reload } = useSession();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('change_salon_code', { p_business: businessId, p_code: tidyCode(code) });
      if (error) throw error;
      return data;
    },
    onSuccess: () => reload(),
  });
}

/** The salon code on Staff (people who manage logins), with "Change salon code" for the owner until it was changed once. */
export function SalonCodeCard({ canChange }: { canChange: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const dates = useDates();
  const { business } = useWorkspace();
  const change = useChangeSalonCode(business.id);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const close = () => {
    setOpen(false);
    setCode('');
    change.reset();
  };
  const changedAt = business.code_changed_at;

  return (
    <>
      <Card variant="tinted" style={styles.card}>
        <Text variant="small" color="textOnTint">
          {t('team.codeExplain')}
        </Text>
        <Text variant="h3" color="primaryText" testID="team-salon-code">
          {business.code}
        </Text>
        {canChange && changedAt ? (
          <Text variant="small" color="textOnTint" testID="salon-code-changed">
            {t('staff.changeCode.changedOn', { date: dates.at(changedAt, business.timezone, 'd MMM yyyy') })}
          </Text>
        ) : null}
        {canChange && !changedAt ? (
          <View style={styles.row}>
            <Button label={t('staff.changeCode.button')} icon="pencil" variant="outline" size="sm" onPress={() => setOpen(true)} testID="salon-code-change" />
          </View>
        ) : null}
      </Card>
      <BottomSheet open={open} onClose={close} title={t('staff.changeCode.button')}>
        <Text testID="salon-code-warning">{t('staff.changeCode.warning')}</Text>
        <Text color="textSecondary">{t('staff.changeCode.current', { code: business.code })}</Text>
        <TextField
          label={t('staff.changeCode.label')}
          hint={t('staff.changeCode.hint')}
          value={code}
          onChangeText={(v) => {
            setCode(v);
            change.reset();
          }}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={12}
          testID="salon-code-new"
        />
        <FormError error={change.error} />
        <Button
          label={t('staff.changeCode.confirm')}
          loading={change.isPending}
          disabled={!SALON_CODE.test(tidyCode(code))}
          onPress={() =>
            change.mutate(code, {
              onSuccess: (next) => {
                toast(t('staff.changeCode.done', { code: next }));
                close();
              },
            })
          }
          testID="salon-code-save"
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  row: { flexDirection: 'row', marginTop: spacing.xs },
});
