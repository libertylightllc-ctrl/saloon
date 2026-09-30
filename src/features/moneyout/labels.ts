import { useTranslation } from 'react-i18next';

import type { IconName } from '@/ui';

export const DEFAULT_CATEGORY_KEYS = [
  'tea_food', 'electricity', 'water', 'internet_phone', 'rent', 'uniforms', 'dry_cleaning', 'cleaning', 'repairs',
  'transport', 'marketing', 'licences', 'bank_fees', 'staff_accommodation', 'staff_welfare', 'other',
] as const;
type DefaultKey = (typeof DEFAULT_CATEGORY_KEYS)[number];

/** Built-in categories read in the app language; the owner's own categories keep their name. */
export function useCategoryName() {
  const { t } = useTranslation();
  return (c: { key: string | null; name: string } | null | undefined) =>
    !c ? '—' : c.key && (DEFAULT_CATEGORY_KEYS as readonly string[]).includes(c.key) ? t(`expenses.categories.${c.key as DefaultKey}`) : c.name;
}

export const categoryIcon = (icon: string | undefined): IconName => (icon ?? 'receipt') as IconName;

/** How a purchase is numbered on screen, on paper and in the books (purchase_no() in the database): PUR-00125. */
export const purchaseNo = (n: number) => `PUR-${String(n).padStart(5, '0')}`;
