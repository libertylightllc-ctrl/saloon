/**
 * Layout direction. Normally it follows the app language (Arabic/Urdu = RTL, applied natively by
 * I18nManager after a reload). The theme gallery can override it for one subtree so every
 * component can be checked in RTL without switching language.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  I18nManager,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { isLanguage, isRtlLanguage } from '@/lib/i18n';

export type Direction = 'ltr' | 'rtl';

interface DirectionContextValue {
  direction: Direction;
  override: Direction | null;
  setOverride: (direction: Direction | null) => void;
}

const DirectionContext = createContext<DirectionContextValue | null>(null);

function useAppDirection(): Direction {
  const { i18n } = useTranslation();
  if (Platform.OS !== 'web') return I18nManager.isRTL ? 'rtl' : 'ltr';
  return isLanguage(i18n.language) && isRtlLanguage(i18n.language) ? 'rtl' : 'ltr';
}

export function DirectionProvider({ children }: { children: ReactNode }) {
  const appDirection = useAppDirection();
  const [override, setOverride] = useState<Direction | null>(null);
  const direction = override ?? appDirection;

  const value = useMemo(() => ({ direction, override, setOverride }), [direction, override]);

  return (
    <DirectionContext.Provider value={value}>
      <DirectionView direction={direction} style={styles.fill}>
        {children}
      </DirectionView>
    </DirectionContext.Provider>
  );
}

function useDirectionContext(): DirectionContextValue {
  const value = useContext(DirectionContext);
  if (!value) throw new Error('useDirection must be used inside <DirectionProvider>');
  return value;
}

export function useDirection(): Direction {
  return useDirectionContext().direction;
}

export function useIsRTL(): boolean {
  return useDirection() === 'rtl';
}

/** Dev tools only: force a direction (null = follow the language). */
export function useDirectionOverride() {
  const { override, setOverride } = useDirectionContext();
  return { override, setOverride };
}

/**
 * A View that lays its children out in a fixed direction. Native uses Yoga's `direction` style;
 * react-native-web needs the HTML `dir` attribute instead.
 */
export function DirectionView({
  direction,
  style,
  children,
}: {
  direction: Direction;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  if (Platform.OS === 'web') {
    const webProps = { dir: direction } as object;
    return (
      <View {...webProps} style={style}>
        {children}
      </View>
    );
  }
  return <View style={[style, { direction }]}>{children}</View>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
