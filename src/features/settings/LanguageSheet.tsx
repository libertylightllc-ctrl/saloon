import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { isLanguage, LANGUAGES } from '@/lib/i18n';
import { changeLanguage } from '@/lib/language';
import { spacing, useTheme } from '@/theme';
import { BottomSheet, Icon, MenuRow, Text } from '@/ui';

export function LanguageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  return (
    <BottomSheet open={open} onClose={onClose} title={t('language.title')}>
      {LANGUAGES.map((option, i) => (
        <MenuRow
          key={option.code}
          icon={option.code === i18n.language ? 'check' : 'languages'}
          index={i}
          label={option.nativeName}
          last={i === LANGUAGES.length - 1}
          onPress={() => {
            onClose();
            if (isLanguage(option.code)) void changeLanguage(option.code);
          }}
        />
      ))}
      <Text variant="small" color="textSecondary">
        {t('language.restartNote')}
      </Text>
    </BottomSheet>
  );
}

/** "🌐 English" link that opens the language sheet (sign-in screens). */
export function LanguageLink() {
  const { i18n, t } = useTranslation();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${t('language.title')}: ${current.nativeName}`}
        hitSlop={12}
        style={styles.link}
      >
        <Icon name="languages" size={16} color={theme.colors.textSecondary} />
        <Text variant="small" color="textSecondary">
          {current.nativeName}
        </Text>
      </Pressable>
      <LanguageSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'center', padding: spacing.sm },
});
