import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { DeleteAccountSheet } from '@/features/account/DeleteAccountSheet';
import { PinSheet, SwitchUserSheet } from '@/features/auth/QuickSwitchSheets';
import { useHasPin } from '@/features/auth/quickSwitch';
import { useSession, useWorkspace } from '@/features/auth/session';
import { useBusinessRows } from '@/features/nav/navItems';
import { LanguageSheet } from '@/features/settings/LanguageSheet';
import { LANGUAGES } from '@/lib/i18n';
import { spacing } from '@/theme';
import { Avatar, Card, HeaderBand, MenuGroup, MenuRow, Screen, Text } from '@/ui';

export function MoreScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { signOut } = useSession();
  const { member, business, branch, role } = useWorkspace();
  const [language, setLanguage] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const hasPin = useHasPin(business.id);
  const [signingOut, setSigningOut] = useState(false);
  const shown = useBusinessRows();

  return (
    <>
      <Screen insetBottom={false} header={<HeaderBand title={t('more.title')} />}>
        <View style={styles.body}>
          <Card style={styles.profile}>
            <Avatar name={member.display_name} size={56} />
            <View style={styles.flex}>
              <Text variant="h4" testID="more-name">
                {member.display_name}
              </Text>
              <Text variant="small" color="textSecondary">
                {`${t(`roles.${role}`)} · ${branch.name}`}
              </Text>
              {role === 'owner' ? (
                <Text variant="small" color="primaryText" testID="more-salon-code">
                  {t('more.salonCode', { code: business.code })}
                </Text>
              ) : null}
            </View>
          </Card>
          {shown.length ? (
            <MenuGroup title={t('more.business')}>
              {shown.map((row, i) => (
                <MenuRow
                  key={row.key}
                  icon={row.icon}
                  index={i}
                  label={t(`more.rows.${row.key}`)}
                  last={i === shown.length - 1}
                  onPress={() => router.push(row.href)}
                  testID={`more-${row.key}`}
                />
              ))}
            </MenuGroup>
          ) : null}
          <MenuGroup title={t('more.app')}>
            <MenuRow
              icon="languages"
              index={0}
              label={t('language.title')}
              value={LANGUAGES.find((l) => l.code === i18n.language)?.nativeName}
              onPress={() => setLanguage(true)}
              testID="more-language"
            />
            <MenuRow icon="keyRound" index={1} label={t('more.rows.pin')} onPress={() => setPinOpen(true)} testID="more-pin" />
            {hasPin.data ? (
              <MenuRow icon="repeat" index={2} label={t('more.rows.switch')} onPress={() => setSwitchOpen(true)} testID="more-switch" />
            ) : null}
            <MenuRow
              icon="logOut"
              danger
              last
              label={t('more.signOut')}
              onPress={() => {
                if (signingOut) return;
                setSigningOut(true);
                void signOut().finally(() => setSigningOut(false));
              }}
              testID="sign-out"
            />
          </MenuGroup>
          <MenuGroup title={t('more.account')}>
            <MenuRow icon="shield" index={0} label={t('legal.privacy.title')} onPress={() => router.push('/privacy')} testID="more-privacy" />
            <MenuRow icon="fileText" index={1} last={role !== 'owner'} label={t('legal.terms.title')} onPress={() => router.push('/terms')} testID="more-terms" />
            {/* Only the owner deletes an account; staff logins are the owner's to remove (Staff → the person). */}
            {role === 'owner' ? (
              <MenuRow
                icon="trash"
                danger
                last
                label={t('account.delete.row')}
                onPress={() => setDeleteOpen(true)}
                testID="more-delete-account"
              />
            ) : null}
          </MenuGroup>
        </View>
      </Screen>
      <LanguageSheet open={language} onClose={() => setLanguage(false)} />
      <PinSheet open={pinOpen} onClose={() => setPinOpen(false)} />
      <SwitchUserSheet open={switchOpen} onClose={() => setSwitchOpen(false)} />
      {role === 'owner' ? <DeleteAccountSheet open={deleteOpen} onClose={() => setDeleteOpen(false)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
});
