/** Confirmations that repeat the button's verb ("Sale saved"). */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { screenPadding, semantic, spacing, useTheme } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

type ToastTone = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  text: string;
  tone: ToastTone;
}

const ToastContext = createContext<((text: string, tone?: ToastTone) => void) | null>(null);

/** Space kept free above the bottom tab bar. */
const TAB_BAR_CLEARANCE = 80;
/** How long a toast stays on screen. */
export const TOAST_MS = 2800;

/**
 * One toast at a time. The provider owns a single timer: a new toast cancels the previous one's
 * timer, and a timer only ever clears its own toast — so a quick second confirmation is never cut
 * short by the first one running out.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastId = useRef(0);

  const show = useCallback((text: string, tone: ToastTone = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    const id = ++lastId.current;
    setToast({ id, text, tone });
    timer.current = setTimeout(() => setToast((current) => (current?.id === id ? null : current)), TOAST_MS);
    AccessibilityInfo.announceForAccessibility(text);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} /> : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside <ToastProvider>');
  return show;
}

/** Slides and fades in; how long it stays is the provider's timer, not this animation. */
function ToastView({ toast }: { toast: ToastMessage }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        animation = Animated.timing(progress, { toValue: 1, duration: reduce ? 0 : 180, useNativeDriver: true });
        animation.start();
      });
    return () => {
      cancelled = true;
      animation?.stop();
    };
  }, [progress]);

  const icon = toast.tone === 'error' ? 'alert' : toast.tone === 'info' ? 'bell' : 'circleCheck';
  const iconColor = toast.tone === 'error' ? semantic.error.border : semantic.success.main;

  return (
    <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + TAB_BAR_CLEARANCE }]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.toast,
          { backgroundColor: theme.colors.text, borderRadius: theme.radius.md },
          {
            opacity: progress,
            transform: [
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
            ],
          },
        ]}
      >
        <Icon name={icon} size={20} color={iconColor} />
        <Text variant="bodyStrong" color="onPrimary" style={styles.text}>
          {toast.text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', start: screenPadding, end: screenPadding, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    maxWidth: 420,
  },
  text: { flexShrink: 1 },
});
