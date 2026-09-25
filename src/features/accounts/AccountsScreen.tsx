import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useQueryClient } from '@tanstack/react-query';

import { useWorkspace } from '@/features/auth/session';
import { HeaderBand, Screen, SegmentTabs } from '@/ui';

import { HistoryTab } from './HistoryTab';
import { JournalTab } from './JournalTab';
import { OverviewTab } from './OverviewTab';
import { TrialBalanceTab } from './TrialBalanceTab';

type Tab = 'overview' | 'journal' | 'balance' | 'history';
const TABS: Tab[] = ['overview', 'journal', 'balance', 'history'];

/** Owner and accountant: the calculations behind the numbers, the books and the history. Read-only. */
export function AccountsScreen() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const { business, branch } = useWorkspace();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(TABS.includes(params.tab as Tab) ? (params.tab as Tab) : 'overview');
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([
      client.invalidateQueries({ queryKey: ['accounts', business.id] }),
      client.invalidateQueries({ queryKey: ['dashboard', branch.id] }),
    ]);
    setRefreshing(false);
  };

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      header={
        <HeaderBand title={t('accounts.title')} subtitle={t('accounts.subtitle')} onBack>
          <SegmentTabs<Tab>
            items={TABS.map((key) => ({ key, label: t(`accounts.tabs.${key}`) }))}
            value={tab}
            onChange={setTab}
            testID="accounts-tab"
          />
        </HeaderBand>
      }
    >
      {tab === 'overview' ? <OverviewTab /> : null}
      {tab === 'journal' ? <JournalTab /> : null}
      {tab === 'balance' ? <TrialBalanceTab /> : null}
      {tab === 'history' ? <HistoryTab /> : null}
    </Screen>
  );
}
