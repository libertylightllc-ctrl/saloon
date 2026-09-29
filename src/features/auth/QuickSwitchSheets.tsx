import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { spacing } from '@/theme';
import { Avatar, BottomSheet, Button, FormError, ListRow, SectionHeader, Text, TextField, useToast } from '@/ui';

import { signInOwner, signInStaff } from './api';
import { remember, sessionEntry, switchTo, useRemembered, useSetPin, type Remembered } from './quickSwitch';
import { useSession, useWorkspace } from './session';

const digits = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 4);

/** My current session as a remembered entry (to switch back to me later). */
async function currentEntry(member: Parameters<typeof sessionEntry>[1]): Promise<Remembered | null> {
  const { data } = await supabase.auth.getSession();
  return data.session ? sessionEntry(data.session, member) : null;
}

/** Set (or change) my 4-digit PIN for switching on a shared device. */
export function PinSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={open} onClose={onClose} title={t('quickSwitch.pinTitle')}>
      {/* Mounted per opening, so every opening starts empty. */}
      {open ? <PinForm onDone={onClose} /> : null}
    </BottomSheet>
  );
}

function PinForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, member } = useWorkspace();
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const save = useSetPin(business.id, async () => {
    const me = await currentEntry(member);
    if (me) await remember(me);
  });

  const submit = () => {
    if (pin !== again) {
      setMismatch(true);
      return;
    }
    save.mutate(pin, {
      onSuccess: () => {
        toast(t('quickSwitch.pinSaved'));
        onDone();
      },
    });
  };

  return (
    <View style={styles.sheet}>
      <Text color="textSecondary">{t('quickSwitch.pinHint')}</Text>
      <TextField label={t('quickSwitch.pin')} value={pin} onChangeText={(v) => setPin(digits(v))} keyboardType="number-pad" secureTextEntry maxLength={4} testID="pin-new" />
      <TextField
        label={t('quickSwitch.pinAgain')}
        value={again}
        onChangeText={(v) => {
          setAgain(digits(v));
          setMismatch(false);
        }}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        error={mismatch ? t('quickSwitch.pinMismatch') : undefined}
        testID="pin-again"
      />
      <FormError error={save.error} />
      <Button label={t('quickSwitch.savePin')} disabled={pin.length !== 4 || again.length !== 4} loading={save.isPending} onPress={submit} testID="pin-save" />
    </View>
  );
}

/** Switch to someone remembered on this device (their PIN), or sign someone else in without losing my session. */
export function SwitchUserSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={open} onClose={onClose} title={t('quickSwitch.switchTitle')} snapPoints={['85%']}>
      {open ? <SwitchForm onDone={onClose} /> : null}
    </BottomSheet>
  );
}

function SwitchForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { business, member } = useWorkspace();
  const { reload } = useSession();
  const people = useRemembered(business.id, member.id);
  const [target, setTarget] = useState<Remembered | null>(null);
  const [pin, setPin] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  const go = useMutation({
    mutationFn: async () => switchTo(target!, pin, await currentEntry(member)),
    onSuccess: onDone,
    onError: () => setPin(''),
  });
  const add = useMutation({
    mutationFn: async () => {
      const me = await currentEntry(member);
      if (me) await remember(me);
      queryClient.clear();
      if (login.includes('@')) await signInOwner(login, password);
      else await signInStaff(business.code, login, password);
    },
    onSuccess: onDone,
    // A failed sign-in leaves me signed in; my data was dropped from the cache, so read it again.
    onError: () => void reload(),
  });

  if (target) {
    return (
      <View style={styles.sheet}>
        <ListRow title={target.name} meta={[t(`roles.${target.role}` as 'roles.owner')]} leading={<Avatar name={target.name} size={40} />} />
        <TextField
          label={t('quickSwitch.enterPin', { name: target.name })}
          value={pin}
          onChangeText={(v) => setPin(digits(v))}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          autoFocus
          onSubmitEditing={() => pin.length === 4 && go.mutate()}
          testID="switch-pin"
        />
        <FormError error={go.error} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button label={t('common.back')} variant="outline" onPress={() => setTarget(null)} testID="switch-back" />
          </View>
          <View style={styles.flex}>
            <Button label={t('quickSwitch.switch')} disabled={pin.length !== 4} loading={go.isPending} onPress={() => go.mutate()} testID="switch-go" />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.sheet}>
      {(people.data ?? []).length ? (
        <View style={styles.list}>
          {(people.data ?? []).map((p) => (
            <ListRow
              key={p.member_id}
              title={p.name}
              meta={[t(`roles.${p.role}` as 'roles.owner')]}
              leading={<Avatar name={p.name} size={40} />}
              chevron
              onPress={() => {
                go.reset();
                setPin('');
                setTarget(p);
              }}
              testID={`switch-to-${p.name}`}
            />
          ))}
        </View>
      ) : (
        <Text color="textSecondary">{t('quickSwitch.nobody')}</Text>
      )}
      <SectionHeader title={t('quickSwitch.addTitle')} />
      <Text variant="small" color="textSecondary">
        {t('quickSwitch.addHint')}
      </Text>
      <TextField label={t('quickSwitch.login')} value={login} onChangeText={setLogin} autoCapitalize="none" autoCorrect={false} testID="switch-login" />
      <TextField label={t('auth.fields.password')} value={password} onChangeText={setPassword} secureTextEntry testID="switch-password" />
      <FormError error={add.error} />
      <Button label={t('quickSwitch.signIn')} variant="secondary" disabled={!login.trim() || !password} loading={add.isPending} onPress={() => add.mutate()} testID="switch-add" />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: spacing.lg },
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
