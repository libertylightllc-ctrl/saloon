/** The end of the website's home page: how to get going, the last call (the glowing star), and the footer. */
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brand } from '@/config/brand';
import { site } from '@/config/site';
import { LanguageLink } from '@/features/settings/LanguageSheet';
import { brandPalette as B, spacing } from '@/theme';
import { Button, Text } from '@/ui';

import star from '../../../assets/images/splash-icon.png';
import { hasWhatsApp, madeInPlace, mailtoUrl, whatsappUrl } from './contact';
import { ContactButton } from './ContactButton';
import { Band, BrandButton, NavyBackdrop, useLandingLayout } from './parts';

export function HowItWorks() {
  const { t } = useTranslation();
  const { wide, compact } = useLandingLayout();
  return (
    <Band ground={B.card} style={[styles.steps, compact && styles.stepsCompact]}>
      <Text variant={compact ? 'sectionCompact' : 'section'} align="center" style={styles.ink} accessibilityRole="header">
        {t('auth.landing.stepsTitle')}
      </Text>
      {/* On a phone a short numbered list, not a screen of big numbers (brief 2.14). */}
      <View style={[compact ? styles.stepList : styles.stepRow, wide && styles.row]}>
        {([1, 2, 3] as const).map((n) =>
          compact ? (
            <View key={n} style={styles.stepLine}>
              <View style={styles.stepNumber}>
                <Text variant="bodyStrong" style={styles.number}>
                  {n}
                </Text>
              </View>
              <Text style={[styles.ink, styles.flex]}>{t(`auth.landing.steps.${n}`)}</Text>
            </View>
          ) : (
            <View key={n} style={[styles.step, wide && styles.flex]}>
              <Text variant="hero" style={styles.number}>
                {`0${n}`}
              </Text>
              <Text variant="lead" style={styles.ink}>
                {t(`auth.landing.steps.${n}`)}
              </Text>
            </View>
          ),
        )}
      </View>
    </Band>
  );
}

export function FinalCall({ label, onPress, onLayoutRange }: { label: string; onPress: () => void; onLayoutRange?: (top: number, bottom: number) => void }) {
  const { t } = useTranslation();
  const { compact } = useLandingLayout();
  return (
    <View style={styles.navy} onLayout={(e) => onLayoutRange?.(e.nativeEvent.layout.y, e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
      <NavyBackdrop glowAt={['50%', '30%']} />
      <Band ground="transparent" style={[styles.final, compact && styles.finalCompact]}>
        <Image source={star} style={[styles.star, compact && styles.starCompact]} aria-hidden />
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
  const social = Object.entries(site.social).filter(([, url]) => url) as [keyof typeof site.social, string][];
  return (
    <Band ground={B.mist} style={[styles.footer, { paddingBottom: insets.bottom + spacing['3xl'] }]}>
      <LanguageLink />
      {!brand.supportEmail.endsWith('@example.com') ? (
        <Text variant="small" color="textSecondary" align="center" selectable testID="landing-email" {...({ href: mailtoUrl } as object)}>
          {t('auth.landing.contact', { email: brand.supportEmail })}
        </Text>
      ) : null}
      {/* Real links (website brief 1.7, 2.15, 4.6): crawlers and "open in new tab" work. */}
      <View style={styles.legal}>
        {hasWhatsApp ? (
          <Button variant="ghost" size="sm" icon="messageCircle" label={t('auth.landing.whatsapp')} href={whatsappUrl()} external testID="landing-footer-whatsapp" />
        ) : null}
        <ContactButton label={t('support.contactTitle')} testID="landing-contact" />
        <Link href="/privacy" asChild>
          <Button variant="ghost" size="sm" label={t('legal.privacy.title')} testID="landing-privacy" />
        </Link>
        <Link href="/terms" asChild>
          <Button variant="ghost" size="sm" label={t('legal.terms.title')} testID="landing-terms" />
        </Link>
      </View>
      {social.length ? (
        <View style={styles.legal}>
          {social.map(([name, url]) => (
            <Button key={name} variant="ghost" size="sm" label={SOCIAL[name]} href={url} external testID={`landing-social-${name}`} />
          ))}
        </View>
      ) : null}
      <Text variant="small" color="textSecondary" align="center" testID="landing-made-in">
        {`© ${new Date().getFullYear()} ${brand.appName}`}
        {site.madeIn ? ` · ${t('auth.landing.footer.madeIn', { place: madeInPlace(t) })}` : null}
      </Text>
    </Band>
  );
}

/** Platform names stay as they are written. */
const SOCIAL: Record<keyof typeof site.social, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row' },
  ink: { color: B.ink },
  white: { color: B.onNavy },
  muted: { color: B.onNavyMuted, maxWidth: 560, alignSelf: 'center' },
  number: { color: B.tealDeep },
  steps: { paddingVertical: 88, gap: spacing['3xl'] },
  stepsCompact: { paddingVertical: 40, gap: spacing.lg },
  stepList: { gap: spacing.md },
  stepLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: B.tealSoft, alignItems: 'center', justifyContent: 'center' },
  stepRow: { gap: spacing['3xl'] },
  step: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: B.hairline, paddingTop: spacing.lg },
  navy: { backgroundColor: B.navy, overflow: 'hidden' },
  final: { paddingVertical: 96, gap: spacing.lg, alignItems: 'center' },
  finalCompact: { paddingVertical: 48 },
  star: { width: 150, height: 150 },
  starCompact: { width: 96, height: 96 },
  center: { alignItems: 'center', marginTop: spacing.sm },
  footer: { paddingTop: spacing['3xl'], gap: spacing.sm, alignItems: 'center' },
  legal: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
});
