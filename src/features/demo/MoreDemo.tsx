import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { LANGUAGES, isLanguage } from '@/lib/i18n';
import { changeLanguage } from '@/lib/language';
import { spacing } from '@/theme';
import {
  Avatar,
  BottomSheet,
  HeaderBand,
  MenuRow,
  Screen,
  Text,
  useOnBand,
  useToast,
  type IconName,
} from '@/ui';

import { useDemoBranch } from './useDemo';

type Row = { key: string; icon: IconName };

const GROUPS: { key: 'catalogue' | 'people' | 'money' | 'system'; rows: Row[] }[] = [
  {
    key: 'catalogue',
    rows: [
      { key: 'services', icon: 'scissors' },
      { key: 'inventory', icon: 'package' },
      { key: 'purchases', icon: 'truck' },
      { key: 'expenses', icon: 'wallet' },
    ],
  },
  {
    key: 'people',
    rows: [
      { key: 'staff', icon: 'users' },
      { key: 'attendance', icon: 'clock' },
      { key: 'compliance', icon: 'shield' },
    ],
  },
  {
    key: 'money',
    rows: [
      { key: 'cashClosing', icon: 'calculator' },
      { key: 'accounting', icon: 'coins' },
      { key: 'reports', icon: 'chart' },
    ],
  },
  {
    key: 'system',
    rows: [
      { key: 'setup', icon: 'rocket' },
      { key: 'settings', icon: 'settings' },
      { key: 'notifications', icon: 'bell' },
    ],
  },
];

/** Avatar, name and role — white on the gents band, dark on the ladies header. */
function Profile({ name, detail }: { name: string; detail: string }) {
  const onBand = useOnBand();
  return (
    <View style={styles.profile}>
      <Avatar name={name} size={80} ring={onBand} />
      <Text variant="h3" align="center" color={onBand ? 'onPrimary' : 'text'}>
        {name}
      </Text>
      <Text variant="small" align="center" color={onBand ? 'onPrimary' : 'textOnTint'}>
        {detail}
      </Text>
    </View>
  );
}

export function MoreDemo() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const demo = useDemoBranch();
  const [languageOpen, setLanguageOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];
  const later = () => toast(t('dev.laterPhase'), 'info');

  return (
    <Screen
      insetBottom={false}
      header={
        <HeaderBand title={t('tabs.more')}>
          <Profile name={demo.owner} detail={t('more.roleAtBranch', { branch: demo.branch })} />
        </HeaderBand>
      }
    >
      <View style={styles.groups}>
        {GROUPS.map((group, g) => (
          <View key={group.key}>
            <Text variant="small" color="textSecondary">
              {t(`more.groups.${group.key}`)}
            </Text>
            {group.rows.map((row, i) => (
              <MenuRow
                key={row.key}
                icon={row.icon}
                index={g * 4 + i}
                label={t(`more.rows.${row.key}` as 'more.rows.services')}
                onPress={later}
                last={i === group.rows.length - 1}
              />
            ))}
          </View>
        ))}
        <View>
          <Text variant="small" color="textSecondary">
            {t('more.groups.device')}
          </Text>
          <MenuRow
            icon="languages"
            index={1}
            label={t('language.title')}
            value={current.nativeName}
            onPress={() => setLanguageOpen(true)}
          />
          <MenuRow
            icon="palette"
            index={2}
            label={t('dev.gallery')}
            onPress={() => router.push('/dev/gallery')}
          />
          <MenuRow icon="logOut" label={t('more.logOut')} danger last onPress={later} />
        </View>
      </View>
      <BottomSheet
        open={languageOpen}
        onClose={() => setLanguageOpen(false)}
        title={t('language.title')}
      >
        {LANGUAGES.map((option, i) => (
          <MenuRow
            key={option.code}
            icon={option.code === i18n.language ? 'check' : 'languages'}
            index={i}
            label={option.nativeName}
            last={i === LANGUAGES.length - 1}
            onPress={() => {
              setLanguageOpen(false);
              if (isLanguage(option.code)) void changeLanguage(option.code);
            }}
          />
        ))}
        <Text variant="small" color="textSecondary">
          {t('language.restartNote')}
        </Text>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { alignItems: 'center', gap: spacing.xs, paddingBottom: spacing.sm },
  groups: { gap: spacing['2xl'] },
});
