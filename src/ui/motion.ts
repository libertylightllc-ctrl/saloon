import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * The system Reduce Motion setting (iOS/Android accessibility, prefers-reduced-motion on web).
 * `null` until the answer arrives, so animations can wait rather than start and then stop.
 */
export function useReducedMotion(): boolean | null {
  const [reduce, setReduce] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => alive && setReduce(value))
      .catch(() => alive && setReduce(false));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}

/** The native animation driver isn't available on web. */
export const useNativeDriver = Platform.OS !== 'web';
