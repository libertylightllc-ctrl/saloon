/**
 * Where people can go, by role: the tabs (phone bottom bar) and the business pages (More on a phone; the sidebar on a
 * computer, the rail on a tablet). One list, so the three never disagree.
 */
import type { Href } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useWorkspace } from '@/features/auth/session';
import { useIsPlatformAdmin } from '@/features/plan/api';
import { can, tabsFor, type TabKey } from '@/lib/permissions';
import type { IconName } from '@/ui';

export interface NavItem {
  key: string;
  icon: IconName;
  href: Href;
  label: string;
}

export type NavSectionKey = 'today' | 'money' | 'business' | 'settings';

const TAB_ICONS: Record<TabKey, IconName> = {
  index: 'home',
  queue: 'users',
  sale: 'receipt',
  customers: 'contact',
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
  return {
    index: { icon: TAB_ICONS.index, label: t('tabs.home') },
    queue: { icon: TAB_ICONS.queue, label: t('tabs.queue') },
    sale: { icon: TAB_ICONS.sale, label: t('tabs.sale') },
    customers: { icon: TAB_ICONS.customers, label: t('tabs.customers') },
    pay: { icon: TAB_ICONS.pay, label: t('tabs.pay') },
    'reports-tab': { icon: TAB_ICONS['reports-tab'], label: t('tabs.reportsTab') },
    'accounts-tab': { icon: TAB_ICONS['accounts-tab'], label: t('tabs.accountsTab') },
    more: { icon: TAB_ICONS.more, label: t('tabs.more') },
  };
}

/** The business pages this person may open, in More's order, with the section the sidebar shows them in. */
export function useBusinessRows() {
  const { role } = useWorkspace();
  const platformAdmin = useIsPlatformAdmin();
  const rows = [
    { key: 'services', icon: 'scissors', href: '/services', show: can(role, 'viewServices'), section: 'business' },
    { key: 'inventory', icon: 'boxes', href: '/inventory', show: can(role, 'viewInventory'), section: 'business' },
    { key: 'sales', icon: 'receipt', href: '/sales', show: can(role, 'viewSales'), section: 'money' },
    { key: 'expenses', icon: 'coins', href: '/expenses', show: can(role, 'viewExpenses'), section: 'money' },
    { key: 'purchases', icon: 'truck', href: '/purchases', show: can(role, 'viewPurchases'), section: 'money' },
    { key: 'cashClosing', icon: 'banknote', href: '/cash-closing', show: can(role, 'viewClosing'), section: 'money' },
    { key: 'accounts', icon: 'calculator', href: '/accounts', show: can(role, 'viewAccounting'), section: 'money' },
    { key: 'reports', icon: 'chart', href: '/reports', show: can(role, 'viewReports'), section: 'business' },
    { key: 'staff', icon: 'users', href: '/staff', show: can(role, 'viewStaff'), section: 'business' },
    { key: 'attendance', icon: 'clock', href: '/attendance', show: can(role, 'viewAttendance'), section: 'business' },
    { key: 'compliance', icon: 'shield', href: '/compliance', show: can(role, 'viewCompliance'), section: 'business' },
    { key: 'branch', icon: 'store', href: '/settings/branch', show: can(role, 'manageBranch'), section: 'settings' },
    { key: 'backup', icon: 'archive', href: '/settings/backup', show: can(role, 'backup'), section: 'settings' },
    { key: 'plan', icon: 'creditCard', href: '/plan', show: can(role, 'viewPlan'), section: 'settings' },
    { key: 'admin', icon: 'building', href: '/admin', show: platformAdmin.data === true, section: 'settings' },
  ] as const;
  return rows.filter((r) => r.show);
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
  const tabs = tabsFor(role, rules).filter((k) => k !== 'more');
  const duplicate = new Set<string>([
    ...(tabs.includes('reports-tab') ? ['reports'] : []),
    ...(tabs.includes('accounts-tab') ? ['accounts'] : []),
  ]);
  const today: NavItem[] = tabs.map((k) => ({ key: k, icon: tabItems[k].icon, href: tabPath(k) as Href, label: tabItems[k].label }));
  const section = (key: NavSectionKey): NavItem[] =>
    rows
      .filter((r) => r.section === key && !duplicate.has(r.key))
      .map((r) => ({ key: r.key, icon: r.icon, href: r.href, label: t(`more.rows.${r.key}`) }));
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
