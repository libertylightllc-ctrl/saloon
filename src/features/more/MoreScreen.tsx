import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useSession, useWorkspace } from '@/features/auth/session';
import { LanguageSheet } from '@/features/settings/LanguageSheet';
import { LANGUAGES } from '@/lib/i18n';
import { can } from '@/lib/permissions';
import { spacing } from '@/theme';
import { Avatar, Card, HeaderBand, MenuGroup, MenuRow, Screen, Text } from '@/ui';

export function MoreScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { signOut } = useSession();
  const { member, business, branch, role } = useWorkspace();
  const [language, setLanguage] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const business_rows = [
    { key: 'services', icon: 'scissors', href: '/services', show: can(role, 'viewServices') },
    { key: 'sales', icon: 'receipt', href: '/sales', show: can(role, 'viewSales') },
    { key: 'team', icon: 'users', href: '/settings/team', show: can(role, 'manageUsers') },
    { key: 'branch', icon: 'store', href: '/settings/branch', show: can(role, 'manageBranch') },
  ] as const;
  const shown = business_rows.filter((r) => r.show);

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
        </View>
      </Screen>
      <LanguageSheet open={language} onClose={() => setLanguage(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl },
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
});
