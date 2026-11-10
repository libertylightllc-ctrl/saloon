/**
 * Where people can go, by role: the tabs (phone bottom bar) and the business pages (More on a phone; the sidebar on a
 * computer, the rail on a tablet). One list, so the three never disagree.
 */
import type { Href } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useWorkspace } from '@/features/auth/session';
import { useNewPilotApplications } from '@/features/console/api';
import { useIsPlatformAdmin } from '@/features/plan/api';
import { can, levelOf, tabsFor, type TabKey } from '@/lib/permissions';
import type { IconName } from '@/ui';

export interface NavItem {
  key: string;
  icon: IconName;
  href: Href;
  label: string;
  /** Something waiting there (a red count); `label` is what a screen reader says. */
  badge?: { count: number; label: string };
}

/**
 * The counts on business rows, by row key: "Platform console" shows the pilot applications still New (owner's fix
 * list A1; platform owners only).
 */
export function useNavBadges(): Partial<Record<string, { count: number; label: string }>> {
  const { t } = useTranslation();
  const pilot = useNewPilotApplications();
  return pilot > 0 ? { admin: { count: pilot, label: t('console.pilot.newCount', { count: pilot }) } } : {};
}

export type NavSectionKey = 'today' | 'money' | 'business' | 'settings';

const TAB_ICONS: Record<TabKey, IconName> = {
  index: 'home',
  queue: 'users',
  sale: 'receipt',
  customers: 'contact',
  'closing-tab': 'banknote',
  pay: 'wallet',
  'reports-tab': 'chart',
  'accounts-tab': 'calculator',
  more: 'grid',
};

export function tabPath(key: TabKey): string {
  return key === 'index' ? '/' : `/${key}`;
}

/** The tab bar's items (label and icon) for every tab key. */
export function useTabItems(): Record<TabKey, { icon: IconName; label: string }> {
  const { t } = useTranslation();
  const { role } = useWorkspace();
  return {
    index: { icon: TAB_ICONS.index, label: t('tabs.home') },
    // A stylist's queue is their own bookings (brief B8).
    queue: { icon: TAB_ICONS.queue, label: role === 'staff' ? t('tabs.myBookings') : t('tabs.queue') },
    sale: { icon: TAB_ICONS.sale, label: t('tabs.sale') },
    customers: { icon: TAB_ICONS.customers, label: t('tabs.customers') },
    'closing-tab': { icon: TAB_ICONS['closing-tab'], label: t('nav.short.cashClosing') },
    pay: { icon: TAB_ICONS.pay, label: t('tabs.pay') },
    'reports-tab': { icon: TAB_ICONS['reports-tab'], label: t('tabs.reportsTab') },
    'accounts-tab': { icon: TAB_ICONS['accounts-tab'], label: t('tabs.accountsTab') },
    more: { icon: TAB_ICONS.more, label: t('tabs.more') },
  };
}

/** A row's words, by login type where the brief names the page differently (B8). */
type RowLabel = `more.rows.${'myClients' | 'services' | 'inventory' | 'stock' | 'sales' | 'mySales' | 'expenses' | 'pettyCash' | 'purchases' | 'suppliersBills' | 'cashClosing' | 'accounts' | 'reports' | 'staff' | 'attendance' | 'payroll' | 'compliance' | 'hygiene' | 'branch' | 'branches' | 'backup' | 'plan' | 'admin'}`;

/** The business pages this person may open, in More's order, with the section the sidebar shows them in. */
export function useBusinessRows() {
  const { t } = useTranslation();
  const { role, rules } = useWorkspace();
  const platformAdmin = useIsPlatformAdmin();
  const floor = role === 'cashier' || role === 'staff';
  const rows: { key: string; icon: IconName; href: Href; show: boolean; section: NavSectionKey; label: RowLabel }[] = [
    // A stylist has no Customers tab: their own clients are here.
    { key: 'myClients', icon: 'contact', href: '/customers/mine', show: levelOf(role, 'viewCustomers') === 'own', section: 'business', label: 'more.rows.myClients' },
    { key: 'services', icon: 'scissors', href: '/services', show: can(role, 'viewServices'), section: 'business', label: 'more.rows.services' },
    { key: 'inventory', icon: 'boxes', href: '/inventory', show: can(role, 'viewInventory'), section: 'business', label: floor ? 'more.rows.stock' : 'more.rows.inventory' },
    { key: role === 'staff' ? 'mySales' : 'sales', icon: 'receipt', href: '/sales', show: can(role, 'viewSales', rules), section: 'money', label: role === 'staff' ? 'more.rows.mySales' : 'more.rows.sales' },
    // The front desk sees only the petty cash they paid from the drawer.
    { key: 'expenses', icon: 'coins', href: '/expenses', show: can(role, 'viewExpenses'), section: 'money', label: role === 'cashier' ? 'more.rows.pettyCash' : 'more.rows.expenses' },
    { key: 'purchases', icon: 'truck', href: '/purchases', show: can(role, 'viewPurchases'), section: 'money', label: role === 'owner' ? 'more.rows.purchases' : 'more.rows.suppliersBills' },
    { key: 'cashClosing', icon: 'banknote', href: '/cash-closing', show: can(role, 'viewClosing'), section: 'money', label: 'more.rows.cashClosing' },
    { key: 'accounts', icon: 'calculator', href: '/accounts', show: can(role, 'viewAccounting'), section: 'money', label: 'more.rows.accounts' },
    { key: 'payroll', icon: 'wallet', href: '/payroll', show: can(role, 'runPayroll'), section: 'money', label: 'more.rows.payroll' },
    { key: 'reports', icon: 'chart', href: '/reports', show: can(role, 'viewReports') && role !== 'staff', section: 'business', label: 'more.rows.reports' },
    { key: 'staff', icon: 'users', href: '/staff', show: can(role, 'viewStaff'), section: 'business', label: 'more.rows.staff' },
    { key: 'attendance', icon: 'clock', href: '/attendance', show: can(role, 'viewAttendance'), section: 'business', label: 'more.rows.attendance' },
    { key: 'compliance', icon: 'shield', href: '/compliance', show: can(role, 'viewCompliance'), section: 'business', label: 'more.rows.compliance' },
    // Those who sign the hygiene log but keep no records open the log on its own.
    { key: 'hygiene', icon: 'sparkles', href: { pathname: '/compliance', params: { tab: 'hygiene' } }, show: can(role, 'signHygiene') && !can(role, 'viewCompliance'), section: 'business', label: 'more.rows.hygiene' },
    { key: 'branch', icon: 'store', href: '/settings/branch', show: can(role, 'manageBranch'), section: 'settings', label: 'more.rows.branch' },
    { key: 'branches', icon: 'mapPin', href: '/settings/branches', show: can(role, 'manageBranch'), section: 'settings', label: 'more.rows.branches' },
    { key: 'backup', icon: 'archive', href: '/settings/backup', show: can(role, 'backup'), section: 'settings', label: 'more.rows.backup' },
    { key: 'plan', icon: 'creditCard', href: '/plan', show: can(role, 'viewPlan'), section: 'settings', label: 'more.rows.plan' },
    { key: 'admin', icon: 'building', href: '/console', show: platformAdmin.data === true, section: 'settings', label: 'more.rows.admin' },
  ];
  const shown = rows.filter((r) => r.show).map((r) => ({ ...r, label: t(r.label) }));
  // The manager's Reports is not a phone tab (Closing is): it leads More.
  return role === 'manager' ? [...shown.filter((r) => r.key === 'reports'), ...shown.filter((r) => r.key !== 'reports')] : shown;
}

/**
 * The sidebar: the day's tabs first, then money, business and settings pages. A page that is already a tab for this
 * role (an accountant's Reports and Accounting) is listed once.
 */
export function useNavSections(): { key: NavSectionKey; title: string; items: NavItem[] }[] {
  const { t } = useTranslation();
  const { role, rules } = useWorkspace();
  const tabItems = useTabItems();
  const rows = useBusinessRows();
  const badges = useNavBadges();
  const tabs = tabsFor(role, rules).filter((k) => k !== 'more');
  const duplicate = new Set<string>([
    ...(tabs.includes('reports-tab') ? ['reports'] : []),
    ...(tabs.includes('accounts-tab') ? ['accounts'] : []),
    ...(tabs.includes('closing-tab') ? ['cashClosing'] : []),
  ]);
  const today: NavItem[] = tabs.map((k) => ({ key: k, icon: tabItems[k].icon, href: tabPath(k) as Href, label: tabItems[k].label }));
  const section = (key: NavSectionKey): NavItem[] =>
    rows
      .filter((r) => r.section === key && !duplicate.has(r.key))
      .map((r) => ({ key: r.key, icon: r.icon, href: r.href, label: r.label, badge: badges[r.key] }));
  return [
    { key: 'today' as const, title: t('nav.today'), items: today },
    { key: 'money' as const, title: t('nav.money'), items: section('money') },
    { key: 'business' as const, title: t('nav.business'), items: section('business') },
    { key: 'settings' as const, title: t('nav.settings'), items: section('settings') },
  ].filter((s) => s.items.length > 0);
}

/** The item for the page on screen: the longest path that matches ("/sales/42" → Sales; "/" only for Home). */
export function activeKey(pathname: string, items: NavItem[]): string | null {
  let best: { key: string; length: number } | null = null;
  for (const item of items) {
    const path = typeof item.href === 'string' ? item.href : String(item.href.pathname);
    const hit = path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`);
    if (hit && (!best || path.length > best.length)) best = { key: item.key, length: path.length };
  }
  return best?.key ?? null;
}
