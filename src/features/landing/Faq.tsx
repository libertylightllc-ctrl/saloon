/**
 * Common questions on the home page (website brief 2.10), before the last call: an accordion, in the reader's
 * language, with the visitor's own price; and the same questions as FAQPage structured data for search engines.
 * Answers follow how the product works today.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { brandPalette as B, spacing } from '@/theme';
import { Icon, Text } from '@/ui';

import { Band, useLandingLayout } from './parts';
import { useLandingPrice } from './price';

export const FAQ_KEYS = [
  'price',
  'free',
  'branches',
  'uaeCost',
  'card',
  'staffSignIn',
  'languages',
  'types',
  'data',
  'staff',
  'printer',
  'devices',
  'homeScreen',
  'bookingApp',
  'countries',
] as const;

export function Faq({ onOpen }: { onOpen?: (key: string) => void }) {
  const { t } = useTranslation();
  const { compact } = useLandingLayout();
  const price = useLandingPrice();
  const [open, setOpen] = useState<string | null>(null);
  // Answers with the visitor's price (full update brief: per branch, from the one pricing config).
  const answer = (k: (typeof FAQ_KEYS)[number]) =>
    k === 'price' && !price
      ? t('auth.landing.faq.price.aNoPrice')
      : t(`auth.landing.faq.${k}.a`, { price: price?.price ?? '', people: price?.people ?? 4, extra: price?.extra ?? '' });

  // The same questions for search engines (FAQPage), in the page's language.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.id = 'faq-jsonld';
    tag.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ_KEYS.map((k) => ({
        '@type': 'Question',
        name: t(`auth.landing.faq.${k}.q`),
        acceptedAnswer: { '@type': 'Answer', text: answer(k) },
      })),
    });
    document.getElementById('faq-jsonld')?.remove();
    document.head.appendChild(tag);
    return () => tag.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the answers change only with the language and the price
  }, [t, price?.price]);

  return (
    <Band ground={B.mist} style={[styles.band, compact && styles.bandCompact]} testID="landing-faq">
      <Text variant={compact ? 'sectionCompact' : 'section'} align="center" style={styles.ink} accessibilityRole="header">
        {t('auth.landing.faq.title')}
      </Text>
      <View style={styles.list}>
        {FAQ_KEYS.map((k) => {
          const isOpen = open === k;
          return (
            <View key={k} style={styles.item}>
              <Pressable
                onPress={() => {
                  setOpen(isOpen ? null : k);
                  if (!isOpen) onOpen?.(k);
                }}
                accessibilityRole="button"
                aria-expanded={isOpen}
                style={styles.question}
                testID={`landing-faq-${k}`}
              >
                <Text variant="bodyStrong" style={[styles.ink, styles.flex]}>
                  {t(`auth.landing.faq.${k}.q`)}
                </Text>
                <Icon name={isOpen ? 'minus' : 'plus'} size={20} color={B.tealDeep} />
              </Pressable>
              {isOpen ? (
                <Text style={[styles.muted, styles.answer]} testID={`landing-faq-${k}-answer`}>
                  {answer(k)}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </Band>
  );
}

const styles = StyleSheet.create({
  band: { paddingVertical: 72, gap: spacing['2xl'] },
  bandCompact: { paddingVertical: 40, gap: spacing.lg },
  list: { maxWidth: 820, width: '100%', alignSelf: 'center', gap: spacing.sm },
  item: { borderRadius: 16, backgroundColor: B.card, borderWidth: 1, borderColor: B.hairline },
  question: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  answer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  flex: { flex: 1 },
  ink: { color: B.ink },
  muted: { color: B.inkMuted },
});
