import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { brand } from '@/config/brand';
import { LanguageLink } from '@/features/settings/LanguageSheet';
import { spacing, tapTarget, useTheme, useThemeMode, type Mode } from '@/theme';
import { BackButton, BrandMark, Chip, HeaderBand, Screen, Text, useWide } from '@/ui';

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

/** The logo and the app's name above the page title (owner, 2026-10-07: "use the logo on the sign in page too"). */
function AuthTop({ title, onBack }: { title: string; onBack?: (() => void) | true }) {
  const theme = useTheme();
  const wide = useWide();
  const back = onBack ? <BackButton onPress={onBack === true ? undefined : onBack} /> : null;
  if (wide) {
    return (
      <View style={styles.wideTop}>
        {back}
        <BrandMark size={48} />
        <Text variant="display" accessibilityRole="header">
          {title}
        </Text>
      </View>
    );
  }
  const onBand = theme.variants.header === 'band';
  return (
    <View style={styles.top}>
      <View style={styles.topRow}>
        <View style={styles.side}>{back}</View>
        <View style={styles.lockup}>
          <BrandMark size={44} />
          <Text variant="h2" color={onBand ? 'onPrimary' : 'text'}>
            {brand.appName}
          </Text>
        </View>
        <View style={styles.side} />
      </View>
      <Text
        variant="h3"
        align="center"
        color={onBand ? 'onPrimary' : 'text'}
        accessibilityRole="header"
      >
        {title}
      </Text>
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
        <HeaderBand
          title={title}
          subtitle={subtitle}
          top={<AuthTop title={title} onBack={onBack} />}
        >
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
  top: { gap: spacing.md, paddingTop: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  side: { width: tapTarget },
  lockup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  wideTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 },
});
