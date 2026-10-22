/** The end of the website's home page: how to get going, the last call (the glowing star), and the footer. */
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brand } from '@/config/brand';
import { LanguageLink } from '@/features/settings/LanguageSheet';
import { brandPalette as B, spacing } from '@/theme';
import { Button, Text } from '@/ui';

import star from '../../../assets/images/splash-icon.png';
import { mailtoUrl } from './contact';
import { ContactButton } from './ContactButton';
import { Band, BrandButton, NavyBackdrop, useLandingLayout } from './parts';

export function HowItWorks() {
  const { t } = useTranslation();
  const { wide, compact } = useLandingLayout();
  return (
    <Band ground={B.card} style={styles.steps}>
      <Text variant={compact ? 'sectionCompact' : 'section'} align="center" style={styles.ink} accessibilityRole="header">
        {t('auth.landing.stepsTitle')}
      </Text>
      <View style={[styles.stepRow, wide && styles.row]}>
        {([1, 2, 3] as const).map((n) => (
          <View key={n} style={[styles.step, wide && styles.flex]}>
            <Text variant="hero" style={styles.number}>
              {`0${n}`}
            </Text>
            <Text variant="lead" style={styles.ink}>
              {t(`auth.landing.steps.${n}`)}
            </Text>
          </View>
        ))}
      </View>
    </Band>
  );
}

export function FinalCall({ label, onPress }: { label: string; onPress: () => void }) {
  const { t } = useTranslation();
  const { compact } = useLandingLayout();
  return (
    <View style={styles.navy}>
      <NavyBackdrop glowAt={['50%', '30%']} />
      <Band ground="transparent" style={styles.final}>
        <Image source={star} style={styles.star} aria-hidden />
        <Text variant={compact ? 'sectionCompact' : 'section'} align="center" style={styles.white} accessibilityRole="header">
          {t('auth.landing.finalTitle')}
        </Text>
        <Text variant="lead" align="center" style={styles.muted}>
          {t('auth.landing.finalLead')}
        </Text>
        <View style={styles.center}>
          <BrandButton label={label} icon="chevronRight" onPress={onPress} testID="landing-start-final" />
        </View>
      </Band>
    </View>
  );
}

export function Footer() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Band ground={B.mist} style={[styles.footer, { paddingBottom: insets.bottom + spacing['3xl'] }]}>
      <LanguageLink />
      {/* The contact line waits for a real support address (src/config/brand.json). */}
      {!brand.supportEmail.endsWith('@example.com') ? (
        <Text variant="small" color="textSecondary" align="center" selectable testID="landing-email" {...({ href: mailtoUrl } as object)}>
          {t('auth.landing.contact', { email: brand.supportEmail })}
        </Text>
      ) : null}
      {/* Real links (website brief 1.7, 4.6): crawlers and "open in new tab" work. */}
      <View style={styles.legal}>
        <ContactButton label={t('support.contactTitle')} testID="landing-contact" />
        <Link href="/privacy" asChild>
          <Button variant="ghost" size="sm" label={t('legal.privacy.title')} testID="landing-privacy" />
        </Link>
        <Link href="/terms" asChild>
          <Button variant="ghost" size="sm" label={t('legal.terms.title')} testID="landing-terms" />
        </Link>
      </View>
      <Text variant="small" color="textSecondary" align="center">
        {`© ${new Date().getFullYear()} ${brand.appName}`}
      </Text>
    </Band>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row' },
  ink: { color: B.ink },
  white: { color: B.onNavy },
  muted: { color: B.onNavyMuted, maxWidth: 560, alignSelf: 'center' },
  number: { color: B.tealDeep },
  steps: { paddingVertical: 88, gap: spacing['3xl'] },
  stepRow: { gap: spacing['3xl'] },
  step: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: B.hairline, paddingTop: spacing.lg },
  navy: { backgroundColor: B.navy, overflow: 'hidden' },
  final: { paddingVertical: 96, gap: spacing.lg, alignItems: 'center' },
  star: { width: 150, height: 150 },
  center: { alignItems: 'center', marginTop: spacing.sm },
  footer: { paddingTop: spacing['3xl'], gap: spacing.sm, alignItems: 'center' },
  legal: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
});
