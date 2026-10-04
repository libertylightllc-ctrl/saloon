/**
 * Receipt mode "WhatsApp": the receipt as a WhatsApp message to the customer's number (wa.me opens WhatsApp
 * with the text filled in; the cashier presses send). No number → WhatsApp asks whom to send it to.
 */
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { dialCodeOf } from '@/lib/countries';
import { formatBps } from '@/lib/money';
import { supabase } from '@/lib/supabase';

import { SALE_WITH_STAFF, type SaleDetail } from './api';
import { receiptText, waNumber } from './whatsappText';

export function useWhatsAppReceipt() {
  const { t, i18n } = useTranslation();
  const { business, branch } = useWorkspace();
  return useMutation({
    mutationFn: async (saleId: string) => {
      const { data, error } = await supabase
        .from('sales')
        .select(`${SALE_WITH_STAFF}, customers(phone)`)
        .eq('id', saleId)
        .single();
      if (error) throw error;
      const sale = data as unknown as SaleDetail & { customers: { phone: string | null } | null };
      const text = receiptText(
        sale,
        { businessName: business.name, branchName: branch.name, timeZone: business.timezone, language: i18n.language, trn: sale.vat_mode === 'on' ? branch.trn : null },
        {
          title: t(sale.vat_mode === 'on' ? 'receipt.taxInvoice' : 'receipt.receipt'),
          sale: t('receipt.sale'),
          staff: t('receipt.staff'),
          vat: t(sale.tax_inclusive ? 'receipt.vatIncluded' : 'receipt.vatAdded', { rate: formatBps(sale.tax_rate_bps) }),
          tip: t('sale.tip'),
          total: t('receipt.total'),
          paid: t('receipt.paid'),
          refunded: t('receipt.refunded'),
          trn: t('receipt.trn'),
          thanks: t('receipt.thanks'),
          methods: { cash: t('sale.methods.cash'), card: t('sale.methods.card'), wallet: t('sale.methods.wallet') },
        },
      );
      const to = waNumber(sale.customers?.phone, dialCodeOf(business.country_code));
      await Linking.openURL(`https://wa.me/${to}?text=${encodeURIComponent(text)}`);
    },
  });
}
