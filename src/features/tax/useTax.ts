import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useWorkspace } from '@/features/auth/session';
import type { TaxRule } from '@/features/sale/basket';
import { isUae } from '@/lib/countries';
import { formatBps } from '@/lib/money';

/**
 * The branch's sales tax: VAT 5% included in prices in the UAE, GST 10% included in Australia, sales tax added at the
 * till in the US… `rule` is what checkout charges (null when the branch charges none).
 */
export function useTax() {
  const { t } = useTranslation();
  const { business, branch } = useWorkspace();
  return useMemo(() => {
    const on = branch.vat_mode === 'on';
    const rule: TaxRule | null = on && branch.tax_rate_bps > 0 ? { rateBps: branch.tax_rate_bps, inclusive: branch.tax_inclusive } : null;
    return {
      on,
      rule,
      rateBps: branch.tax_rate_bps,
      inclusive: branch.tax_inclusive,
      /** "VAT 5%", "Sales tax 8.875%". */
      label: `${t('tax.name')} ${formatBps(branch.tax_rate_bps)}`,
      number: branch.trn,
      /** The UAE's 15-digit TRN; elsewhere any tax number. */
      uae: isUae(business.country_code),
    };
  }, [t, business.country_code, branch.vat_mode, branch.tax_rate_bps, branch.tax_inclusive, branch.trn]);
}
