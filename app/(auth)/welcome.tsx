import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brand } from '@/config/brand';
import { AppPreview, FeatureCard, Step, TypeCard } from '@/features/auth/LandingParts';
import { LandingPricing } from '@/features/auth/LandingPricing';
import { useSalonType } from '@/features/auth/salonType';
import { LanguageLink } from '@/features/settings/LanguageSheet';
import { screenPadding, spacing, useTheme, type Mode } from '@/theme';
import { BrandMark, Button, ContourPattern, Icon, Text, type IconName } from '@/ui';

const FEATURES: { key: string; icon: IconName }[] = [
  { key: 'queue', icon: 'users' },
  { key: 'sale', icon: 'receipt' },
  { key: 'closing', icon: 'banknote' },
  { key: 'staff', icon: 'clock' },
  { key: 'compliance', icon: 'shield' },
  { key: 'stock', icon: 'boxes' },
  { key: 'reports', icon: 'chart' },
  { key: 'roles', icon: 'userCheck' },
];
const FACTS: { key: string; icon: IconName }[] = [
  { key: 'languages', icon: 'languages' },
  { key: 'devices', icon: 'smartphone' },
  { key: 'private', icon: 'shield' },
];

/**
 * The first page a visitor sees: what the app does, for which salons, and the way in. Choosing a salon type
 * sets the look (and the words) of everything after it; "Create your salon" leads to the owner sign-up.
 */
export default function Welcome() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { salonType, setSalonType } = useSalonType();
  const scroll = useRef<ScrollView>(null);
  const [typesY, setTypesY] = useState(0);
  const [next, setNext] = useState<'/sign-in' | '/sign-up'>('/sign-in');
  const wide = width >= 900;
  const columns = width >= 1100 ? 4 : width >= 640 ? 2 : 1;

  const choose = (mode: Mode) => {
    setSalonType(mode);
    router.replace(next);
  };
  const toTypes = (to: '/sign-in' | '/sign-up') => {
    // Someone who already picked a type on this device goes straight on; everyone else picks one first.
    if (salonType) {
      router.replace(to);
      return;
    }
    setNext(to);
    scroll.current?.scrollTo({ y: typesY, animated: true });
  };

  return (
    <ScrollView ref={scroll} style={[styles.flex, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: insets.bottom + spacing['2xl'] }}>
      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: colors.primary500, paddingTop: insets.top + spacing.lg }]}>
        <ContourPattern color={colors.primary300} />
        <View style={[styles.inner, styles.topBar]}>
          <View style={styles.brand}>
            <BrandMark size={36} />
            <Text variant="h3" color="onPrimary">
              {brand.appName}
            </Text>
          </View>
          <Button label={t('auth.landing.signIn')} variant="inverse" size="sm" onPress={() => toTypes('/sign-in')} testID="landing-sign-in" />
        </View>
        <View style={[styles.inner, wide ? styles.heroRow : styles.heroColumn]}>
          <View style={[styles.heroText, wide && styles.flex]}>
            <Text variant="hero" color="onPrimary" style={styles.balance}>
              {t('auth.landing.headline')}
            </Text>
            <Text variant="h4" color="onPrimary" style={styles.lead}>
              {t('auth.landing.lead')}
            </Text>
            <View style={styles.ctas}>
              <Button label={t('auth.landing.create')} variant="inverse" size="md" icon="rocket" onPress={() => toTypes('/sign-up')} testID="landing-create" />
              <Text variant="small" color="onPrimary">
                {t('auth.landing.staffNote')}
              </Text>
            </View>
          </View>
          <View style={wide ? styles.previewWide : undefined}>
            <AppPreview />
          </View>
        </View>
      </View>

      {/* Facts */}
      <View style={[styles.inner, styles.facts]}>
        {FACTS.map((f) => (
          <View key={f.key} style={styles.fact}>
            <Icon name={f.icon} size={18} color={colors.primary500} />
            <Text variant="bodyStrong">{t(`auth.landing.facts.${f.key}` as 'auth.landing.facts.languages')}</Text>
          </View>
        ))}
      </View>

      {/* Features */}
      <View style={[styles.inner, styles.section]}>
        <Text variant="h1" align="center">
          {t('auth.landing.featuresTitle')}
        </Text>
        <Text align="center" color="textSecondary">
          {t('auth.landing.featuresLead')}
        </Text>
        <View style={styles.grid}>
          {FEATURES.map((f, i) => (
            <View key={f.key} style={{ width: columns === 1 ? '100%' : `${100 / columns - 2}%` }}>
              <FeatureCard
                icon={f.icon}
                index={i}
                title={t(`auth.landing.features.${f.key}.title` as 'auth.landing.features.queue.title')}
                body={t(`auth.landing.features.${f.key}.body` as 'auth.landing.features.queue.body')}
              />
            </View>
          ))}
        </View>
      </View>

      {/* Salon type */}
      <View style={[styles.inner, styles.section]} onLayout={(e) => setTypesY(e.nativeEvent.layout.y)}>
        <Text variant="h1" align="center">
          {t('auth.landing.typeTitle')}
        </Text>
        <Text align="center" color="textSecondary">
          {t('auth.welcome.subtitle')}
        </Text>
        <View style={[styles.types, wide && styles.typesRow]}>
          {(['gents', 'ladies'] as const).map((mode) => (
            <View key={mode} style={wide ? styles.flex : undefined}>
              <TypeCard mode={mode} onPress={() => choose(mode)} />
            </View>
          ))}
        </View>
      </View>

      {/* How it works */}
      <View style={[styles.inner, styles.section]}>
        <View style={[styles.steps, { backgroundColor: colors.surface, borderRadius: theme.radius.lg }]}>
          <Text variant="h2">{t('auth.landing.stepsTitle')}</Text>
          {[1, 2, 3].map((n) => (
            <Step key={n} n={n} text={t(`auth.landing.steps.${n}` as 'auth.landing.steps.1')} />
          ))}
        </View>
      </View>

      {/* Pricing */}
      <View style={[styles.inner, styles.section]}>
        <LandingPricing wide={wide} />
      </View>

      {/* Footer */}
      <View style={[styles.inner, styles.footer]}>
        <LanguageLink />
        {/* The contact line waits for a real support address (src/config/brand.json). */}
        {!brand.supportEmail.endsWith('@example.com') ? (
          <Text variant="small" color="textSecondary" align="center" selectable>
            {t('auth.landing.contact', { email: brand.supportEmail })}
          </Text>
        ) : null}
        <View style={styles.legal}>
          <Button variant="ghost" size="sm" label={t('legal.privacy.title')} onPress={() => router.push('/privacy')} testID="landing-privacy" />
          <Button variant="ghost" size="sm" label={t('legal.terms.title')} onPress={() => router.push('/terms')} testID="landing-terms" />
        </View>
        <Text variant="small" color="textSecondary" align="center">
          {`© ${new Date().getFullYear()} ${brand.appName}`}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inner: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: screenPadding },
  hero: { overflow: 'hidden', paddingBottom: spacing['2xl'] * 2, gap: spacing['2xl'] },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['2xl'] * 2 },
  heroColumn: { gap: spacing['2xl'] },
  heroText: { gap: spacing.lg },
  balance: { maxWidth: 620 },
  lead: { opacity: 0.92, maxWidth: 560 },
  ctas: { gap: spacing.sm, alignItems: 'flex-start' },
  previewWide: { width: 360 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xl, paddingVertical: spacing.xl },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  section: { gap: spacing.md, paddingTop: spacing['2xl'] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between', marginTop: spacing.md },
  types: { gap: spacing.lg, marginTop: spacing.md },
  typesRow: { flexDirection: 'row' },
  steps: { padding: spacing.xl, gap: spacing.lg },
  footer: { gap: spacing.sm, alignItems: 'center', paddingTop: spacing['2xl'] },
  legal: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
});
