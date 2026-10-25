import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { brand } from '@/config/brand';
import { site } from '@/config/site';
import { usePageMeta } from '@/lib/pageMeta';
import { useDates } from '@/lib/useDates';
import { spacing, useIsRTL } from '@/theme';
import { Button, HeaderBand, Screen, Text } from '@/ui';

/** The date the current wording took effect; change it with the wording. */
export const LEGAL_UPDATED = '2026-10-25';

const SECTIONS = {
  privacy: ['who', 'collect', 'use', 'basis', 'where', 'share', 'keep', 'rights', 'cookies', 'security', 'children', 'changes'],
  terms: ['service', 'accounts', 'plans', 'pilot', 'data', 'processing', 'fairUse', 'availability', 'liability', 'ending', 'law', 'changes'],
} as const;

export type LegalKind = keyof typeof SECTIONS;

/** Where privacy questions go: the privacy address if set, else support (src/config/brand.json). */
const contactEmail = brand.privacyEmail || brand.supportEmail;
/** Whether a real address has been set; until then no contact line is shown. */
export const hasSupportEmail = Boolean(contactEmail) && !contactEmail.endsWith('@example.com');
/** Who is responsible for the app, once the owner has set it (src/config/site.json; full update, Phase 5). */
const operator = site.operatorName;
const website = brand.website.replace(/^https?:\/\//, '');

/** The privacy policy or the terms: open to everyone, signed in or not (the stores and the website link here). */
export function LegalScreen({ kind }: { kind: LegalKind }) {
  const { t } = useTranslation();
  usePageMeta(t(`meta.${kind}.title`), t(`meta.${kind}.description`));
  const dates = useDates();
  const router = useRouter();
  const isRtl = useIsRTL();
  const other: LegalKind = kind === 'privacy' ? 'terms' : 'privacy';
  const app = brand.appName;
  // The app's own words for where the plan is, so the terms name it as the owner sees it.
  const home = t('tabs.home');
  const planPath = `${t('tabs.more')} ${isRtl ? '←' : '→'} ${t('more.rows.plan')}`;

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
            {kind === 'privacy' && key === 'who' ? (
              <Text color="textSecondary" testID="legal-who">
                {operator
                  ? t('legal.privacy.who.leadOperator', { operator, app, website, email: contactEmail })
                  : t('legal.privacy.who.lead', { app, website, email: contactEmail })}
              </Text>
            ) : null}
            {t(`legal.${kind}.${key}.body` as 'legal.privacy.who.body', { app, home, planPath })
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
