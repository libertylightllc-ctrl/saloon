/**
 * The website home page's own pieces (owner, 2026-10-17: "home page redesign", in the product video's look): the
 * navy ground with its glow and crosshairs, real app screens in a phone frame, the brand buttons and the page width.
 * Colours come from `brandPalette`: the home page wears Saloqo's own colours whichever salon look is picked.
 */
import type { ReactNode } from 'react';
import { Image, Linking, Platform, Pressable, StyleSheet, useWindowDimensions, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

import { brandPalette as B, screenPadding, spacing } from '@/theme';
import { Icon, Text, type IconName } from '@/ui';

/** Page width breakpoints: two columns from `wide`, phone sizes below `compact`. */
export function useLandingLayout() {
  const { width } = useWindowDimensions();
  return { wide: width >= 980, compact: width < 640, width };
}

/** One band of the page: full-width ground, content at most 1180 wide. */
export function Band({ children, ground, style, testID }: { children: ReactNode; ground: string; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View style={[styles.band, { backgroundColor: ground }]} testID={testID}>
      <View style={[styles.inner, style]}>{children}</View>
    </View>
  );
}

/** The navy ground's soft teal glow and faint crosshair grid (as in the video). Draws behind its band. */
export function NavyBackdrop({ glowAt = ['70%', '40%'] }: { glowAt?: [string, string] }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="glow" cx={glowAt[0]} cy={glowAt[1]} rx="45%" ry="55%">
            <Stop offset="0" stopColor={B.glow} stopOpacity={1} />
            <Stop offset="1" stopColor={B.navy} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="violet" cx="8%" cy="95%" rx="35%" ry="40%">
            <Stop offset="0" stopColor={B.violet} stopOpacity={0.22} />
            <Stop offset="1" stopColor={B.navy} stopOpacity={0} />
          </RadialGradient>
          <Pattern id="grid" width="96" height="96" patternUnits="userSpaceOnUse">
            <Path d="M48 42v12M42 48h12" stroke={B.onNavy} strokeOpacity={0.12} strokeWidth={1.2} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#glow)" />
        <Rect width="100%" height="100%" fill="url(#violet)" />
        <Rect width="100%" height="100%" fill="url(#grid)" />
      </Svg>
    </View>
  );
}

/** A real app screen in a phone frame. `tilt` turns it a little, as the video's floating phones. */
export function PhoneShot({ source, width, tilt = 0, style }: { source: ImageSourcePropType; width: number; tilt?: number; style?: ViewStyle }) {
  const height = Math.round(width * 2.164);
  const pad = Math.max(5, Math.round(width * 0.03));
  return (
    <View
      style={[
        styles.phone,
        { width, height, padding: pad, borderRadius: width * 0.16, transform: [{ rotate: `${tilt}deg` }] },
        style,
      ]}
      aria-hidden
    >
      <Image source={source} style={{ width: width - pad * 2, height: height - pad * 2, borderRadius: width * 0.13 }} resizeMode="cover" />
      <View style={[styles.island, { width: width * 0.28, height: width * 0.08, top: pad + width * 0.035, marginStart: -width * 0.14 }]} />
    </View>
  );
}

/**
 * The page's buttons: a teal pill (the main way in), a quiet outline, a navy pill, or a plain text link on navy. With
 * `href` it is a real link on the web (<a href>; external ones open in a new tab; brief 4.6), else a button.
 */
export function BrandButton({
  label,
  onPress,
  kind = 'teal',
  icon,
  testID,
  href,
  external,
  small,
  full,
}: {
  label: string;
  onPress?: () => void;
  kind?: 'teal' | 'outlineOnNavy' | 'navy' | 'textOnNavy' | 'whatsapp';
  icon?: IconName;
  testID?: string;
  href?: string;
  external?: boolean;
  small?: boolean;
  /** As wide as its row (the sticky bar). */
  full?: boolean;
}) {
  const look = {
    teal: { bg: B.teal, fg: B.navy, border: B.teal },
    navy: { bg: B.navy, fg: B.onNavy, border: B.navy },
    outlineOnNavy: { bg: 'transparent', fg: B.onNavy, border: B.navyLine },
    textOnNavy: { bg: 'transparent', fg: B.tealSoft, border: 'transparent' },
    whatsapp: { bg: B.whatsapp, fg: B.onNavy, border: B.whatsapp },
  }[kind];
  const link = href && Platform.OS === 'web';
  return (
    <Pressable
      onPress={onPress ?? (href && !link ? () => void Linking.openURL(href) : undefined)}
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={label}
      testID={testID}
      {...(link ? ({ href, hrefAttrs: external ? { target: '_blank', rel: 'noopener noreferrer' } : undefined } as object) : {})}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        full && styles.buttonFull,
        kind === 'textOnNavy' && styles.buttonText0,
        { backgroundColor: look.bg, borderColor: look.border },
        pressed && styles.pressed,
      ]}
    >
      <Text variant="bodyStrong" style={[styles.buttonText, small && styles.buttonTextSmall, { color: look.fg }]}>
        {label}
      </Text>
      {icon ? <Icon name={icon} size={small ? 16 : 18} color={look.fg} /> : null}
    </Pressable>
  );
}

/** A small label above a title. */
export function Eyebrow({ label, onNavy = false }: { label: string; onNavy?: boolean }) {
  return (
    <View style={[styles.eyebrow, { borderColor: onNavy ? B.navyLine : B.hairline, backgroundColor: onNavy ? 'transparent' : B.card }]}>
      <Icon name="sparkles" size={14} color={onNavy ? B.teal : B.tealDeep} />
      <Text variant="small" style={{ color: onNavy ? B.tealSoft : B.inkMuted }}>
        {label}
      </Text>
    </View>
  );
}

/** A teal tick in a circle, before each of the owner's benefits. */
export function Tick({ size = 28 }: { size?: number }) {
  return (
    <View style={[styles.tick, { width: size, height: size, borderRadius: size / 2 }]}>
      <Icon name="check" size={size * 0.6} color={B.navy} strokeWidth={2.6} />
    </View>
  );
}

const styles = StyleSheet.create({
  band: { width: '100%', overflow: 'hidden' },
  inner: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: screenPadding },
  phone: { backgroundColor: B.phoneBezel, boxShadow: B.liftShadow },
  island: { position: 'absolute', start: '50%', borderRadius: 999, backgroundColor: B.phoneIsland },
  button: {
    minHeight: 52,
    paddingHorizontal: spacing['2xl'],
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
  },
  buttonText: { fontSize: 16 },
  // Small: the top bar's "Sign in" on a phone; still a 44-px tap target.
  buttonSmall: { minHeight: 44, paddingHorizontal: spacing.md, borderWidth: 0 },
  buttonTextSmall: { fontSize: 15 },
  buttonText0: { paddingHorizontal: spacing.sm },
  buttonFull: { alignSelf: 'stretch' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  tick: { backgroundColor: B.teal, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
