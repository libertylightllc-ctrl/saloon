import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useWorkspace } from '@/features/auth/session';
import type { TaxRule } from '@/features/sale/basket';
import { isUae } from '@/lib/countries';
import { taxDisplayName } from '@/lib/i18n';
import { formatBps } from '@/lib/money';

/**
 * The branch's sales tax: VAT 5% included in prices in the UAE, GST 10% included in Australia, sales tax added at the
 * till in the US, GST 5% + PST 7% in British Columbia… `rule` is what checkout charges (null when the branch charges
 * none).
 */
export function useTax() {
  const { t } = useTranslation();
  const { business, branch } = useWorkspace();
  return useMemo(() => {
    const on = branch.vat_mode === 'on';
    const rate2 = branch.tax2_rate_bps > 0 && branch.tax2_name ? branch.tax2_rate_bps : 0;
    const rule: TaxRule | null =
      on && branch.tax_rate_bps + rate2 > 0 ? { rateBps: branch.tax_rate_bps, inclusive: branch.tax_inclusive, rate2Bps: rate2 } : null;
    return {
      on,
      rule,
      rateBps: branch.tax_rate_bps,
      inclusive: branch.tax_inclusive,
      /** "VAT 5%", "Sales tax 8.875%". */
      label: `${t('tax.name')} ${formatBps(branch.tax_rate_bps)}`,
      /** The second tax beside it (Canada's PST, RST or QST): "PST 7%". */
      second: rate2 && branch.tax2_name ? { label: `${taxDisplayName(branch.tax2_name)} ${formatBps(rate2)}` } : null,
      number: branch.trn,
      /** The UAE's 15-digit TRN; elsewhere any tax number. */
      uae: isUae(business.country_code),
    };
  }, [t, business.country_code, branch.vat_mode, branch.tax_rate_bps, branch.tax_inclusive, branch.trn, branch.tax2_name, branch.tax2_rate_bps]);
}
