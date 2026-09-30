import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { brand } from '@/config/brand';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { Button, HeaderBand, Screen, Text } from '@/ui';

/** The date the current wording took effect; change it with the wording. */
export const LEGAL_UPDATED = '2026-09-30';

const SECTIONS = {
  privacy: ['who', 'collect', 'use', 'where', 'share', 'keep', 'rights', 'security', 'children', 'changes'],
  terms: ['service', 'accounts', 'plans', 'data', 'fairUse', 'availability', 'liability', 'ending', 'law', 'changes'],
} as const;

export type LegalKind = keyof typeof SECTIONS;

/** Whether a real support address has been set (src/config/brand.json); until then no contact line is shown. */
export const hasSupportEmail = !brand.supportEmail.endsWith('@example.com');

/** The privacy policy or the terms: open to everyone, signed in or not (the stores and the website link here). */
export function LegalScreen({ kind }: { kind: LegalKind }) {
  const { t } = useTranslation();
  const dates = useDates();
  const router = useRouter();
  const other: LegalKind = kind === 'privacy' ? 'terms' : 'privacy';
  const app = brand.appName;

  return (
    <Screen header={<HeaderBand title={t(`legal.${kind}.title`)} onBack />}>
      <View style={styles.body} testID={`legal-${kind}`}>
        <Text variant="small" color="textSecondary">
          {t('legal.updated', { date: dates.day(LEGAL_UPDATED, 'd MMMM yyyy') })}
        </Text>
        <Text>{t(`legal.${kind}.intro`, { app })}</Text>
        {SECTIONS[kind].map((key) => (
          <View key={key} style={styles.section}>
            <Text variant="h4" accessibilityRole="header">
              {t(`legal.${kind}.${key}.title` as 'legal.privacy.who.title')}
            </Text>
            {t(`legal.${kind}.${key}.body` as 'legal.privacy.who.body', { app })
              .split('\n')
              .map((line, i) => (
                <Text key={i} color="textSecondary">
                  {line}
                </Text>
              ))}
          </View>
        ))}
        {hasSupportEmail ? (
          <View style={styles.section}>
            <Text variant="h4" accessibilityRole="header">
              {t('legal.contact.title')}
            </Text>
            <Text color="textSecondary" selectable>
              {t('legal.contact.body', { email: brand.supportEmail })}
            </Text>
          </View>
        ) : null}
        <Button
          variant="secondary"
          label={t(`legal.${other}.title`)}
          onPress={() => router.replace(`/${other}`)}
          testID={`legal-open-${other}`}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl, width: '100%', maxWidth: 760, alignSelf: 'center' },
  section: { gap: spacing.sm },
});
