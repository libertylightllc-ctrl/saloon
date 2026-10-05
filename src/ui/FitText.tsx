import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Platform, type Text as RNText } from 'react-native';

import { typeScale } from '@/theme';

import { Text, type TextProps } from './Text';

/** Never shrink below this share of the variant's size; past it the text is cut with "…" as before. */
const MIN_SCALE = 0.6;

/**
 * One line that shrinks to fit its width instead of being cut off — a big amount in a narrow card. Native shrinks by
 * itself (`adjustsFontSizeToFit`); the web measures the text at full size and sets a smaller font when it overflows.
 */
export function FitText({ children, variant = 'body', style, ...rest }: Omit<TextProps, 'numberOfLines'> & { children: string }) {
  const ref = useRef<RNText>(null);
  const base = typeScale[variant].fontSize;
  const [fontSize, setFontSize] = useState<number>();

  const fit = useCallback(() => {
    const el = ref.current as unknown as HTMLElement | null;
    if (Platform.OS !== 'web' || !el?.clientWidth) return;
    const current = fontSize ?? base;
    // scrollWidth is the whole text's width at the current size, even where it is cut off.
    if (el.scrollWidth > el.clientWidth + 1) {
      const next = Math.max(base * MIN_SCALE, Math.floor((current * el.clientWidth) / el.scrollWidth));
      if (next < current) setFontSize(next);
    } else if (fontSize && (el.scrollWidth * base) / fontSize <= el.clientWidth) {
      setFontSize(undefined); // room again for the full size
    }
  }, [base, fontSize]);
  useLayoutEffect(fit, [fit, children]);

  return (
    <Text
      ref={ref}
      variant={variant}
      numberOfLines={1}
      adjustsFontSizeToFit
      onLayout={fit}
      style={[style, fontSize ? { fontSize } : null]}
      {...rest}
    >
      {children}
    </Text>
  );
}
