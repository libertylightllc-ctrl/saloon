import { useTranslation } from 'react-i18next';

const SYSTEM_ACCOUNTS = [
  'cash', 'card_clearing', 'wallet_clearing', 'bank', 'inventory', 'staff_advances', 'supplier_payable',
  'deposits_held', 'tips_payable', 'salaries_payable', 'vat_payable', 'owner_equity', 'owner_drawings',
  'service_revenue', 'product_revenue', 'other_income', 'consumables_used', 'cost_of_goods_sold',
  'salaries_expense', 'commission_expense', 'cash_over_short', 'supplies_expense',
] as const;
const SOURCES = ['sale', 'refund', 'deposit', 'deposit_refund', 'deposit_forfeit', 'opening_cash', 'opening_stock', 'brought_forward'] as const;

/** System account and journal source names in the app language; the owner's own accounts keep their name. */
export function useLedgerLabels() {
  const { t } = useTranslation();
  return {
    account: (a: { system_key: string | null; name: string }) =>
      a.system_key && (SYSTEM_ACCOUNTS as readonly string[]).includes(a.system_key)
        ? t(`accounts.names.${a.system_key as (typeof SYSTEM_ACCOUNTS)[number]}`)
        : a.name,
    source: (kind: string) =>
      (SOURCES as readonly string[]).includes(kind) ? t(`accounts.sources.${kind as (typeof SOURCES)[number]}`) : kind,
  };
}
