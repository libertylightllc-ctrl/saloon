import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, type DimensionValue } from 'react-native';

import { useTheme } from '@/theme';

export interface SkeletonProps {
  width?: DimensionValue;
  height: number;
  radius?: number;
}

/** Loading placeholder in n20, gently pulsing unless Reduce Motion is on. */
export function Skeleton({ width = '100%', height, radius }: SkeletonProps) {
  const theme = useTheme();
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => loop?.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      style={{
        width,
        height,
        borderRadius: radius ?? theme.radius.sm,
        backgroundColor: theme.colors.inputFill,
        opacity,
      }}
    />
  );
}
