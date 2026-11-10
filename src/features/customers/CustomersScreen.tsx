import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { can, levelOf } from '@/lib/permissions';
import { useDates } from '@/lib/useDates';
import { spacing, useTheme } from '@/theme';
import { Avatar, Button, EmptyState, FormError, HeaderBand, ListRow, Screen, SearchBar, Skeleton, StatusPill } from '@/ui';

import { useMyClients, type ListCustomer } from './api';
import { useCustomerPages } from './pages';

/**
 * Customers, most recent visit first. Only the rows on screen are drawn; more load as you scroll. A stylist sees "My
 * clients" (More → My clients): customers they served or are booked with, phone numbers only when the owner allows.
 */
export function CustomersScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const dates = useDates();
  const router = useRouter();
  const { business, branch, role, rules } = useWorkspace();
  const [search, setSearch] = useState('');
  const own = levelOf(role, 'viewCustomers') === 'own';
  const pages = useCustomerPages(business.id, search, !own);
  const mine = useMyClients(business.id, branch.id, search, own);
  const query = own ? mine : pages;
  const canAdd = can(role, 'manageCustomers');
  const rows = useMemo<ListCustomer[]>(() => (own ? (mine.data ?? []) : (pages.data?.pages.flat() ?? [])), [own, mine.data, pages.data]);
  const fetchingMore = !own && pages.isFetchingNextPage;

  const renderItem = ({ item: c }: { item: ListCustomer }) => (
    <ListRow
      title={c.name}
      leading={<Avatar name={c.name} size={44} />}
      meta={[
        t('customers.visitsLine', {
          count: c.visit_count,
          last: c.last_visit_at ? dates.at(new Date(c.last_visit_at), business.timezone, 'd MMM') : '—',
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
              <StatusPill tone="error" label={t('customers.noShows', { count: c.no_show_count })} />
            ) : null}
          </>
        ) : undefined
      }
      chevron
      onPress={() => router.push({ pathname: '/customers/[id]', params: { id: c.id } })}
      testID={`customer-${c.name}`}
    />
  );

  return (
    <Screen
      scroll={false}
      insetBottom={false}
      header={
        <HeaderBand
          title={t(own ? 'customers.mine' : 'tabs.customers')}
          subtitle={t(own ? 'customers.mineSubtitle' : 'customers.subtitle')}
          onBack={own ? true : undefined}
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
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder={t(own && !can(role, 'customerContacts', rules) ? 'customers.searchName' : 'customers.search')}
            testID="customers-search"
          />
        </HeaderBand>
      }
    >
      {query.isPending ? (
        <View style={styles.loading}>
          <Skeleton height={72} />
          <Skeleton height={72} />
          <Skeleton height={72} />
        </View>
      ) : query.isError && rows.length === 0 ? (
        <View style={styles.loading}>
          <FormError error={query.error} />
          <Button label={t('common.retry')} variant="outline" onPress={() => void query.refetch()} />
        </View>
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          ItemSeparatorComponent={Gap}
          contentContainerStyle={styles.list}
          refreshing={query.isRefetching && !fetchingMore}
          onRefresh={() => void query.refetch()}
          onEndReached={() => {
            if (!own && pages.hasNextPage && !pages.isFetchingNextPage && !pages.isFetchNextPageError) void pages.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <EmptyState
              illustration={search ? 'no-results' : 'customers-empty'}
              message={search ? t('customers.noMatch') : t(own ? 'customers.mineEmpty' : 'customers.empty')}
              actionLabel={canAdd ? t('customers.add') : undefined}
              onAction={() => router.push('/customers/form')}
            />
          }
          ListFooterComponent={
            fetchingMore ? (
              <ActivityIndicator color={theme.colors.primary500} style={styles.more} />
            ) : !own && pages.isFetchNextPageError ? (
              // A page that failed to load keeps what is shown; this retries just that page.
              <View style={styles.loading}>
                <FormError error={pages.error} />
                <Button label={t('common.retry')} variant="outline" onPress={() => void pages.fetchNextPage()} testID="customers-more-retry" />
              </View>
            ) : null
          }
          testID="customers-list"
        />
      )}
    </Screen>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  list: { paddingTop: spacing['2xl'], paddingBottom: spacing['2xl'] },
  loading: { gap: spacing.md, paddingTop: spacing['2xl'] },
  gap: { height: spacing.md },
  more: { paddingVertical: spacing.lg },
});
