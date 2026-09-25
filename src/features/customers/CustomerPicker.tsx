import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { can } from '@/lib/permissions';
import { spacing } from '@/theme';
import { Button, Chip, FormError, ListRow, SearchBar, Text, TextField } from '@/ui';

import { useCustomers, useSaveCustomer } from './api';

export interface PickedCustomer {
  id: string;
  name: string;
}

/**
 * Search the customer book, quick-add a new customer (name + phone), or leave as a guest.
 * Staff (no access to the customer book) can only type a guest name.
 */
export function CustomerPicker({
  value,
  onChange,
  guestName,
  onGuestName,
}: {
  value: PickedCustomer | null;
  onChange: (customer: PickedCustomer | null) => void;
  guestName: string;
  onGuestName: (name: string) => void;
}) {
  const { t } = useTranslation();
  const { business, role } = useWorkspace();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const canBook = can(role, 'viewCustomers');
  const results = useCustomers(business.id, search);
  const save = useSaveCustomer(business.id);

  if (value) {
    return (
      <View style={styles.row}>
        <Chip label={value.name} icon="user" selected onPress={() => onChange(null)} testID="picked-customer" />
        <Text variant="small" color="textSecondary">
          {t('customers.tapToChange')}
        </Text>
      </View>
    );
  }

  if (!canBook) {
    return (
      <TextField label={t('queue.guestName')} value={guestName} onChangeText={onGuestName} testID="guest-name" />
    );
  }

  if (adding) {
    return (
      <View style={styles.stack}>
        <TextField label={t('customers.fields.name')} value={newName} onChangeText={setNewName} testID="new-customer-name" />
        <TextField
          label={t('customers.fields.phone')}
          value={newPhone}
          onChangeText={setNewPhone}
          keyboardType="phone-pad"
          testID="new-customer-phone"
        />
        <FormError error={save.error} />
        <View style={styles.row}>
          <Button label={t('common.cancel')} variant="ghost" size="md" onPress={() => setAdding(false)} />
          <Button
            label={t('customers.add')}
            size="md"
            loading={save.isPending}
            disabled={newName.trim().length < 1}
            onPress={() =>
              save.mutate(
                {
                  name: newName.trim(),
                  phone: newPhone.trim() || null,
                  preferences: null,
                  notes: null,
                  risk_flags: [],
                  marketing_opt_in: false,
                },
                {
                  onSuccess: (id) => {
                    onChange({ id, name: newName.trim() });
                    setAdding(false);
                  },
                },
              )
            }
            testID="save-new-customer"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <SearchBar value={search} onChangeText={setSearch} placeholder={t('customers.search')} testID="customer-search" />
      {search.trim() ? (
        (results.data ?? []).slice(0, 5).map((c) => (
          <ListRow
            key={c.id}
            title={c.name}
            meta={[c.phone ?? t('customers.noPhone')]}
            onPress={() => onChange({ id: c.id, name: c.name })}
            chevron
            testID={`customer-result-${c.name}`}
          />
        ))
      ) : (
        <TextField label={t('queue.guestName')} value={guestName} onChangeText={onGuestName} testID="guest-name" />
      )}
      <Button
        label={t('customers.new')}
        icon="userPlus"
        variant="ghost"
        size="md"
        onPress={() => {
          setNewName(search.trim());
          setAdding(true);
        }}
        testID="add-customer-inline"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
});
