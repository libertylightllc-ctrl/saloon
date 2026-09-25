import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { LanguageLink } from '@/features/settings/LanguageSheet';
import { spacing, useThemeMode, type Mode } from '@/theme';
import { Chip, HeaderBand, Screen } from '@/ui';

import { useSalonType } from './salonType';

/** Small switch to change the salon type on sign-in screens (re-themes instantly). */
export function SalonTypeSwitch() {
  const { t } = useTranslation();
  const { mode } = useThemeMode();
  const { setSalonType } = useSalonType();
  const options: Mode[] = ['gents', 'ladies'];
  return (
    <View style={styles.switch} accessibilityRole="radiogroup">
      {options.map((option) => (
        <Chip
          key={option}
          label={t(`auth.salonType.${option}`)}
          icon={option === 'gents' ? 'scissors' : 'flower'}
          selected={mode === option}
          onPress={() => setSalonType(option)}
          testID={`salon-type-${option}`}
        />
      ))}
    </View>
  );
}

export function AuthShell({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: (() => void) | true;
  children: ReactNode;
}) {
  return (
    <Screen
      background="gradient"
      header={
        <HeaderBand title={title} subtitle={subtitle} onBack={onBack}>
          <SalonTypeSwitch />
        </HeaderBand>
      }
    >
      <View style={styles.body}>
        {children}
        <LanguageLink />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  switch: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  body: { gap: spacing.lg },
});
