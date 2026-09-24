/** Ladies — coral-pink "Fashly" concept (docs/reference/ladies-style.jpeg). */
import { neutrals, radius, type Theme } from './tokens';

const coral = {
  primary50: '#FFF3F2',
  primary100: '#FDE1E0',
  primary200: '#FBC4C3',
  primary300: '#F8A2A2',
  primary400: '#F58B8C',
  primary500: '#F2777A',
  primary600: '#D14F5A',
  primary700: '#B8464B',
};

export const ladies: Theme = {
  mode: 'ladies',
  colors: {
    ...coral,
    // Slightly deeper than brand coral so white labels read better (3.5:1). Set to
    // coral.primary500 for the exact reference look (02-DESIGN-SYSTEM §1.2).
    primaryAction: '#E0606A',
    primaryActionPressed: coral.primary600,
    onPrimary: neutrals.white,
    primaryText: coral.primary700,
    background: '#FFF7F5',
    headerArea: 'transparent',
    surface: neutrals.white,
    text: neutrals.n100,
    textSecondary: neutrals.n70,
    textOnTint: neutrals.n80,
    textDisabled: neutrals.n60,
    border: neutrals.n40,
    divider: neutrals.n30,
    inputFill: neutrals.n20,
    accent: '#B892DB',
    categoryFills: [coral.primary100],
    categoryIcons: [coral.primary500],
    thumbFills: [coral.primary50, '#F4EEFB', '#FDEEF5'],
    thumbIcons: [coral.primary500, '#9B6FC6', coral.primary600],
    scrim: 'rgba(34, 34, 34, 0.45)',
    neutral: neutrals,
  },
  backgroundGradient: ['#FBE7E1', '#F6EAF1', '#ECDDF3'],
  radius: { ...radius, button: 10, thumb: radius.sm, sheet: radius.xl },
  shadow: { boxShadow: '0px 6px 16px rgba(242, 119, 122, 0.1)' },
  sizes: { buttonLg: 48, buttonMd: 40, buttonSm: 32, category: 56 },
  variants: {
    body: 'sheet',
    header: 'light',
    segmentTabs: 'pill',
    listAction: 'outlined',
    iconButton: 'square',
    promo: 'photo',
    homeTop: 'wordmark',
    listRow: 'plain',
    sectionTitle: 'medium',
    tabBarIndicator: false,
  },
};
