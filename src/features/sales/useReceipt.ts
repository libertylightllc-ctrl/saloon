import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useWorkspace } from '@/features/auth/session';
import { isLanguage, isRtlLanguage } from '@/lib/i18n';
import { formatBps } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

import { SALE_WITH_STAFF, type SaleDetail } from './api';
import { receiptHtml, shareReceipt } from './receipt';

/** Loads the sale and shares (phones) or prints (web) its receipt. */
export function useShareReceipt() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { business, branch } = useWorkspace();
  return useMutation({
    mutationFn: async (saleId: string) => {
      const { data, error } = await supabase
        .from('sales')
        .select(SALE_WITH_STAFF)
        .eq('id', saleId)
        .single();
      if (error) throw error;
      const sale = data as unknown as SaleDetail;
      const html = receiptHtml(sale, {
        businessName: business.name,
        branchName: branch.name,
        address: branch.address,
        phone: branch.phone,
        trn: sale.vat_mode === 'on' ? branch.trn : null,
        timeZone: business.timezone,
        language: i18n.language,
        rtl: isLanguage(i18n.language) && isRtlLanguage(i18n.language),
        ink: theme.colors.text,
        muted: theme.colors.textSecondary,
        line: theme.colors.divider,
        labels: {
          title: t(sale.vat_mode === 'on' ? 'receipt.taxInvoice' : 'receipt.receipt'),
          sale: t('receipt.sale'),
          customer: t('sale.customer'),
          staff: t('receipt.staff'),
          subtotal: t('sale.subtotal'),
          discount: t('sale.discount'),
          vat: t(sale.tax_inclusive ? 'receipt.vatIncluded' : 'receipt.vatAdded', { rate: formatBps(sale.tax_rate_bps) }),
          tip: t('sale.tip'),
          deposit: t('receipt.deposit'),
          total: t('receipt.total'),
          paid: t('receipt.paid'),
          refunded: t('receipt.refunded'),
          trn: t('receipt.trn'),
          thanks: t('receipt.thanks'),
          methods: { cash: t('sale.methods.cash'), card: t('sale.methods.card'), wallet: t('sale.methods.wallet') },
        },
      });
      await shareReceipt(html, t('sale.shareReceipt'));
    },
  });
}
