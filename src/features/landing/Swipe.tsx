import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { brandPalette as B, screenPadding, spacing } from '@/theme';

/** A row that swipes sideways on a phone, the next card peeking in, with dots (brief 2.14). */
export function Swipe({ count, share, testID, children }: { count: number; share: number; testID: string; children: (i: number, width: number) => ReactNode }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const card = Math.round(width * share);
  const step = card + spacing.md;
  return (
    <View style={styles.swipe}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        contentContainerStyle={styles.swipeRow}
        onScroll={(e) => setIndex(Math.min(count - 1, Math.max(0, Math.round(Math.abs(e.nativeEvent.contentOffset.x) / step))))}
        scrollEventThrottle={32}
        testID={testID}
      >
        {Array.from({ length: count }, (_, i) => children(i, card))}
      </ScrollView>
      <View style={styles.dots} accessibilityLabel={t('auth.landing.swipe', { n: index + 1, total: count })}>
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  swipe: { gap: spacing.md, marginHorizontal: -screenPadding },
  swipeRow: { gap: spacing.md, paddingHorizontal: screenPadding },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: B.hairline },
  dotOn: { width: 20, backgroundColor: B.tealDeep },
});
