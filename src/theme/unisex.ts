/**
 * Unisex salon (website brief 5.4, 2026-10-23): the gents kit's layout (header band, cards) in Saloqo's own teal — a
 * look that is neither the barber violet nor the ladies coral. Same keys as gents.ts.
 */
import { gents } from './gents';
import { type Theme } from './tokens';

const teal = {
  primary50: '#EEF8F6',
  primary100: '#D3EFEA',
  primary200: '#A8DFD6',
  primary300: '#76C9BC',
  primary400: '#45A99B',
  primary500: '#2F8A7E',
  primary600: '#26736A',
  primary700: '#1D5C54',
};

export const unisex: Theme = {
  ...gents,
  mode: 'unisex',
  colors: {
    ...gents.colors,
    ...teal,
    primaryAction: teal.primary600,
    primaryActionPressed: teal.primary700,
    primaryText: teal.primary600,
    background: '#F3FAF8',
    headerArea: '#F3FAF8',
    accent: '#6C45F2',
    categoryFills: ['#D3EFEA', '#EDE7FF', '#FFEBD9', '#FFF6D6', '#E0F4FF'],
    categoryIcons: ['#26736A', '#6C45F2', '#F28A2E', '#E0A800', '#1E90D6'],
    thumbFills: ['#D3EFEA', '#EDE7FF', '#E0F4FF', '#FFEBD9'],
    thumbIcons: ['#26736A', '#6C45F2', '#1E90D6', '#F28A2E'],
  },
  shadow: { boxShadow: '0px 6px 16px rgba(47, 138, 126, 0.10)' },
};
