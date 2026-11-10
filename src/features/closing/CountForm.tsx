import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useControls } from '@/features/controls/api';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { spacing } from '@/theme';
import {
  Button,
  Card,
  CheckRow,
  FormError,
  MoneyInput,
  SegmentTabs,
  Text,
  TextField,
  useToast,
} from '@/ui';

import { useSubmitCount, type ClosingPreview } from './api';
import { compact } from './count';
import { DenominationSheet } from './DenominationSheet';
import { VarianceChip } from './ExpectedCard';

type TakenTo = 'bank' | 'owner';

/**
 * Counted cash, the difference (not with the blind count), cash taken out (owner, manager), the drawer-closed tick;
 * draft / send / approve. "Counted by" is always the person signed in. Only the owner sends and approves in one step;
 * a manager's count is approved by the owner or another manager.
 */
export function CountForm({ preview }: { preview: ClosingPreview }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, branch, member, role } = useWorkspace();
  const draft = preview.closing;
  const controls = useControls(branch.id);
  const submit = useSubmitCount(branch.id, business.id);
  const owner = role === 'owner';
  const cashOut = can(role, 'cashOut');

  const [counted, setCounted] = useState<number | null>(draft?.counted_cash_minor ?? null);
  const [denominations, setDenominations] = useState(draft?.denominations ?? {});
  const [countKey, setCountKey] = useState(0);
  const [reason, setReason] = useState(draft?.reason ?? '');
  const [takenOut, setTakenOut] = useState<number | null>(draft?.taken_out_minor || null);
  const [takenTo, setTakenTo] = useState<TakenTo>(draft?.taken_out_to ?? 'bank');
  const [confirmed, setConfirmed] = useState(false);
  const [counting, setCounting] = useState(false);

  const expected = preview.expected_cash_minor;
  // A reason is needed at or above the branch's limit; under it, optional. Blind: the server says when one is needed.
  const reasonFrom = controls.data?.cash_reason_minor ?? 0;
  const difference = counted !== null && expected !== null ? Math.abs(counted - expected) : 0;
  const differs = difference > 0;
  const needsReason = differs && difference >= reasonFrom;
  const takenTooMuch = takenOut !== null && counted !== null && takenOut > counted;
  const ready = counted !== null && confirmed && (!needsReason || reason.trim().length >= 3) && !takenTooMuch;

  const send = (mode: 'draft' | 'submit' | 'approve') =>
    submit.mutate(
      {
        business_date: preview.business_date,
        counted_cash_minor: counted,
        denominations: compact(denominations),
        drawer_closed_confirmed: confirmed,
        reason: reason.trim() || null,
        taken_out_minor: cashOut ? (takenOut ?? 0) : 0,
        taken_out_to: cashOut && takenOut ? takenTo : null,
        submit: mode !== 'draft',
        approve: mode === 'approve',
      },
      { onSuccess: () => toast(t(`closing.done.${mode}`)) },
    );

  return (
    <Card variant="outlined" style={styles.card}>
      <MoneyInput
        key={countKey}
        label={t('closing.counted')}
        value={counted}
        onChange={setCounted}
        testID="closing-counted"
      />
      <Button
        label={t('closing.countNotes')}
        icon="banknote"
        variant="ghost"
        size="md"
        onPress={() => setCounting(true)}
        testID="closing-count-notes"
      />
      {counted !== null && expected !== null ? <VarianceChip counted={counted} expected={expected} /> : null}
      {differs || preview.blind ? (
        <TextField
          label={needsReason || preview.blind ? t('closing.reason') : t('closing.reasonOptional')}
          hint={t('closing.reasonHint', { amount: formatMoney(reasonFrom) })}
          value={reason}
          onChangeText={setReason}
          maxLength={200}
          testID="closing-reason"
        />
      ) : null}

      <Text color="textSecondary" testID="closing-counted-by">
        {t('closing.countedByName', { name: member.display_name })}
      </Text>

      {cashOut ? (
        <MoneyInput
          label={t('closing.takenOut')}
          hint={t('closing.takenOutHint')}
          value={takenOut}
          onChange={setTakenOut}
          error={takenTooMuch ? t('closing.takenTooMuch', { amount: formatMoney(counted ?? 0) }) : undefined}
          testID="closing-taken-out"
        />
      ) : null}
      {cashOut && takenOut ? (
        <SegmentTabs<TakenTo>
          items={[
            { key: 'bank', label: t('closing.takenTo.bank') },
            { key: 'owner', label: t('closing.takenTo.owner') },
          ]}
          value={takenTo}
          onChange={setTakenTo}
          testID="closing-taken-to"
        />
      ) : null}

      <CheckRow label={t('closing.confirm')} value={confirmed} onChange={setConfirmed} testID="closing-confirm" />
      <FormError error={submit.error} />
      <View style={styles.actions}>
        <Button
          label={t('closing.saveDraft')}
          variant="outline"
          size="md"
          disabled={submit.isPending}
          onPress={() => send('draft')}
          testID="closing-save-draft"
        />
        <Button
          label={owner ? t('closing.approve') : t('closing.submit')}
          size="md"
          disabled={!ready}
          loading={submit.isPending}
          onPress={() => send(owner ? 'approve' : 'submit')}
          testID={owner ? 'closing-approve' : 'closing-submit'}
        />
      </View>
      <DenominationSheet
        open={counting}
        initial={denominations}
        onClose={() => setCounting(false)}
        onDone={(counts, total) => {
          setDenominations(counts);
          setCounted(total);
          setCountKey((k) => k + 1);
          setCounting(false);
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'flex-end' },
});
