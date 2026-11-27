import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useSupportSetStage, type SupportThreadRow } from '@/features/support/adminApi';
import { needsReason } from '@/features/support/stage';
import { spacing } from '@/theme';
import { Button, FormError, Text, TextField, useToast } from '@/ui';

type Target = 'waiting_team' | 'solved' | 'closed';

/**
 * Setting a conversation's status (owner's brief, Part E1): Mark solved, Close, or take it back to Waiting for you.
 * While nobody from the team has answered the salon's last message, Solved and Close ask for a reason; each change is
 * written to Changes.
 */
export function SupportStatusActions({ row, onDone }: { row: SupportThreadRow; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const setStage = useSupportSetStage();
  const [asking, setAsking] = useState<Target | null>(null);
  const [reason, setReason] = useState('');
  const go = (stage: Target, why?: string) =>
    setStage.mutate(
      { thread: row.id, stage, reason: why },
      {
        onSuccess: () => {
          toast(t('console.support.stageSaved', { stage: t(`console.support.stage.${stage}`) }));
          setAsking(null);
          setReason('');
          if (stage !== 'waiting_team') onDone();
        },
      },
    );
  const press = (stage: Target) => (needsReason(row.stage, stage) ? setAsking(stage) : go(stage));
  const targets: Target[] = [
    ...(row.stage !== 'solved' && row.stage !== 'closed' ? (['solved'] as const) : []),
    ...(row.stage !== 'closed' ? (['closed'] as const) : []),
    ...(row.stage !== 'waiting_team' ? (['waiting_team'] as const) : []),
  ];
  return (
    <View style={styles.box}>
      {asking ? (
        <View style={styles.box}>
          <Text color="textSecondary">{t('console.support.reasonHint')}</Text>
          <TextField
            label={t('console.support.reason')}
            value={reason}
            onChangeText={setReason}
            maxLength={200}
            testID="console-support-reason"
          />
          <View style={styles.row}>
            <Button
              label={t(asking === 'solved' ? 'console.support.markSolved' : 'console.support.close')}
              disabled={reason.trim().length < 3}
              loading={setStage.isPending}
              onPress={() => go(asking, reason)}
              testID="console-support-reason-confirm"
            />
            <Button label={t('common.cancel')} variant="ghost" onPress={() => setAsking(null)} />
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          {targets.map((s) => (
            <Button
              key={s}
              label={t(s === 'solved' ? 'console.support.markSolved' : s === 'closed' ? 'console.support.close' : 'console.support.takeBack')}
              variant={s === 'solved' ? 'secondary' : 'ghost'}
              size="sm"
              loading={setStage.isPending && setStage.variables?.stage === s}
              onPress={() => press(s)}
              testID={`console-support-to-${s}`}
            />
          ))}
        </View>
      )}
      <FormError error={setStage.error} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
