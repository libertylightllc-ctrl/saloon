/**
 * What a refund took back from one stylist (owner's app check E7), worked out as payroll does (commission_for and
 * pay_extras): the commission on their lines in the refunded part without the tip, and the tip's share when the tip
 * was theirs. The figures are shown on their own sale, read only.
 */
export interface RefundEffect {
  commission_minor: number;
  /** Null when the sale's tip is not theirs (or there was none). */
  tip_minor: number | null;
}

interface SaleForEffect {
  total_minor: number;
  tip_minor: number;
  tip_employee_id: string | null;
  sale_lines: { employee_id: string | null; commission_minor: number }[];
}

export function refundEffect(
  sale: SaleForEffect,
  refund: { amount_minor: number; tip_minor: number },
  employeeId: string,
): RefundEffect {
  const mine = sale.sale_lines.filter((l) => l.employee_id === employeeId).reduce((n, l) => n + l.commission_minor, 0);
  const base = sale.total_minor - sale.tip_minor;
  const commission = base > 0 ? Math.round((mine * (refund.amount_minor - refund.tip_minor)) / base) : 0;
  return {
    commission_minor: commission,
    tip_minor: sale.tip_minor > 0 && sale.tip_employee_id === employeeId ? refund.tip_minor : null,
  };
}
