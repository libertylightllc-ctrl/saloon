import { Image, View } from 'react-native';

import { avatarPalette, readableOn, useTheme } from '@/theme';

import { Text } from './Text';

export interface AvatarProps {
  name: string;
  /** Employee colour (#RRGGBB). Otherwise a pastel is derived from the name. */
  color?: string;
  uri?: string;
  size?: number;
  /** White ring, for avatars on the violet band. */
  ring?: boolean;
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0]!, words[words.length - 1]!] : words.slice(0, 1);
  return letters
    .map((w) => Array.from(w)[0] ?? '')
    .join('')
    .toLocaleUpperCase();
}

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return h;
}

export function Avatar({ name, color, uri, size = 40, ring }: AvatarProps) {
  const theme = useTheme();
  const pair = avatarPalette[hash(name) % avatarPalette.length]!;
  const fill = color ?? pair.fill;
  const ink = color ? readableOn(color, theme.colors.text, theme.colors.onPrimary) : pair.ink;

  return (
    <View
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: fill,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: ring ? 3 : 0,
        borderColor: theme.colors.surface,
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} />
      ) : (
        <Text
          variant={size >= 56 ? 'h3' : size >= 36 ? 'bodyStrong' : 'micro'}
          weight="semibold"
          align="center"
          style={{ color: ink }}
        >
          {initials(name)}
        </Text>
      )}
    </View>
  );
}
