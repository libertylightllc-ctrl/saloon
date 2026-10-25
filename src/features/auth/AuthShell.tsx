/**
 * The frame of the sign-in, sign-up and password pages, in the website home page's look (owner, 2026-10-17: "sign in
 * page as well"): Saloqo's navy with the glowing star around a white card. The card keeps the picked salon look, so
 * the form's buttons and fields are already the colours of the app that follows. On a computer the navy is a panel
 * beside the form, with the real app in that look.
 */
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brand } from '@/config/brand';
import { site } from '@/config/site';
import { ContactButton } from '@/features/landing/ContactButton';
import { Band, NavyBackdrop, PhoneShot, Tick, useLandingLayout } from '@/features/landing/parts';
import { LanguageButton } from '@/features/settings/LanguageSheet';
import { MODE_ICON, MODE_SHOT } from '@/features/mode/modeLook';
import { brandPalette as B, MODES, spacing, useThemeMode } from '@/theme';
import { BackButton, BrandMark, Chip, OnBandContext, Text } from '@/ui';

import { useSalonType } from './salonType';

const POINTS = ['live', 'closing', 'pay'] as const;

/** Small switch to change the salon type on sign-in screens (re-themes instantly). */
export function SalonTypeSwitch() {
  const { t } = useTranslation();
  const { mode } = useThemeMode();
  const { setSalonType } = useSalonType();
  return (
    <View style={styles.switch} accessibilityRole="radiogroup">
      {MODES.map((option) => (
        <Chip
          key={option}
          label={t(`auth.salonType.${option}`)}
          icon={MODE_ICON[option]}
          selected={mode === option}
          onPress={() => setSalonType(option)}
          testID={`salon-type-${option}`}
        />
      ))}
    </View>
  );
}

/** The logo, the app's name, a back arrow when the page has one, and the language button — white on navy. */
function TopBar({ onBack }: { onBack?: (() => void) | true }) {
  return (
    <View style={styles.topBar}>
      {onBack ? (
        <OnBandContext.Provider value>
          <BackButton onPress={onBack === true ? undefined : onBack} />
        </OnBandContext.Provider>
      ) : null}
      <View style={styles.lockup}>
        <BrandMark size={36} />
        <Text variant="h3" style={styles.white}>
          {brand.appName}
        </Text>
      </View>
      <LanguageButton onBand />
    </View>
  );
}

/** Computer: what Saloqo is, beside the form, with the real app in the picked look. */
function BrandPanel({ onBack, panel }: { onBack?: (() => void) | true; panel: 'signIn' | 'signUp' }) {
  const { t } = useTranslation();
  const { mode } = useThemeMode();
  const insets = useSafeAreaInsets();
  const quote = site.testimonials[0];
  return (
    <View style={[styles.panel, { paddingTop: insets.top + spacing['2xl'] }]}>
      <NavyBackdrop glowAt={['60%', '70%']} />
      <TopBar onBack={onBack} />
      {panel === 'signUp' ? (
        // Sign-up: the free trial, the data line and one real customer's words when there are some (brief 3.6).
        <View style={styles.panelBody} testID="auth-panel-sign-up">
          <Text variant="section" style={styles.white}>
            {t('auth.signUp.title')}
          </Text>
          <View style={styles.points}>
            {[t('auth.landing.noCard'), t('auth.landing.trust.noRenew'), t('auth.landing.trust.dataYours')].map((line) => (
              <View key={line} style={styles.point}>
                <Tick size={24} />
                <Text variant="h4" style={styles.white}>
                  {line}
                </Text>
              </View>
            ))}
          </View>
          {quote ? (
            <View style={styles.quote}>
              <Text variant="lead" style={styles.white}>{`“${quote.quote}”`}</Text>
              <Text variant="small" style={styles.whiteMuted}>
                {[quote.name, quote.salon, quote.city].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.panelBody}>
          <Text variant="section" style={styles.white}>
            {t('auth.landing.headline')}
          </Text>
          <View style={styles.points}>
            {POINTS.map((k) => (
              <View key={k} style={styles.point}>
                <Tick size={24} />
                <Text variant="h4" style={styles.white}>
                  {t(`auth.landing.owners.items.${k}`)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
      <View style={styles.panelShot}>
        <PhoneShot source={MODE_SHOT[mode]} width={250} tilt={-4} />
      </View>
    </View>
  );
}

export function AuthShell({
  title,
  subtitle,
  onBack,
  typeSwitch = false,
  offer,
  panel = 'signIn',
  children,
}: {
  title: string;
  subtitle?: string;
  /** Sign-up: "7 days free · No card needed · Nothing renews by itself" under the title (brief 3.1). */
  offer?: string;
  /** What the computer's side panel says: the app (sign-in) or the free trial (sign-up). */
  panel?: 'signIn' | 'signUp';
  onBack?: (() => void) | true;
  /** Gents / Ladies above the form: sign-up only (a returning owner's salon already has its type; brief 1.6). */
  typeSwitch?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { wide } = useLandingLayout();

  const card = (
    <View style={[styles.card, !wide && styles.cardLifted]}>
      {wide ? (
        <View style={styles.cardHead}>
          <Text variant="sectionCompact" style={styles.ink} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={styles.inkMuted}>{subtitle}</Text> : null}
          {offer ? (
            <Text variant="bodyStrong" style={styles.tealDeep} testID="auth-offer">
              {offer}
            </Text>
          ) : null}
        </View>
      ) : null}
      {typeSwitch ? <SalonTypeSwitch /> : null}
      <View style={styles.body}>
        {children}
        {/* Someone whose app is not working often cannot sign in: they can still write to us. */}
        <ContactButton label={t('support.contactLink')} testID="auth-contact" />
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={wide ? styles.row : styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {wide ? <BrandPanel onBack={onBack} panel={panel} /> : null}
        <ScrollView style={styles.flex} contentContainerStyle={styles.grow} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {wide ? (
            <View style={[styles.side, { paddingTop: insets.top + spacing['4xl'], paddingBottom: insets.bottom + spacing['4xl'] }]}>{card}</View>
          ) : (
            <>
              <View style={styles.navy}>
                <NavyBackdrop glowAt={['50%', '20%']} />
                <Band ground="transparent" style={[styles.band, { paddingTop: insets.top + spacing.lg }]}>
                  <TopBar onBack={onBack} />
                  <View style={styles.bandText}>
                    <Text variant="sectionCompact" align="center" style={styles.white} accessibilityRole="header">
                      {title}
                    </Text>
                    {subtitle ? (
                      <Text align="center" style={styles.whiteMuted}>
                        {subtitle}
                      </Text>
                    ) : null}
                    {offer ? (
                      <Text variant="bodyStrong" align="center" style={styles.teal} testID="auth-offer">
                        {offer}
                      </Text>
                    ) : null}
                  </View>
                </Band>
              </View>
              <View style={[styles.narrowCard, { paddingBottom: insets.bottom + spacing['2xl'] }]}>{card}</View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: B.mist },
  flex: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  grow: { flexGrow: 1 },
  white: { color: B.onNavy },
  whiteMuted: { color: B.onNavyMuted },
  ink: { color: B.ink },
  inkMuted: { color: B.inkMuted },
  teal: { color: B.teal },
  tealDeep: { color: B.tealDeep },
  quote: { gap: spacing.sm, padding: spacing.xl, borderRadius: 20, backgroundColor: B.navyRaised, borderWidth: 1, borderColor: B.navyLine },
  switch: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lockup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  panel: { width: '44%', maxWidth: 620, backgroundColor: B.navy, overflow: 'hidden', paddingHorizontal: spacing['4xl'], gap: spacing['4xl'] },
  panelBody: { gap: spacing['2xl'], marginTop: spacing['3xl'] },
  points: { gap: spacing.lg },
  point: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  panelShot: { alignItems: 'center', marginBottom: -200 },
  side: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['2xl'] },
  card: { width: '100%', maxWidth: 480, padding: spacing['2xl'], gap: spacing.xl, borderRadius: 28, backgroundColor: B.card, boxShadow: B.cardShadow },
  cardLifted: { marginTop: -spacing['3xl'] },
  cardHead: { gap: spacing.xs },
  body: { gap: spacing.lg },
  navy: { backgroundColor: B.navy, overflow: 'hidden' },
  band: { paddingBottom: spacing['4xl'] + spacing['3xl'], gap: spacing['2xl'] },
  bandText: { gap: spacing.xs },
  narrowCard: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: spacing.lg },
});
