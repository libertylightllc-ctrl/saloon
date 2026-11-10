import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useSession, useWorkspace } from '@/features/auth/session';
import { useTerms } from '@/features/mode/useTerms';
import { parsePercent } from '@/lib/money';
import { spacing } from '@/theme';
import { Button, Card, FormError, HeaderBand, MoneyInput, QueryState, Screen, SectionHeader, SwitchRow, Text, TextField, useToast } from '@/ui';

import { useControls, useSaveControls, type Controls } from './api';

/** 1000 → "10", 1250 → "12.5". */
const pctText = (bps: number) => String(bps / 100);

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} />
      <Card variant="outlined" style={styles.card}>
        {children}
      </Card>
    </View>
  );
}

/**
 * Branch settings → Controls (brief B3, owner): the limits above which the front desk and stylists need a manager's
 * PIN, the cash differences that need a reason or tell the owner, blind count, and what stylists may do. Every change
 * is a line in the audit trail.
 */
export function ControlsScreen() {
  const { t } = useTranslation();
  const { branch } = useWorkspace();
  const controls = useControls(branch.id);
  return (
    <Screen header={<HeaderBand title={t('controls.title')} subtitle={t('controls.subtitle', { branch: branch.name })} onBack />}>
      <QueryState query={controls}>{(c) => <ControlsForm saved={c} />}</QueryState>
    </Screen>
  );
}

function ControlsForm({ saved }: { saved: Controls }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { reload } = useSession();
  const { branch } = useWorkspace();
  const terms = useTerms();
  const [draft, setDraft] = useState<Controls>(saved);
  const [pct, setPct] = useState(pctText(saved.discount_limit_bps));
  const save = useSaveControls(branch.id, () => void reload());
  const discount = parsePercent(pct);
  const set = <K extends keyof Controls>(key: K, value: Controls[K]) => setDraft({ ...draft, [key]: value });
  const next: Controls = { ...draft, discount_limit_bps: discount ?? draft.discount_limit_bps };
  const changes = Object.fromEntries(
    (Object.keys(next) as (keyof Controls)[]).filter((k) => next[k] !== saved[k]).map((k) => [k, next[k]]),
  ) as Partial<Controls>;
  const money = [next.petty_cash_limit_minor, next.cash_reason_minor, next.cash_notify_minor];
  const ready = discount !== null && money.every((m) => Number.isFinite(m) && m >= 0) && Object.keys(changes).length > 0;

  return (
    <View style={styles.body}>
      <Block title={t('controls.limits')}>
        <TextField
          label={t('controls.discountLimit')}
          hint={t('controls.discountLimitHint')}
          value={pct}
          onChangeText={setPct}
          keyboardType="decimal-pad"
          maxLength={6}
          error={discount === null ? t('controls.percentInvalid') : undefined}
          testID="controls-discount"
        />
        <MoneyInput
          label={t('controls.pettyCashLimit')}
          hint={t('controls.pettyCashLimitHint')}
          value={draft.petty_cash_limit_minor}
          onChange={(v) => set('petty_cash_limit_minor', v ?? NaN)}
          testID="controls-petty"
        />
      </Block>
      <Block title={t('controls.cash')}>
        <MoneyInput
          label={t('controls.cashReason')}
          hint={t('controls.cashReasonHint')}
          value={draft.cash_reason_minor}
          onChange={(v) => set('cash_reason_minor', v ?? NaN)}
          testID="controls-cash-reason"
        />
        <MoneyInput
          label={t('controls.cashNotify')}
          hint={t('controls.cashNotifyHint')}
          value={draft.cash_notify_minor}
          onChange={(v) => set('cash_notify_minor', v ?? NaN)}
          testID="controls-cash-notify"
        />
        <SwitchRow label={t('controls.blindCount')} hint={t('controls.blindCountHint')} value={draft.blind_count} onChange={(v) => set('blind_count', v)} testID="controls-blind" />
      </Block>
      <Block title={terms.staffPlural}>
        <SwitchRow label={t('controls.staffCanSell', { staff: terms.staffPlural })} hint={t('controls.staffCanSellHint')} value={draft.staff_can_sell} onChange={(v) => set('staff_can_sell', v)} testID="controls-staff-sell" />
        <SwitchRow label={t('controls.staffSeePhones', { staff: terms.staffPlural })} hint={t('controls.staffSeePhonesHint')} value={draft.staff_see_phones} onChange={(v) => set('staff_see_phones', v)} testID="controls-staff-phones" />
        <SwitchRow label={t('controls.staffBookSelf', { staff: terms.staffPlural })} hint={t('controls.staffBookSelfHint')} value={draft.staff_book_self} onChange={(v) => set('staff_book_self', v)} testID="controls-staff-book" />
      </Block>
      <Text variant="small" color="textSecondary">
        {t('controls.audit')}
      </Text>
      <FormError error={save.error} />
      <Button
        label={t('controls.save')}
        disabled={!ready}
        loading={save.isPending}
        onPress={() => save.mutate(changes, { onSuccess: () => toast(t('controls.saved')) })}
        testID="controls-save"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl },
  section: { gap: spacing.sm },
  card: { gap: spacing.md },
});
