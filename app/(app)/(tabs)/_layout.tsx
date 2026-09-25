import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useWorkspace } from '@/features/auth/session';
import { tabsFor, type TabKey } from '@/lib/permissions';
import { TabBar, type TabBarItem } from '@/ui';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { role, rules } = useWorkspace();
  const allowed = new Set<TabKey>(tabsFor(role, rules));
  const items: Record<TabKey, TabBarItem> = {
    index: { icon: 'home', label: t('tabs.home') },
    queue: { icon: 'users', label: t('tabs.queue') },
    sale: { icon: 'receipt', label: t('tabs.sale'), prominent: true },
    customers: { icon: 'contact', label: t('tabs.customers') },
    more: { icon: 'grid', label: t('tabs.more') },
  };
  const visible = Object.fromEntries(Object.entries(items).filter(([key]) => allowed.has(key as TabKey)));
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} items={visible} />}>
      {(Object.keys(items) as TabKey[]).map((name) => (
        // Tabs the role may not use are removed from the bar and from linking.
        <Tabs.Screen key={name} name={name} options={{ href: allowed.has(name) ? undefined : null }} />
      ))}
    </Tabs>
  );
}
