/**
 * The receipt behind a WhatsApp receipt link (saloqo.com/r/<token>; owner, 2026-10-19): the customer sees the receipt
 * as printed and downloads it as a PDF. Open to anyone with the link, signed in or not; in the reader's language, with
 * the salon's own currency and tax words.
 */
import { useQuery } from '@tanstack/react-query';
import { createElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { isCurrency } from '@/lib/currencies';
import { isLanguage, isRtlLanguage, taxDisplayName } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { spacing, useTheme } from '@/theme';
import { Button, EmptyState, HeaderBand, QueryState, Screen } from '@/ui';

import { receiptHtml, shareReceipt, type ReceiptSale } from './receipt';
import { saudiReceiptQr, sellerLines } from './seller';
import { receiptLabels } from './useReceipt';

interface ReceiptLink {
  sale: ReceiptSale & { tax_inclusive: boolean; tax_rate_bps: number; tax2_name: string | null; tax2_rate_bps: number };
  seller: {
    business_name: string;
    country_code: string;
    currency: string;
    timezone: string;
    branch_name: string;
    address: string | null;
    phone: string | null;
    trn: string | null;
    tax_name: string;
    tax_id_label: string;
    legal_name: string | null;
    licence_label: string | null;
    licence_number: string | null;
  };
}

export function ReceiptLinkScreen({ token }: { token: string }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const receipt = useQuery({
    queryKey: ['receipt-link', token],
    queryFn: async (): Promise<ReceiptLink | null> => {
      if (!/^[A-Za-z0-9_-]{24}$/.test(token)) return null;
      const { data, error } = await supabase.rpc('public_receipt', { p_token: token });
      if (error) throw error;
      return (data as unknown as ReceiptLink | null) ?? null;
    },
  });

  const html = (r: ReceiptLink) => {
    const s = r.seller;
    const business = { name: s.business_name, country_code: s.country_code, currency: s.currency };
    const branch = { legal_name: s.legal_name, licence_label: s.licence_label, licence_number: s.licence_number, trn: s.trn };
    return receiptHtml(r.sale, {
      businessName: s.business_name,
      branchName: s.branch_name,
      address: s.address,
      phone: s.phone,
      trn: s.trn,
      ...sellerLines({ business, branch }),
      qr: saudiReceiptQr({ business, branch }, r.sale),
      currency: isCurrency(s.currency) ? s.currency : undefined,
      timeZone: s.timezone,
      language: i18n.language,
      rtl: isLanguage(i18n.language) && isRtlLanguage(i18n.language),
      ink: theme.colors.text,
      muted: theme.colors.textSecondary,
      line: theme.colors.divider,
      labels: receiptLabels(t, r.sale, {
        tax: taxDisplayName(s.tax_name),
        taxId: s.tax_id_label === 'TRN' ? t('tax.trn') : s.tax_id_label,
      }),
    });
  };

  return (
    <Screen header={<HeaderBand title={t('receipt.receipt')} />}>
      <QueryState query={receipt}>
        {(r) =>
          r ? (
            <View style={styles.body}>
              {/* The receipt exactly as its PDF (the web page; the phone apps open these links in the browser). */}
              {Platform.OS === 'web'
                ? createElement('iframe', {
                    srcDoc: html(r),
                    title: t('receipt.receipt'),
                    'data-receipt-view': 'true',
                    style: { width: '100%', height: 640, border: 0, borderRadius: 12, background: theme.colors.surface },
                  })
                : null}
              <Button label={t('receipt.download')} icon="download" onPress={() => void shareReceipt(html(r), t('receipt.download'))} testID="receipt-download" />
            </View>
          ) : (
            <EmptyState illustration="no-results" message={t('receipt.notFound')} />
          )
        }
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
});
