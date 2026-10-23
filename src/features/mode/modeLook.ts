/**
 * Each salon type's icon and its real queue screen, for the places that let people pick a type (the home page's
 * cards, setup, Branch settings, the sign-in panel). Website brief 5.4 added unisex and wellness (2026-10-23).
 */
import type { ImageSourcePropType } from 'react-native';

import type { Mode } from '@/theme';
import type { IconName } from '@/ui/Icon';

import gentsQueue from '../../../assets/images/landing/gents-queue.webp';
import ladiesQueue from '../../../assets/images/landing/ladies-queue.webp';
import unisexQueue from '../../../assets/images/landing/unisex-queue.webp';
import wellnessQueue from '../../../assets/images/landing/wellness-queue.webp';

export const MODE_ICON: Record<Mode, IconName> = { gents: 'scissors', ladies: 'flower', unisex: 'users', wellness: 'sparkles' };

export const MODE_SHOT: Record<Mode, ImageSourcePropType> = { gents: gentsQueue, ladies: ladiesQueue, unisex: unisexQueue, wellness: wellnessQueue };
