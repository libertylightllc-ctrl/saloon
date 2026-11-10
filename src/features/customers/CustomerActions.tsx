import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { can } from '@/lib/permissions';
import { spacing } from '@/theme';
import { BottomSheet, Button, FormError, ListRow, SearchBar, Text, TextField, useToast } from '@/ui';

import { useCustomers, useDeleteCustomer, useMergeCustomers } from './api';

interface Who {
  id: string;
  name: string;
}

/** "Merge a duplicate" (owner, manager) and "Delete customer" (owner only), at the foot of a customer's page. */
export function CustomerActions({ customer }: { customer: Who }) {
  const { t } = useTranslation();
  const { role } = useWorkspace();
  const [open, setOpen] = useState<'merge' | 'delete' | null>(null);
  const merge = can(role, 'mergeCustomers');
  const remove = can(role, 'deleteCustomers');
  if (!merge && !remove) return null;
  return (
    <View style={styles.row}>
      {merge ? (
        <Button label={t('customers.merge.button')} icon="users" variant="outline" size="md" onPress={() => setOpen('merge')} testID="customer-merge" />
      ) : null}
      {remove ? (
        <Button label={t('customers.remove.button')} icon="trash" variant="ghost" size="md" onPress={() => setOpen('delete')} testID="customer-delete" />
      ) : null}
      <BottomSheet open={open === 'merge'} onClose={() => setOpen(null)} title={t('customers.merge.title', { name: customer.name })}>
        {open === 'merge' ? <MergeForm keep={customer} onDone={() => setOpen(null)} /> : null}
      </BottomSheet>
      <BottomSheet open={open === 'delete'} onClose={() => setOpen(null)} title={t('customers.remove.title', { name: customer.name })}>
        {open === 'delete' ? <DeleteForm customer={customer} /> : null}
      </BottomSheet>
    </View>
  );
}

/** Pick the duplicate, then confirm: its visits, sales and notes move to the customer kept. */
function MergeForm({ keep, onDone }: { keep: Who; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { business, branch } = useWorkspace();
  const [search, setSearch] = useState('');
  const [drop, setDrop] = useState<Who | null>(null);
  const results = useCustomers(business.id, search);
  const merge = useMergeCustomers(business.id, branch.id);

  if (drop) {
    return (
      <>
        <Text testID="customer-merge-confirm-text">{t('customers.merge.confirm', { drop: drop.name, keep: keep.name })}</Text>
        <FormError error={merge.error} />
        <View style={styles.row}>
          <Button label={t('common.back')} variant="ghost" size="md" onPress={() => setDrop(null)} />
          <Button
            label={t('customers.merge.do')}
            size="md"
            loading={merge.isPending}
            onPress={() =>
              merge.mutate(
                { keep: keep.id, drop: drop.id },
                {
                  onSuccess: () => {
                    toast(t('customers.merge.done', { name: drop.name }));
                    onDone();
                  },
                },
              )
            }
            testID="customer-merge-confirm"
          />
        </View>
      </>
    );
  }
  return (
    <>
      <Text color="textSecondary">{t('customers.merge.hint', { name: keep.name })}</Text>
      <SearchBar value={search} onChangeText={setSearch} placeholder={t('customers.search')} testID="customer-merge-search" />
      {search.trim()
        ? (results.data ?? [])
            .filter((c) => c.id !== keep.id)
            .slice(0, 6)
            .map((c) => (
              <ListRow
                key={c.id}
                title={c.name}
                meta={[c.phone ?? t('customers.noPhone')]}
                chevron
                onPress={() => setDrop({ id: c.id, name: c.name })}
                testID={`customer-merge-pick-${c.name}`}
              />
            ))
        : null}
    </>
  );
}

/** The owner removes a customer's personal details, with a reason. Sales stay in the books as "Deleted customer". */
function DeleteForm({ customer }: { customer: Who }) {
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const { business, branch } = useWorkspace();
  const remove = useDeleteCustomer(business.id, branch.id);
  const [reason, setReason] = useState('');
  return (
    <>
      <Text color="textSecondary">{t('customers.remove.hint', { name: customer.name })}</Text>
      <TextField label={t('customers.remove.reason')} value={reason} onChangeText={setReason} maxLength={200} testID="customer-delete-reason" />
      <FormError error={remove.error} />
      <Button
        label={t('customers.remove.do')}
        variant="danger"
        disabled={reason.trim().length < 3}
        loading={remove.isPending}
        onPress={() =>
          remove.mutate(
            { id: customer.id, reason: reason.trim() },
            {
              onSuccess: () => {
                toast(t('customers.remove.done'));
                router.back();
              },
            },
          )
        }
        testID="customer-delete-confirm"
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
