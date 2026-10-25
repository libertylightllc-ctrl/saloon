import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { Button, Card, FormError, QueryState, StatusPill, Text, TextField, useToast } from '@/ui';

import { useBillingSettings, useSetBilling } from './api';

/**
 * Settings (full update, Phase 6 g): billing on or off for everyone — with a confirmation, as it decides whether
 * owners see prices and whether an ended free period stops new work — the public free days, the pilot's days and how
 * many pilot salons there can be.
 */
export function BillingTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const settings = useBillingSettings();
  const set = useSetBilling();
  const [confirming, setConfirming] = useState(false);
  const [free, setFree] = useState('');
  const [pilot, setPilot] = useState('');
  const [max, setMax] = useState('');
  const s = settings.data;
  useEffect(() => {
    if (!s) return;
    setFree(String(s.public_free_days));
    setPilot(String(s.pilot_free_days));
    setMax(String(s.pilot_max_salons));
  }, [s]);
  const whole = (v: string) => (/^\d{1,5}$/.test(v.trim()) ? Number(v) : null);
  const numbersOk = whole(free) !== null && whole(pilot) !== null && whole(max) !== null;

  return (
    <QueryState query={settings}>
      {(b) => (
        <View style={styles.body}>
          <Card variant="outlined" style={styles.card} testID="console-billing">
            <View style={styles.row}>
              <Text variant="h4" style={styles.flex}>
                {t('console.billing.title')}
              </Text>
              <StatusPill status={b.billing_enabled ? 'valid' : 'archived'} label={t(b.billing_enabled ? 'console.billing.on' : 'console.billing.off')} />
            </View>
            <Text color="textSecondary">{t(b.billing_enabled ? 'console.billing.onBody' : 'console.billing.offBody')}</Text>
            {confirming ? (
              <View style={styles.card} testID="console-billing-confirm">
                <Text variant="bodyStrong">{t(b.billing_enabled ? 'console.billing.confirmOff' : 'console.billing.confirmOn')}</Text>
                <View style={styles.row}>
                  <Button
                    label={t(b.billing_enabled ? 'console.billing.turnOff' : 'console.billing.turnOn')}
                    loading={set.isPending}
                    onPress={() =>
                      set.mutate(
                        { billing_enabled: !b.billing_enabled },
                        { onSuccess: () => { setConfirming(false); toast(t('console.access.saved')); } },
                      )
                    }
                    testID="console-billing-yes"
                  />
                  <Button label={t('common.cancel')} variant="ghost" onPress={() => setConfirming(false)} />
                </View>
              </View>
            ) : (
              <Button
                label={t(b.billing_enabled ? 'console.billing.turnOff' : 'console.billing.turnOn')}
                variant="secondary"
                onPress={() => setConfirming(true)}
                testID="console-billing-switch"
              />
            )}
          </Card>
          <Card variant="outlined" style={styles.card}>
            <Text variant="h4">{t('console.billing.numbers')}</Text>
            <TextField label={t('console.billing.freeDays')} value={free} onChangeText={setFree} keyboardType="number-pad" testID="console-free-days" />
            <TextField label={t('console.billing.pilotDays')} value={pilot} onChangeText={setPilot} keyboardType="number-pad" testID="console-pilot-days" />
            <TextField label={t('console.billing.pilotMax')} value={max} onChangeText={setMax} keyboardType="number-pad" testID="console-pilot-max" />
            <FormError error={set.error} />
            <Button
              label={t('common.save')}
              disabled={!numbersOk}
              loading={set.isPending && !confirming}
              onPress={() =>
                set.mutate(
                  { public_free_days: whole(free)!, pilot_free_days: whole(pilot)!, pilot_max_salons: whole(max)! },
                  { onSuccess: () => toast(t('console.access.saved')) },
                )
              }
              testID="console-billing-save"
            />
          </Card>
        </View>
      )}
    </QueryState>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
