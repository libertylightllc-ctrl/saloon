import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';
import { Button, FormError, Icon, Text, useToast } from '@/ui';

import { resendSignUpEmail, type SignUpOutcome } from './api';

/**
 * After sign-up when there is no session yet: "check your inbox" (with Resend), or, for an address that already has
 * an account, the ways back in. Shown in place of the form, never as an error.
 */
export function SignUpDone({ outcome, email }: { outcome: Exclude<SignUpOutcome, 'signed_in'>; email: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const resend = useMutation({ mutationFn: () => resendSignUpEmail(email) });
  const inbox = outcome === 'check_email';

  return (
    <View style={styles.body} testID={inbox ? 'sign-up-check-inbox' : 'sign-up-already-registered'}>
      <View style={[styles.icon, { backgroundColor: theme.colors.primary50 }]}>
        <Icon name={inbox ? 'mail' : 'userCheck'} size={32} color={theme.colors.primaryText} />
      </View>
      <Text variant="h2" align="center" accessibilityRole="header">
        {t(inbox ? 'auth.checkInbox.title' : 'auth.alreadyRegistered.title')}
      </Text>
      <Text align="center" color="textSecondary">
        {inbox ? t('auth.checkInbox.body', { email }) : t('auth.alreadyRegistered.body', { email })}
      </Text>
      {inbox ? (
        <>
          <Text variant="small" align="center" color="textSecondary">
            {t('auth.checkInbox.spam')}
          </Text>
          <FormError error={resend.error} />
          <Button
            label={t('auth.checkInbox.resend')}
            variant="secondary"
            loading={resend.isPending}
            onPress={() => resend.mutate(undefined, { onSuccess: () => toast(t('auth.checkInbox.resent')) })}
            testID="sign-up-resend"
          />
          <Button label={t('auth.checkInbox.signIn')} variant="ghost" onPress={() => router.replace('/sign-in')} testID="sign-up-to-sign-in" />
        </>
      ) : (
        <>
          <Button label={t('auth.checkInbox.signIn')} onPress={() => router.replace('/sign-in')} testID="sign-up-to-sign-in" />
          <Button
            label={t('auth.alreadyRegistered.reset')}
            variant="secondary"
            onPress={() => router.replace('/forgot-password')}
            testID="sign-up-to-reset"
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, alignItems: 'stretch' },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
});
