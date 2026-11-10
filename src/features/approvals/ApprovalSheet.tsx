import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { spacing, useTheme } from '@/theme';
import { BottomSheet, Button, Card, Chip, FormError, Icon, QueryState, Text, TextField } from '@/ui';

import { useApproveWithPin, useApprovers, type ApprovalRequest, type Approved } from './api';

const digits = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 4);

/**
 * "Manager approval needed" (brief B5): what is asked, then a manager or the owner picks their name and types their
 * quick-switch PIN on this device. Shown in its own sheet, or inside a sheet already open (`ApprovalPanel`).
 */
export function ApprovalSheet({
  request,
  onApproved,
  onClose,
}: {
  request: ApprovalRequest | null;
  onApproved: (approved: Approved) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={request !== null} onClose={onClose} title={t('approval.title')}>
      {request ? <ApprovalPanel request={request} onApproved={onApproved} /> : null}
    </BottomSheet>
  );
}

export function ApprovalPanel({
  request,
  onApproved,
  onBack,
}: {
  request: ApprovalRequest;
  onApproved: (approved: Approved) => void;
  /** Inside another sheet: back to what was being done. */
  onBack?: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { branch } = useWorkspace();
  const approvers = useApprovers(branch.id);
  const approve = useApproveWithPin(branch.id);
  const [who, setWho] = useState<string | null>(null);
  const [pin, setPin] = useState('');

  const submit = () => {
    if (!who || pin.length !== 4) return;
    approve.mutate({ request, approver: who, pin }, { onSuccess: onApproved, onError: () => setPin('') });
  };

  return (
    <View style={styles.body} testID="approval">
      {onBack ? (
        <Text variant="h4" testID="approval-title">
          {t('approval.title')}
        </Text>
      ) : null}
      <Card variant="tinted" style={styles.ask}>
        <Icon name="lock" size={18} color={theme.colors.primary500} />
        <Text variant="bodyStrong" color="textOnTint" style={styles.flex} testID="approval-summary">
          {request.summary}
        </Text>
      </Card>
      <QueryState query={approvers} skeletonRows={1}>
        {(list) => {
          if (list.length === 0) {
            return (
              <Text color="textSecondary" testID="approval-nobody">
                {t('approval.nobody')}
              </Text>
            );
          }
          const chosen = list.find((a) => a.member_id === who);
          return (
            <View style={styles.body}>
              <Text color="textSecondary">{t('approval.hint')}</Text>
              <View style={styles.wrap}>
                {list.map((a) => (
                  <Chip
                    key={a.member_id}
                    label={a.locked ? t('approval.lockedName', { name: a.name }) : `${a.name} · ${t(`roles.${a.role}`)}`}
                    selected={a.member_id === who}
                    onPress={a.locked ? undefined : () => {
                      setWho(a.member_id);
                      setPin('');
                      approve.reset();
                    }}
                    testID={`approver-${a.name}`}
                  />
                ))}
              </View>
              {chosen ? (
                <TextField
                  label={t('approval.pin', { name: chosen.name })}
                  value={pin}
                  onChangeText={(v) => setPin(digits(v))}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  autoFocus
                  onSubmitEditing={submit}
                  testID="approval-pin"
                />
              ) : null}
              <FormError error={approve.error} testID="approval-error" />
              <Button
                label={t('approval.approve')}
                icon="check"
                disabled={!chosen || pin.length !== 4}
                loading={approve.isPending}
                onPress={submit}
                testID="approval-approve"
              />
            </View>
          );
        }}
      </QueryState>
      {onBack ? <Button label={t('common.back')} variant="ghost" onPress={onBack} testID="approval-back" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  ask: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  flex: { flex: 1 },
});
