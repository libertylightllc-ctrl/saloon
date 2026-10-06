import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import { Button, Card, FormError, ListRow, QueryState, SearchBar, SectionHeader, StatusPill, Text, TextField, useToast } from '@/ui';

import { useAccounts, useSetPlatformOwner, type Account } from './api';

const ZONE = 'Asia/Dubai';

/** How an account signs in: an owner's email, or a staff member's username at their salon. */
export const signInName = (a: Account) => a.email ?? (a.username ? `@${a.username}` : a.user_id.slice(0, 8));

/** Platform owners (name or remove by email), then every sign-in account with its salon, role and last sign-in. */
export function AccountsTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const dates = useDates();
  const accounts = useAccounts();
  const setOwner = useSetPlatformOwner();
  const [email, setEmail] = useState('');
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const when = (iso: string | null) => (iso ? dates.at(iso, ZONE, 'd MMM yyyy · HH:mm') : t('console.accounts.never'));

  return (
    <QueryState query={accounts}>
      {(rows) => (
        <View style={styles.body}>
          <SectionHeader title={t('console.owners.title')} />
          <Card variant="outlined" style={styles.card}>
            <Text variant="small" color="textSecondary">
              {t('console.owners.hint')}
            </Text>
            {rows
              .filter((a) => a.platform_owner)
              .map((a) => (
                <View key={a.user_id} style={styles.row}>
                  <Text style={styles.flex} selectable>
                    {signInName(a)}
                  </Text>
                  <Button
                    label={t('console.owners.remove')}
                    variant="ghost"
                    size="sm"
                    onPress={() => setOwner.mutate({ email: a.email ?? '', on: false }, { onSuccess: () => toast(t('console.owners.removed')) })}
                    testID={`console-owner-remove-${a.email}`}
                  />
                </View>
              ))}
            <View style={styles.row}>
              <View style={styles.flex}>
                <TextField
                  label={t('console.owners.email')}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  testID="console-owner-email"
                />
              </View>
            </View>
            <FormError error={setOwner.error} />
            <Button
              label={t('console.owners.add')}
              icon="userPlus"
              size="md"
              disabled={!email.includes('@')}
              loading={setOwner.isPending}
              onPress={() =>
                setOwner.mutate(
                  { email, on: true },
                  {
                    onSuccess: () => {
                      toast(t('console.owners.added'));
                      setEmail('');
                    },
                  },
                )
              }
              testID="console-owner-add"
            />
          </Card>

          <SectionHeader title={t('console.accounts.title', { count: rows.length })} />
          <SearchBar value={search} onChangeText={setSearch} placeholder={t('console.accounts.search')} testID="console-account-search" />
          {rows
            .filter((a) => !q || [a.email, a.username, a.display_name, a.salon].some((v) => v?.toLowerCase().includes(q)))
            .map((a) => (
              <ListRow
                key={a.user_id}
                testID={`console-account-${a.email ?? a.username}`}
                title={signInName(a)}
                meta={[
                  [a.display_name, a.role ? t(`roles.${a.role}` as 'roles.owner') : null, a.salon ?? t('console.accounts.noSalon')]
                    .filter(Boolean)
                    .join(' · '),
                  t('console.accounts.line', { created: dates.at(a.created_at, ZONE, 'd MMM yyyy'), last: when(a.last_sign_in_at) }),
                ]}
                badges={
                  a.platform_owner || a.active === false || a.provider !== 'email' || !a.confirmed ? (
                    <View style={styles.badges}>
                      {a.platform_owner ? <StatusPill tone="primary" label={t('console.owners.badge')} /> : null}
                      {a.active === false ? <StatusPill status="cancelled" label={t('console.accounts.inactive')} /> : null}
                      {a.provider !== 'email' ? <StatusPill tone="neutral" label={a.provider} /> : null}
                      {!a.confirmed ? <StatusPill tone="warning" label={t('console.accounts.unconfirmed')} /> : null}
                    </View>
                  ) : undefined
                }
              />
            ))}
        </View>
      )}
    </QueryState>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
