import { Tabs } from 'expo-router';

import { useWorkspace } from '@/features/auth/session';
import { useTabItems } from '@/features/nav/navItems';
import { tabsFor, type TabKey } from '@/lib/permissions';
import { TabBar, type TabBarItem } from '@/ui';

export default function TabsLayout() {
  const { role, rules } = useWorkspace();
  const allowed = new Set<TabKey>(tabsFor(role, rules));
  const tabItems = useTabItems();
  const items: Record<TabKey, TabBarItem> = { ...tabItems, sale: { ...tabItems.sale, prominent: true } };
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
