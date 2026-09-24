/** The check-mark after "Save sale" (02-DESIGN-SYSTEM §4). Static when Reduce Motion is on. */
import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { semantic, useTheme } from '@/theme';

import { Icon } from './Icon';
import { useNativeDriver, useReducedMotion } from './motion';

export function SuccessCheck({ size = 96 }: { size?: number }) {
  const theme = useTheme();
  const reduce = useReducedMotion();
  const [ring] = useState(() => new Animated.Value(0));
  const [tick] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduce === null) return;
    if (reduce) {
      ring.setValue(1);
      tick.setValue(1);
      return;
    }
    const animation = Animated.sequence([
      Animated.spring(ring, { toValue: 1, friction: 6, tension: 90, useNativeDriver }),
      Animated.spring(tick, { toValue: 1, friction: 5, tension: 140, useNativeDriver }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [reduce, ring, tick]);

  const inner = Math.round(size * 0.66);
  return (
    <Animated.View
      testID="success-check"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.center,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: semantic.success.surface,
          opacity: ring,
          transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.center,
          {
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: semantic.success.hover,
            transform: [{ scale: tick }],
          },
        ]}
      >
        <Icon
          name="check"
          size={Math.round(size * 0.36)}
          strokeWidth={3}
          color={theme.colors.onPrimary}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
