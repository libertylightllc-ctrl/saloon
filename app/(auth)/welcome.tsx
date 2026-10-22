import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSalonType } from '@/features/auth/salonType';
import { FinalCall, Footer, HowItWorks } from '@/features/landing/Closing';
import { DemoVideo } from '@/features/landing/DemoVideo';
import { Faq } from '@/features/landing/Faq';
import { FeatureBento } from '@/features/landing/FeatureBento';
import { Hero } from '@/features/landing/Hero';
import { KeepYourApp } from '@/features/landing/KeepYourApp';
import { OwnerBenefits } from '@/features/landing/OwnerBenefits';
import { useLandingLayout } from '@/features/landing/parts';
import { Pricing } from '@/features/landing/Pricing';
import { SocialProof } from '@/features/landing/SocialProof';
import { FloatingWhatsApp, StickyBar } from '@/features/landing/StickyCta';
import { TypeChoice } from '@/features/landing/TypeChoice';
import { usePublicPrices } from '@/features/plan/api';
import { usePageMeta } from '@/lib/pageMeta';
import { canOfferPlans } from '@/features/plan/storePolicy';
import { brandPalette, type Mode } from '@/theme';

/**
 * The first page a visitor sees (redesigned 2026-10-17 in the product video's look): what the app does, what the owner
 * gets, for which salons, the price, and the way in. Choosing a salon type sets the look (and the words) of everything
 * after it; every "start" leads to the owner sign-up. The phone apps show no price or trial (storePolicy).
 */
export default function Welcome() {
  const { t } = useTranslation();
  const router = useRouter();
  const { salonType, setSalonType } = useSalonType();
  const prices = usePublicPrices();
  const { compact } = useLandingLayout();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const [typesY, setTypesY] = useState(0);
  const [next, setNext] = useState<'/sign-in' | '/sign-up'>('/sign-in');
  // Where things are on the page, for the sticky bar and "See how it works".
  const at = useRef({ cta: Infinity, pricing: [0, 0], final: [0, 0], features: 0, video: -1, y: 0 });
  const [sticky, setSticky] = useState(false);

  const trialDays = canOfferPlans ? (prices.data?.trial_days ?? 0) : 0;
  const startLabel = trialDays > 0 ? t('auth.landing.start', { count: trialDays }) : t('auth.landing.create');
  usePageMeta(t('meta.welcome.title'), t('meta.welcome.description'));

  const choose = (mode: Mode) => {
    setSalonType(mode);
    // push, not replace: the back arrow on sign-up returns here (brief 1.4).
    router.push(next);
  };
  const toTypes = (to: '/sign-in' | '/sign-up') => {
    // Someone who already picked a type on this device goes straight on; everyone else picks one first.
    if (salonType) {
      router.push(to);
      return;
    }
    setNext(to);
    scroll.current?.scrollTo({ y: typesY, animated: true });
  };
  // The bar shows once the hero's button has scrolled away, and hides over the pricing card and the last call.
  const update = (y: number) => {
    at.current.y = y;
    const a = at.current;
    const over = ([top, bottom]: number[]) => top! < y + height && bottom! > y;
    const show = compact && y > a.cta && !over(a.pricing) && !over(a.final);
    setSticky((was) => (was === show ? was : show));
  };
  const seeHow = () => scroll.current?.scrollTo({ y: at.current.video >= 0 ? at.current.video : at.current.features, animated: true });

  return (
    <View style={styles.page}>
      <ScrollView
        ref={scroll}
        style={styles.page}
        contentContainerStyle={compact ? { paddingBottom: 76 + insets.bottom } : undefined}
        onScroll={(e) => update(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={64}
      >
        <Hero
          createLabel={startLabel}
          onCreate={() => toTypes('/sign-up')}
          onSignIn={() => toTypes('/sign-in')}
          onSeeHow={seeHow}
          onCtaBottom={(windowY) => (at.current.cta = windowY + at.current.y)}
          trialLine={trialDays > 0 ? t('auth.landing.noCard') : null}
        />
        <KeepYourApp />
        <OwnerBenefits />
        <SocialProof />
        <FeatureBento onLayoutY={(y) => (at.current.features = y)} />
        <DemoVideo onLayoutY={(y) => (at.current.video = y)} />
        <TypeChoice onChoose={choose} onLayoutY={setTypesY} />
        <HowItWorks />
        {canOfferPlans ? (
          <Pricing startLabel={startLabel} onStart={() => toTypes('/sign-up')} onLayoutRange={(top, bottom) => (at.current.pricing = [top, bottom])} />
        ) : null}
        <Faq />
        <FinalCall label={startLabel} onPress={() => toTypes('/sign-up')} onLayoutRange={(top, bottom) => (at.current.final = [top, bottom])} />
        <Footer />
      </ScrollView>
      {compact ? <StickyBar visible={sticky} label={startLabel} onStart={() => toTypes('/sign-up')} /> : <FloatingWhatsApp />}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: brandPalette.mist },
});
