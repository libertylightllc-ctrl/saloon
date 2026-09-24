/** Confirmations that repeat the button's verb ("Sale saved"). */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const show = useCallback((text: string, tone: ToastTone = 'success') => {
    setToast((previous) => ({ id: (previous?.id ?? 0) + 1, text, tone }));
    AccessibilityInfo.announceForAccessibility(text);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onDone={() => setToast(null)} /> : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside <ToastProvider>');
  return show;
}

function ToastView({ toast, onDone }: { toast: ToastMessage; onDone: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      const duration = reduce ? 0 : 180;
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration, useNativeDriver: true }),
        Animated.delay(2400),
        Animated.timing(progress, { toValue: 0, duration, useNativeDriver: true }),
      ]).start(({ finished }) => finished && onDone());
    });
    return () => {
      cancelled = true;
    };
  }, [progress, onDone]);

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
