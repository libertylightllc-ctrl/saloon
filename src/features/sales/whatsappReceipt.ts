/**
 * Receipt mode "WhatsApp": the receipt as a WhatsApp message to the customer's number (wa.me opens WhatsApp
 * with the text filled in; the cashier presses send). No number → WhatsApp asks whom to send it to.
 */
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { brand } from '@/config/brand';
import { dialCodeOf } from '@/lib/countries';
import { supabase } from '@/lib/supabase';

import { SALE_WITH_STAFF, type SaleDetail } from './api';
import { sellerLines } from './seller';
import { receiptLabels } from './useReceipt';
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
        {
          businessName: business.name,
          branchName: branch.name,
          timeZone: business.timezone,
          language: i18n.language,
          trn: sale.vat_mode === 'on' ? branch.trn : null,
          ...sellerLines({ business, branch }),
          link: `${brand.website}/r/${sale.receipt_token}`,
        },
        { ...receiptLabels(t, sale), pdf: t('receipt.pdfLine') },
      );
      const to = waNumber(sale.customers?.phone, dialCodeOf(business.country_code));
      await Linking.openURL(`https://wa.me/${to}?text=${encodeURIComponent(text)}`);
    },
  });
}
