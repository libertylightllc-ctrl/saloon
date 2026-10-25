import { Redirect } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useSession } from '@/features/auth/session';
import { usePageMeta } from '@/lib/pageMeta';
import { useIsPlatformAdmin, usePaymentDetails } from '@/features/plan/api';
import { PaymentDetailsSheet } from '@/features/plan/PaymentDetailsSheet';
import { spacing } from '@/theme';
import { Button, HeaderBand, PillTabs, Screen } from '@/ui';

import { AccountsTab } from './AccountsTab';
import { AuditTab } from './AuditTab';
import { BillingTab } from './BillingTab';
import { CardsTab } from './CardsTab';
import { ActivityTab, PlansTab } from './HistoryTabs';
import { OverviewTab } from './OverviewTab';
import { PilotTab } from './PilotTab';
import { SalonsTab } from './SalonsTab';
import { SupportTab } from './SupportTab';
import { useSupportInbox } from '@/features/support/api';

type Tab = 'overview' | 'salons' | 'pilot' | 'settings' | 'support' | 'accounts' | 'plans' | 'cards' | 'activity' | 'audit';
const TABS: Tab[] = ['overview', 'salons', 'pilot', 'settings', 'support', 'accounts', 'plans', 'cards', 'activity', 'audit'];

/**
 * The platform console (owner, 2026-10-06): the whole service in one place for platform owners — even one with no
 * salon of their own. Everyone else is sent home.
 */
export function ConsoleScreen() {
  const { t } = useTranslation();
  // Also at /admin (full update, Phase 6 g); never listed by search engines.
  usePageMeta(t('console.title'), null, { noindex: true });
  const { status } = useSession();
  const admin = useIsPlatformAdmin();
  const payment = usePaymentDetails();
  const inbox = useSupportInbox();
  const unread = (inbox.data ?? []).reduce((n, r) => n + r.unread, 0);
  const [tab, setTab] = useState<Tab>('overview');
  const [paying, setPaying] = useState(false);
  // History of one salon, opened from its row.
  const [salonFilter, setSalonFilter] = useState<{ id: string; name: string } | null>(null);

  if (status === 'signedOut' || status === 'error') return <Redirect href="/welcome" />;
  if (admin.data === false) return <Redirect href="/" />;
  return (
    <>
      <Screen
        width="full"
        header={
          <HeaderBand
            title={t('console.title')}
            subtitle={t('console.subtitle')}
            onBack
            right={
              <Button label={t('admin.pay.button')} icon="creditCard" size="sm" variant="secondary" onPress={() => setPaying(true)} testID="admin-pay" />
            }
          >
            <PillTabs<Tab>
              items={TABS.map((k) => ({
                key: k,
                label: k === 'support' && unread ? `${t('console.tabs.support')} (${unread})` : t(`console.tabs.${k}`),
              }))}
              value={tab}
              onChange={setTab}
              testID="console-tab"
            />
          </HeaderBand>
        }
      >
        <View style={styles.body}>
          {tab === 'overview' ? <OverviewTab /> : null}
          {tab === 'salons' ? (
            <SalonsTab
              onHistory={(salon) => {
                setSalonFilter(salon);
                setTab('activity');
              }}
            />
          ) : null}
          {tab === 'pilot' ? <PilotTab /> : null}
          {tab === 'settings' ? <BillingTab /> : null}
          {tab === 'support' ? <SupportTab /> : null}
          {tab === 'accounts' ? <AccountsTab /> : null}
          {tab === 'plans' ? <PlansTab /> : null}
          {tab === 'cards' ? <CardsTab /> : null}
          {tab === 'activity' ? <ActivityTab salon={salonFilter} onClear={() => setSalonFilter(null)} /> : null}
          {tab === 'audit' ? <AuditTab /> : null}
        </View>
      </Screen>
      <PaymentDetailsSheet open={paying} onClose={() => setPaying(false)} current={payment.data} />
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
});
