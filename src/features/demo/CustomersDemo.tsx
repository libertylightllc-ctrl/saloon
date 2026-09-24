import { useTranslation } from 'react-i18next';

import { EmptyState, HeaderBand, Screen, SearchBar, useToast } from '@/ui';

export function CustomersDemo() {
  const { t } = useTranslation();
  const toast = useToast();
  return (
    <Screen
      insetBottom={false}
      header={
        <HeaderBand title={t('tabs.customers')} subtitle={t('customers.subtitle')}>
          <SearchBar placeholder={t('customers.search')} />
        </HeaderBand>
      }
    >
      <EmptyState
        illustration="customers-empty"
        message={t('customers.empty')}
        actionLabel={t('customers.add')}
        onAction={() => toast(t('dev.laterPhase'), 'info')}
      />
    </Screen>
  );
}
