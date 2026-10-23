import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { brand } from '@/config/brand';
import { site } from '@/config/site';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { Button, HeaderBand, Screen, Text } from '@/ui';

/** The date the current wording took effect; change it with the wording. */
export const LEGAL_UPDATED = '2026-10-22';

const SECTIONS = {
  privacy: ['who', 'collect', 'use', 'basis', 'where', 'share', 'keep', 'rights', 'cookies', 'security', 'children', 'changes'],
  terms: ['service', 'accounts', 'plans', 'data', 'processing', 'fairUse', 'availability', 'liability', 'ending', 'law', 'changes'],
} as const;

export type LegalKind = keyof typeof SECTIONS;

/** Where privacy questions go: the privacy address if set, else support (src/config/brand.json). */
const contactEmail = brand.privacyEmail || brand.supportEmail;
/** Whether a real address has been set; until then no contact line is shown. */
export const hasSupportEmail = Boolean(contactEmail) && !contactEmail.endsWith('@example.com');
/** The company behind the app and its address, once the owner has set them (src/config/site.json; website brief 5.2). */
const legalName = site.legalName || brand.legalName;
const legalAddress = site.legalAddress;
/** For "Who we are": the legal name once set, else the app's name. */
const company = legalName || brand.appName;

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
        {/* "Saloqo is provided by <legal name>, <address>" (brief 5.2): only once the name is set. */}
        {legalName ? (
          <Text weight="semibold" testID="legal-provider">
            {legalAddress ? t('legal.provider.withAddress', { app, name: legalName, address: legalAddress }) : t('legal.provider.name', { app, name: legalName })}
          </Text>
        ) : null}
        <Text>{t(`legal.${kind}.intro`, { app })}</Text>
        {SECTIONS[kind].map((key) => (
          <View key={key} style={styles.section}>
            <Text variant="h4" accessibilityRole="header">
              {t(`legal.${kind}.${key}.title` as 'legal.privacy.who.title')}
            </Text>
            {t(`legal.${kind}.${key}.body` as 'legal.privacy.who.body', { app, company })
              .split('\n')
              .map((line, i) => (
                <Text key={i} color="textSecondary">
                  {line}
                </Text>
              ))}
            {kind === 'privacy' && key === 'who' && brand.address ? (
              <Text color="textSecondary">{t('legal.privacy.who.address', { address: brand.address })}</Text>
            ) : null}
          </View>
        ))}
        {/* Representatives for people in the EU and the UK (GDPR article 27), once appointed. */}
        {kind === 'privacy' && (brand.euRepresentative || brand.ukRepresentative) ? (
          <View style={styles.section}>
            <Text variant="h4" accessibilityRole="header">
              {t('legal.privacy.reps.title')}
            </Text>
            {brand.euRepresentative ? <Text color="textSecondary">{t('legal.privacy.reps.eu', { rep: brand.euRepresentative })}</Text> : null}
            {brand.ukRepresentative ? <Text color="textSecondary">{t('legal.privacy.reps.uk', { rep: brand.ukRepresentative })}</Text> : null}
          </View>
        ) : null}
        {hasSupportEmail ? (
          <View style={styles.section}>
            <Text variant="h4" accessibilityRole="header">
              {t('legal.contact.title')}
            </Text>
            <Text color="textSecondary" selectable>
              {t('legal.contact.body', { email: contactEmail })}
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
