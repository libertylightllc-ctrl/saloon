import { Image } from 'react-native';

import mark from '../../assets/images/brand-mark.png';

/**
 * The Saloqo star on its navy tile, cut from the owner's logo artwork (scripts/make-icons.mjs). The same in both
 * looks, like the app icon; the app's name always sits beside it, so it is not read out on its own.
 */
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <Image
      source={mark}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }}
      accessible={false}
      aria-hidden
      testID="brand-mark"
    />
  );
}
