/**
 * Everything that differs between gents and ladies (01-PRODUCT §1.1) other than the look.
 * Screens read this instead of branching on the mode.
 */
import type { IconName } from '@/ui/Icon';
import type { Mode } from '@/theme';

export interface CategoryPreset {
  key: string;
  icon: IconName;
}

export interface ModeConfig {
  /** Gents lead with walk-ins, ladies with appointments. */
  queueFirst: 'walk_in' | 'appointment';
  defaultCategories: readonly CategoryPreset[];
  usesRooms: boolean;
  patchTestRemindersDefault: boolean;
  customerPhotosDefault: boolean;
}

export const modeConfig: Record<Mode, ModeConfig> = {
  gents: {
    queueFirst: 'walk_in',
    defaultCategories: [
      { key: 'hair', icon: 'scissors' },
      { key: 'beard', icon: 'brush' },
      { key: 'color', icon: 'palette' },
      { key: 'face', icon: 'face' },
      { key: 'massage', icon: 'massage' },
    ],
    usesRooms: false,
    patchTestRemindersDefault: false,
    customerPhotosDefault: true,
  },
  ladies: {
    queueFirst: 'appointment',
    defaultCategories: [
      { key: 'hair', icon: 'scissors' },
      { key: 'color', icon: 'palette' },
      { key: 'nails', icon: 'hand' },
      { key: 'facial', icon: 'sparkles' },
      { key: 'makeup', icon: 'brush' },
      { key: 'waxing', icon: 'feather' },
      { key: 'spa', icon: 'flower' },
      { key: 'bridal', icon: 'gem' },
    ],
    usesRooms: true,
    patchTestRemindersDefault: true,
    customerPhotosDefault: false,
  },
};
