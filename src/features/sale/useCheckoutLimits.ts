import { useTranslation } from 'react-i18next';

import type { ApprovalRequest, Approved } from '@/features/approvals/api';
import { useWorkspace } from '@/features/auth/session';
import { useCatalog } from '@/features/catalog/api';
import { useControls } from '@/features/controls/api';
import { formatBps, formatMoney, type Minor } from '@/lib/money';
import { levelOf } from '@/lib/permissions';

import { discountBps, overDiscountLimit, priceChange, type BasketLine } from './basket';

export type CheckoutApprovals = Partial<Record<'discount' | 'price_change', Approved & { amount: number }>>;

/**
 * A discount above the branch's limit or a changed service price (brief B2, B3): the owner freely; a manager with a
 * reason; the front desk (and stylists, for a discount) with a manager's or the owner's PIN. Worked out as create_sale
 * does, so the app asks for exactly what the server will check.
 */
export function useCheckoutLimits(lines: BasketLine[], discount: Minor, subtotal: Minor) {
  const { t } = useTranslation();
  const { business, branch, role } = useWorkspace();
  const controls = useControls(branch.id);
  const catalog = useCatalog(business.id);
  const limitBps = controls.data?.discount_limit_bps ?? 1000;
  const overLimit = overDiscountLimit(discount, subtotal, limitBps);
  const bps = discountBps(discount, subtotal);
  const listPrice = (id: string) => catalog.data?.services.find((s) => s.id === id)?.price_minor;
  const changed = priceChange(lines, listPrice);
  const discountLevel = levelOf(role, 'discount');
  const priceLevel = levelOf(role, 'changePrice');
  const needDiscountReason = overLimit && discountLevel === 'reason';
  const needPriceReason = changed > 0 && priceLevel === 'reason';
  return {
    controls,
    limit: formatBps(limitBps),
    listPrice,
    needDiscountReason,
    needPriceReason,
    /** The discount needs a PIN (shown under the discount). */
    discountNeedsPin: overLimit && discountLevel === 'limit',
    reasonsOk: (discountReason: string, priceReason: string) =>
      (!needDiscountReason || discountReason.trim().length >= 3) && (!needPriceReason || priceReason.trim().length >= 3),
    /** The PINs still missing for the basket as it is now (an approval covers its amount or less). */
    pinsNeeded: (have: CheckoutApprovals): ApprovalRequest[] => [
      ...(overLimit && discountLevel === 'limit' && !((have.discount?.amount ?? -1) >= bps)
        ? [{ action: 'discount' as const, amount: bps, summary: t('approval.discount', { pct: formatBps(bps), limit: formatBps(limitBps) }) }]
        : []),
      ...(changed > 0 && priceLevel === 'pin' && !((have.price_change?.amount ?? -1) >= changed)
        ? [{ action: 'price_change' as const, amount: changed, summary: t('approval.priceChange', { amount: formatMoney(changed) }) }]
        : []),
    ],
  };
}
