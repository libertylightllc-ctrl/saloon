import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { useDates } from '@/lib/useDates';
import { semantic, spacing } from '@/theme';
import { Button, Card, FormError, Text, TextField, useToast } from '@/ui';

import { useRedeemPilotCode, type PilotRefusal } from './api';

/**
 * "Have a pilot code?" (full update, Phase 6): the owner types the code the Saloqo team sent; the server checks it
 * (any letter case, one pilot per salon) and the salon becomes a pilot salon, free until the date it shows.
 */
export function PilotCodeCard({ businessId }: { businessId: string }) {
  const { t } = useTranslation();
  const dates = useDates();
  const toast = useToast();
  const redeem = useRedeemPilotCode(businessId);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [refusal, setRefusal] = useState<PilotRefusal | null>(null);
  if (!open) {
    return <Button variant="ghost" label={t('plan.pilot.link')} onPress={() => setOpen(true)} testID="plan-pilot-open" />;
  }
  const use = () =>
    redeem.mutate(code.trim(), {
      onSuccess: (r) => {
        if (r.ok && r.free_until) {
          toast(t('plan.access.pilot', { date: dates.day(r.free_until, 'd MMM yyyy') }));
          setOpen(false);
          setCode('');
        } else {
          setRefusal(r.reason ?? 'invalid_code');
        }
      },
    });
  return (
    <Card variant="outlined" style={styles.card} testID="plan-pilot">
      <Text variant="h4">{t('plan.pilot.title')}</Text>
      <TextField
        label={t('plan.pilot.field')}
        value={code}
        onChangeText={(v) => {
          setCode(v);
          setRefusal(null);
        }}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={40}
        testID="plan-pilot-code"
      />
      {refusal ? (
        <Text variant="small" style={{ color: semantic.error.main }} testID="plan-pilot-refused">
          {t(`plan.pilot.refused.${refusal}` as 'plan.pilot.refused.invalid_code')}
        </Text>
      ) : null}
      <FormError error={redeem.error} />
      <Button
        label={t('plan.pilot.action')}
        loading={redeem.isPending}
        disabled={code.trim().length < 3}
        onPress={use}
        testID="plan-pilot-use"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
});
