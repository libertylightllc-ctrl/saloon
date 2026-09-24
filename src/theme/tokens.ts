/**
 * Shared design scale (docs/02-DESIGN-SYSTEM.md §1). gents.ts and ladies.ts build a `Theme`
 * with the same keys; components only read semantic names through useTheme().
 */
import type { TextStyle } from 'react-native';

export type Mode = 'gents' | 'ladies';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
} as const;

/** Screen side padding. */
export const screenPadding = 20;

/** Minimum tap target. */
export const tapTarget = 44;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 28,
  pill: 999,
} as const;

export const neutrals = {
  white: '#FFFFFF',
  n20: '#F2F3F8',
  n30: '#EFEFEF',
  n40: '#E1E1E1',
  n50: '#BEBEBE',
  n60: '#9F9F9F',
  n70: '#767676',
  n80: '#626262',
  n90: '#3D3D3D',
  n100: '#222222',
} as const;

export interface SemanticSet {
  main: string;
  surface: string;
  border: string;
  hover: string;
  pressed: string;
}

export const semantic: Record<'success' | 'info' | 'warning' | 'error', SemanticSet> = {
  success: {
    main: '#00BF71',
    surface: '#CCF2E3',
    border: '#AAEAD0',
    hover: '#009F5E',
    pressed: '#006038',
  },
  info: {
    main: '#0C61F7',
    surface: '#CEDFFD',
    border: '#AECAFC',
    hover: '#0A51CE',
    pressed: '#06307C',
  },
  warning: {
    main: '#F2C94C',
    surface: '#FCF4DB',
    border: '#FBEDC3',
    hover: '#CAA73F',
    pressed: '#796425',
  },
  error: {
    main: '#E5484D',
    surface: '#FDE8E8',
    border: '#F9C5C6',
    hover: '#C93B40',
    pressed: '#7A1F22',
  },
};

export type Tone = keyof typeof semantic | 'primary' | 'neutral';

/** Colours an owner can give each employee (timeline columns, avatars). Stored per employee. */
export const staffColours = [
  '#6C45F2',
  '#F28A2E',
  '#1E90D6',
  '#F2777A',
  '#B892DB',
  '#E0A800',
  '#00A862',
  '#D14F5A',
] as const;

/** Initials avatars when no employee colour or photo exists: pastel fill + dark ink (≥ 4.5:1). */
export const avatarPalette = [
  { fill: '#FFE4EC', ink: '#A3264D' },
  { fill: '#EDE7FF', ink: '#4724B5' },
  { fill: '#FFEBD9', ink: '#8A4210' },
  { fill: '#FFF6D6', ink: '#6E5200' },
  { fill: '#E0F4FF', ink: '#0B5A8A' },
  { fill: '#DDF5EA', ink: '#0B6B45' },
] as const;

export type FontWeightName = 'regular' | 'medium' | 'semibold' | 'bold';

export interface TypeStyle {
  fontSize: number;
  lineHeight: number;
  weight: FontWeightName;
}

export const typeScale = {
  display: { fontSize: 28, lineHeight: 36, weight: 'bold' },
  h1: { fontSize: 24, lineHeight: 32, weight: 'bold' },
  h2: { fontSize: 20, lineHeight: 28, weight: 'bold' },
  h3: { fontSize: 18, lineHeight: 26, weight: 'semibold' },
  h4: { fontSize: 16, lineHeight: 24, weight: 'semibold' },
  body: { fontSize: 14, lineHeight: 20, weight: 'regular' },
  bodyStrong: { fontSize: 14, lineHeight: 20, weight: 'medium' },
  small: { fontSize: 12, lineHeight: 16, weight: 'regular' },
  micro: { fontSize: 10, lineHeight: 14, weight: 'medium' },
} as const satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof typeScale;

export const tabularNums: TextStyle = { fontVariant: ['tabular-nums'] };

export interface ThemeColors {
  primary50: string;
  primary100: string;
  primary200: string;
  primary300: string;
  primary400: string;
  primary500: string;
  primary600: string;
  primary700: string;
  /** Filled buttons (white label). */
  primaryAction: string;
  primaryActionPressed: string;
  onPrimary: string;
  /** Coloured text on light backgrounds (links, "View all", active labels). */
  primaryText: string;
  background: string;
  /** Top area behind the header (gents lavender, ladies blush). */
  headerArea: string;
  surface: string;
  text: string;
  /** Secondary text on white surfaces (4.5:1). */
  textSecondary: string;
  /** Secondary text on tinted backgrounds (n80 keeps 4.5:1 there). */
  textOnTint: string;
  textDisabled: string;
  border: string;
  divider: string;
  inputFill: string;
  accent: string;
  /** Round category circles cycle through these (gents multicolour, ladies single tint). */
  categoryFills: readonly string[];
  categoryIcons: readonly string[];
  /** List thumbnails (placeholder art until real images). */
  thumbFills: readonly string[];
  thumbIcons: readonly string[];
  scrim: string;
  neutral: typeof neutrals;
}

export interface Theme {
  mode: Mode;
  colors: ThemeColors;
  /** Ladies screens sit on a blush→lavender gradient; gents are flat. */
  backgroundGradient: readonly [string, string, ...string[]] | null;
  radius: typeof radius & { button: number; thumb: number; sheet: number };
  /** Tinted, never grey (02-DESIGN-SYSTEM §1.6). boxShadow renders the tint on iOS, Android and web. */
  shadow: { boxShadow: string };
  sizes: { buttonLg: number; buttonMd: number; buttonSm: number; category: number };
  /** Signature differences between the two kits (02-DESIGN-SYSTEM §2). */
  variants: {
    /** band = violet band, white title, rounded bottom corners · light = dark title on blush */
    header: 'band' | 'light';
    /** plain = content on the screen background · sheet = white sheet with rounded top corners */
    body: 'plain' | 'sheet';
    segmentTabs: 'band' | 'pill';
    listAction: 'tinted' | 'outlined';
    iconButton: 'circle' | 'square';
    promo: 'band' | 'photo';
    homeTop: 'profile' | 'wordmark';
    /** Gents list rows are bordered cards; ladies rows sit plain on the white sheet. */
    listRow: 'card' | 'plain';
    sectionTitle: FontWeightName;
    tabBarIndicator: boolean;
  };
}
