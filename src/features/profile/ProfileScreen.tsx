import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useSession, useWorkspace } from '@/features/auth/session';
import { spacing } from '@/theme';
import { Avatar, Button, Card, FormError, HeaderBand, Screen, SectionHeader, Text, TextField, useToast } from '@/ui';

import { useChangeEmail, useChangePassword, useRenameBusiness, useUpdateProfile } from './api';

const PHONE = /^\+?[0-9 ]{7,20}$/;

/**
 * The signed-in person's own profile (owner, 2026-10-06): name and phone (a staff member's also show in the salon's
 * staff list), the salon's name for the owner, how they sign in, and their password.
 */
export function ProfileScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const { session } = useSession();
  const { member, business, role } = useWorkspace();
  const owner = role === 'owner';
  const staffLogin = !session?.user.email || session.user.email.endsWith('.staff.internal');

  const update = useUpdateProfile();
  const [name, setName] = useState(member.display_name);
  const [phone, setPhone] = useState(member.phone ?? '');
  const nameOk = name.trim().length >= 2 && name.trim().length <= 60;
  const phoneOk = phone.trim() === '' || PHONE.test(phone.trim());
  const changed = name.trim() !== member.display_name || phone.trim() !== (member.phone ?? '');

  const rename = useRenameBusiness(business.id);
  const [salonName, setSalonName] = useState(business.name);

  const changeEmail = useChangeEmail();
  const [email, setEmail] = useState('');

  const changePassword = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');

  return (
    <Screen header={<HeaderBand title={t('profile.title')} onBack />}>
      <View style={styles.body}>
        <SectionHeader title={t('profile.details')} />
        <Card style={styles.card}>
          <View style={styles.row}>
            <Avatar name={name.trim() || member.display_name} size={56} />
            <View style={styles.flex}>
              <TextField label={t('profile.name')} value={name} onChangeText={setName} maxLength={60} testID="profile-name" />
            </View>
          </View>
          <TextField
            label={t('profile.phone')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={20}
            error={phoneOk ? undefined : t('errors.invalid_phone')}
            testID="profile-phone"
          />
          {!owner ? (
            <Text variant="small" color="textSecondary">
              {t('profile.staffNote')}
            </Text>
          ) : null}
          <FormError error={update.error} />
          <Button
            label={t('profile.save')}
            disabled={!nameOk || !phoneOk || !changed}
            loading={update.isPending}
            onPress={() => update.mutate({ display_name: name.trim(), phone: phone.trim() }, { onSuccess: () => toast(t('profile.saved')) })}
            testID="profile-save"
          />
        </Card>

        {owner ? (
          <>
            <SectionHeader title={t('profile.salon')} />
            <Card style={styles.card}>
              <TextField label={t('profile.salonName')} value={salonName} onChangeText={setSalonName} maxLength={80} testID="profile-salon-name" />
              <FormError error={rename.error} />
              <Button
                label={t('profile.save')}
                variant="secondary"
                disabled={salonName.trim().length < 2 || salonName.trim() === business.name}
                loading={rename.isPending}
                onPress={() => rename.mutate(salonName, { onSuccess: () => toast(t('profile.salonSaved')) })}
                testID="profile-salon-save"
              />
            </Card>
          </>
        ) : null}

        <SectionHeader title={t('profile.signIn')} />
        <Card style={styles.card}>
          {staffLogin ? (
            <Text color="textSecondary">{t('profile.yourUsername', { username: member.username ?? '', code: business.code })}</Text>
          ) : (
            <>
              <Text color="textSecondary" selectable>
                {t('profile.yourEmail', { email: session?.user.email ?? '' })}
              </Text>
              <TextField
                label={t('profile.newEmail')}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                testID="profile-email"
              />
              <FormError error={changeEmail.error} />
              <Button
                label={t('profile.changeEmail')}
                variant="secondary"
                disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) || email.trim() === session?.user.email}
                loading={changeEmail.isPending}
                onPress={() =>
                  changeEmail.mutate(email, {
                    onSuccess: () => {
                      toast(t('profile.emailSent'));
                      setEmail('');
                    },
                  })
                }
                testID="profile-email-save"
              />
            </>
          )}
        </Card>

        <SectionHeader title={t('profile.password')} />
        <Card style={styles.card}>
          <TextField label={t('profile.currentPassword')} value={current} onChangeText={setCurrent} secureTextEntry testID="profile-password-current" />
          <TextField label={t('profile.newPassword')} value={next} onChangeText={setNext} secureTextEntry testID="profile-password-new" />
          <FormError error={changePassword.error} />
          <Button
            label={t('profile.changePassword')}
            variant="secondary"
            disabled={current.length === 0 || next.length < 8}
            loading={changePassword.isPending}
            onPress={() =>
              changePassword.mutate(
                { current, next },
                {
                  onSuccess: () => {
                    toast(t('profile.passwordChanged'));
                    setCurrent('');
                    setNext('');
                  },
                },
              )
            }
            testID="profile-password-save"
          />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
