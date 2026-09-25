import { formatInTimeZone } from 'date-fns-tz';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { can } from '@/lib/permissions';
import { spacing } from '@/theme';
import { Avatar, Button, EmptyState, HeaderBand, ListRow, QueryState, Screen, SearchBar, StatusPill } from '@/ui';

import { useCustomers } from './api';

export function CustomersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { business, role } = useWorkspace();
  const [search, setSearch] = useState('');
  const query = useCustomers(business.id, search);
  const canAdd = can(role, 'manageCustomers');

  return (
    <Screen
      insetBottom={false}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      header={
        <HeaderBand
          title={t('tabs.customers')}
          subtitle={t('customers.subtitle')}
          right={
            canAdd ? (
              <Button
                label={t('customers.new')}
                icon="plus"
                size="sm"
                variant="secondary"
                onPress={() => router.push('/customers/form')}
                testID="customers-new"
              />
            ) : undefined
          }
        >
          <SearchBar value={search} onChangeText={setSearch} placeholder={t('customers.search')} testID="customers-search" />
        </HeaderBand>
      }
    >
      <QueryState
        query={query}
        isEmpty={(data) => data.length === 0}
        empty={
          <EmptyState
            illustration={search ? 'no-results' : 'customers-empty'}
            message={search ? t('customers.noMatch') : t('customers.empty')}
            actionLabel={canAdd ? t('customers.add') : undefined}
            onAction={() => router.push('/customers/form')}
          />
        }
      >
        {(data) => (
          <View style={styles.list}>
            {data.map((c) => (
              <ListRow
                key={c.id}
                title={c.name}
                leading={<Avatar name={c.name} size={44} />}
                meta={[
                  t('customers.visitsLine', {
                    n: c.visit_count,
                    last: c.last_visit_at ? formatInTimeZone(new Date(c.last_visit_at), business.timezone, 'd MMM') : '—',
                  }),
                  ...(c.preferences ? [c.preferences] : []),
                ]}
                badges={
                  c.risk_flags.length > 0 || c.no_show_count > 0 ? (
                    <>
                      {c.risk_flags.map((f) => (
                        <StatusPill key={f} tone={f === 'no_show' ? 'error' : 'warning'} label={t(`customers.risk.${f}` as 'customers.risk.allergy')} />
                      ))}
                      {c.no_show_count > 0 && !c.risk_flags.includes('no_show') ? (
                        <StatusPill tone="error" label={t('customers.noShows', { n: c.no_show_count })} />
                      ) : null}
                    </>
                  ) : undefined
                }
                chevron
                onPress={() => router.push({ pathname: '/customers/[id]', params: { id: c.id } })}
                testID={`customer-${c.name}`}
              />
            ))}
          </View>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({ list: { gap: spacing.md } });
