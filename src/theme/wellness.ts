/**
 * Beauty & wellness studio (website brief 5.4, 2026-10-23): the ladies kit's layout (soft sheet, light header) in a
 * calm lavender with a sage hint. Same keys as ladies.ts.
 */
import { ladies } from './ladies';
import { type Theme } from './tokens';

const lavender = {
  primary50: '#F6F2FC',
  primary100: '#EBE3F8',
  primary200: '#D8C9F1',
  primary300: '#BFA7E6',
  primary400: '#A587D8',
  primary500: '#8A67C6',
  primary600: '#7050AE',
  primary700: '#5A3F92',
};

export const wellness: Theme = {
  ...ladies,
  mode: 'wellness',
  colors: {
    ...ladies.colors,
    ...lavender,
    primaryAction: lavender.primary600,
    primaryActionPressed: lavender.primary700,
    primaryText: lavender.primary700,
    background: '#F8F5FC',
    accent: '#45A99B',
    categoryFills: [lavender.primary100],
    categoryIcons: [lavender.primary500],
    thumbFills: [lavender.primary50, '#EAF5F2', '#F4EEFB'],
    thumbIcons: [lavender.primary500, '#2F8A7E', lavender.primary600],
  },
  backgroundGradient: ['#EFE8FA', '#F3EEF8', '#E5F2EE'],
  shadow: { boxShadow: '0px 6px 16px rgba(138, 103, 198, 0.10)' },
};
