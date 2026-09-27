import type { Href } from 'expo-router';

/** Where tapping a notification (in the list or a push) takes you. */
export function notificationHref(n: { type: string; entity_type: string | null; entity_id: string | null; data: Record<string, unknown> }): Href {
  switch (n.entity_type) {
    case 'appointment':
      return '/queue';
    case 'cash_closing':
      return typeof n.data.date === 'string' ? { pathname: '/cash-closing/[date]', params: { date: n.data.date } } : '/cash-closing';
    case 'inventory_item':
      return n.entity_id ? { pathname: '/inventory/[id]', params: { id: n.entity_id } } : '/inventory';
    case 'payroll_run':
      return '/payroll';
    case 'sale':
      return n.entity_id ? { pathname: '/sales/[id]', params: { id: n.entity_id } } : '/sales';
    case 'compliance_document':
      return '/compliance';
    default:
      return '/';
  }
}
