/**
 * "Confirm your email" (owner's fix list C2). Owners are signed straight in after sign-up; until they open the link we
 * emailed, Home shows a banner (× hides it until the next day) and the Plan page says a plan needs a confirmed address.
 * Staff never see either. The database keeps the record (email_confirmations) and refuses plans until then.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { businessDate } from '@/lib/dates';
import { semantic, spacing } from '@/theme';
import { Button, Card, FormError, Icon, IconButton, Text } from '@/ui';

import { askEmailConfirmed, sendConfirmLink } from './api';
import { useSession, useWorkspace } from './session';

/** `unconfirmed` is true only once the database has said so (never while loading or offline), for owners. */
export function useEmailConfirmation() {
  const { session, role } = useSession();
  const email = session?.user.email ?? '';
  const userId = session?.user.id;
  const query = useQuery({
    queryKey: ['email-confirmed', userId],
    enabled: !!userId && role === 'owner' && !email.endsWith('.staff.internal'),
    staleTime: 5 * 60_000,
    queryFn: askEmailConfirmed,
  });
  return { email, unconfirmed: query.data?.confirmed === false };
}

/** Sends the link again (Supabase allows one a minute). */
export function useResendConfirmLink(email: string) {
  return useMutation({ mutationFn: () => sendConfirmLink(email) });
}

export function ConfirmEmailBanner() {
  const { t } = useTranslation();
  const { business } = useWorkspace();
  const { session } = useSession();
  const { email, unconfirmed } = useEmailConfirmation();
  const resend = useResendConfirmLink(email);
  const key = `confirmEmail.closedOn.${session?.user.id ?? ''}`;
  const today = businessDate(new Date(), business.timezone);
  // undefined while the device is asked when it was last closed.
  const [closedOn, setClosedOn] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    AsyncStorage.getItem(key).then(setClosedOn, () => setClosedOn(null));
  }, [key]);
  if (!unconfirmed || closedOn === undefined || closedOn === today) return null;

  const close = () => {
    setClosedOn(today);
    AsyncStorage.setItem(key, today).catch(() => undefined);
  };
  return (
    <Card variant="outlined" style={styles.card} testID="confirm-email-banner">
      <Icon name="mail" size={20} color={semantic.warning.main} />
      <View style={styles.flex}>
        <Text variant="body">{t('auth.confirmEmail.banner', { email })}</Text>
        {resend.isSuccess ? (
          <Text variant="small" color="textSecondary" testID="confirm-email-sent">
            {t('auth.confirmEmail.sent')}
          </Text>
        ) : null}
        <FormError error={resend.error} testID="confirm-email-error" />
        <View style={styles.actions}>
          <Button
            label={t('auth.confirmEmail.resend')}
            size="sm"
            variant="outline"
            loading={resend.isPending}
            onPress={() => resend.mutate()}
            testID="confirm-email-resend"
          />
        </View>
      </View>
      <IconButton icon="x" variant="plain" size={32} accessibilityLabel={t('common.close')} onPress={close} testID="confirm-email-close" />
    </Card>
  );
}

/** On the Plan page while the address is unconfirmed: why the buttons are off, and the link again. */
export function ConfirmEmailPlanNote() {
  const { t } = useTranslation();
  const { email, unconfirmed } = useEmailConfirmation();
  const resend = useResendConfirmLink(email);
  if (!unconfirmed) return null;
  return (
    <Card variant="outlined" style={styles.card} testID="plan-confirm-email">
      <Icon name="mail" size={20} color={semantic.warning.main} />
      <View style={styles.flex}>
        <Text variant="h4">{t('auth.confirmEmail.planTitle')}</Text>
        <Text variant="small" color="textSecondary">
          {t('auth.confirmEmail.planBody', { email })}
        </Text>
        {resend.isSuccess ? (
          <Text variant="small" color="textSecondary" testID="plan-confirm-email-sent">
            {t('auth.confirmEmail.sent')}
          </Text>
        ) : null}
        <FormError error={resend.error} testID="plan-confirm-email-error" />
        <View style={styles.actions}>
          <Button
            label={t('auth.confirmEmail.resend')}
            size="sm"
            variant="outline"
            loading={resend.isPending}
            onPress={() => resend.mutate()}
            testID="plan-confirm-email-resend"
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flex: { flex: 1, gap: spacing.xs },
  actions: { flexDirection: 'row', marginTop: spacing.xs },
});
