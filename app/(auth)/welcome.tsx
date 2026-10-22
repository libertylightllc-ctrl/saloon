import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';

import { useSalonType } from '@/features/auth/salonType';
import { FinalCall, Footer, HowItWorks } from '@/features/landing/Closing';
import { FeatureBento } from '@/features/landing/FeatureBento';
import { Hero } from '@/features/landing/Hero';
import { OwnerBenefits } from '@/features/landing/OwnerBenefits';
import { Pricing } from '@/features/landing/Pricing';
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
  const scroll = useRef<ScrollView>(null);
  const [typesY, setTypesY] = useState(0);
  const [next, setNext] = useState<'/sign-in' | '/sign-up'>('/sign-in');

  const trialDays = canOfferPlans ? (prices.data?.trial_days ?? 0) : 0;
  const startLabel = trialDays > 0 ? t('auth.landing.start', { count: trialDays }) : t('auth.landing.create');
  usePageMeta(t('meta.welcome.title'), t('meta.welcome.description'));

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
    <ScrollView ref={scroll} style={styles.page}>
      <Hero
        createLabel={startLabel}
        onCreate={() => toTypes('/sign-up')}
        onSignIn={() => toTypes('/sign-in')}
        trialLine={trialDays > 0 ? t('auth.landing.noCard') : null}
      />
      <OwnerBenefits />
      <FeatureBento />
      <TypeChoice onChoose={choose} onLayoutY={setTypesY} />
      <HowItWorks />
      {canOfferPlans ? <Pricing startLabel={startLabel} onStart={() => toTypes('/sign-up')} /> : null}
      <FinalCall label={startLabel} onPress={() => toTypes('/sign-up')} />
      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: brandPalette.mist },
});
