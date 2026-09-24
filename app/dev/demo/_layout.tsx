import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { TabBar, type TabBarItem } from '@/ui';

export default function DemoTabsLayout() {
  const { t } = useTranslation();
  const items: Record<string, TabBarItem> = {
    index: { icon: 'home', label: t('tabs.home') },
    queue: { icon: 'users', label: t('tabs.queue') },
    sale: { icon: 'receipt', label: t('tabs.sale'), prominent: true },
    customers: { icon: 'contact', label: t('tabs.customers') },
    more: { icon: 'grid', label: t('tabs.more') },
  };
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} items={items} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="queue" />
      <Tabs.Screen name="sale" />
      <Tabs.Screen name="customers" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}
