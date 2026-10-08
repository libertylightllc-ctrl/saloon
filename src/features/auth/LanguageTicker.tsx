import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { LANGUAGES } from '@/lib/i18n';
import { Text, useReducedMotion } from '@/ui';

const EVERY_MS = 2000;
const FADE_MS = 250;
const useNativeDriver = Platform.OS !== 'web';
// Sizes the slot, so the line does not shift as shorter names come round.
const LONGEST = LANGUAGES.reduce((a, b) =>
  b.nativeName.length > a.nativeName.length ? b : a,
).nativeName;

/**
 * The app's languages on the welcome page, one at a time (owner, 2026-10-08: the full line did not fit a phone).
 * Screen readers hear the whole list; with Reduce Motion the list is shown whole and wraps.
 */
export function LanguageTicker() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [shown] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reduce !== false) return undefined;
    const timer = setInterval(() => {
      Animated.timing(shown, { toValue: 0, duration: FADE_MS, useNativeDriver }).start(() => {
        setIndex((i) => (i + 1) % LANGUAGES.length);
        Animated.timing(shown, { toValue: 1, duration: FADE_MS, useNativeDriver }).start();
      });
    }, EVERY_MS);
    return () => clearInterval(timer);
  }, [reduce, shown]);

  const all = t('auth.landing.facts.languages');
  if (reduce) {
    return (
      <Text variant="bodyStrong" align="center" style={styles.wrap}>
        {all}
      </Text>
    );
  }
  return (
    <View accessible accessibilityLabel={all} testID="landing-languages">
      <Text variant="bodyStrong" style={styles.sizer} aria-hidden>
        {LONGEST}
      </Text>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: shown,
            transform: [
              { translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
            ],
          },
        ]}
        aria-hidden
      >
        <Text variant="bodyStrong">{LANGUAGES[index]!.nativeName}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sizer: { opacity: 0 },
  wrap: { flexShrink: 1 },
});
