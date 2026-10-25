import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { showsBilling, usePlanStatus } from '@/features/plan/api';
import { canOfferPlans } from '@/features/plan/storePolicy';
import { ModeCard } from '@/features/setup/ModeCard';
import { formatMoney } from '@/lib/money';
import { MODES, spacing, type Mode } from '@/theme';
import { Button, Card, FormError, HeaderBand, QueryState, Screen, StatusPill, Text, TextField, useToast } from '@/ui';

import { useBranches, useCreateBranch, useSwitchBranch } from './api';

/**
 * More → Branches (full update, Phase 6 f; owner): every branch of the salon, the one open now, opening another (the
 * whole app follows), and adding one. While billing is on and the salon is not free, adding one says first what it
 * adds to the plan — from the next payment; nothing is charged then.
 */
export function BranchesScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const { business, branch } = useWorkspace();
  const branches = useBranches(business.id);
  const plan = usePlanStatus(business.id).data;
  const create = useCreateBranch(business.id);
  const open = useSwitchBranch();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [mode, setMode] = useState<Mode>(branch.mode as Mode);
  const priced = plan && canOfferPlans && showsBilling(plan);

  const add = () =>
    create.mutate(
      { name: name.trim(), mode, address: address.trim(), phone: phone.trim() },
      {
        onSuccess: () => {
          toast(t('branches.added', { name: name.trim() }));
          setAdding(false);
          setName('');
          setAddress('');
          setPhone('');
        },
      },
    );

  return (
    <Screen header={<HeaderBand title={t('branches.title')} subtitle={t('branches.subtitle')} onBack />}>
      <QueryState query={branches}>
        {(rows) => (
          <View style={styles.body}>
            {rows.map((b) => (
              <Card key={b.id} variant="outlined" style={styles.row} testID={`branch-${b.name}`}>
                <View style={styles.flex}>
                  <Text variant="h4">{b.name}</Text>
                  <Text variant="small" color="textSecondary">
                    {[t(`auth.salonType.${b.mode}` as 'auth.salonType.gents'), b.address].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {b.id === branch.id ? (
                  <StatusPill status="valid" label={t('branches.openNow')} />
                ) : (
                  <Button
                    label={t('branches.open')}
                    size="sm"
                    variant="outline"
                    loading={open.isPending && open.variables === b.id}
                    onPress={() => open.mutate(b.id, { onSuccess: () => router.replace('/') })}
                    testID={`branch-open-${b.name}`}
                  />
                )}
              </Card>
            ))}
            <FormError error={open.error} />
            {adding ? (
              <Card variant="outlined" style={styles.form} testID="branch-new">
                <Text variant="h4">{t('branches.new')}</Text>
                <TextField label={t('branches.name')} value={name} onChangeText={setName} maxLength={60} testID="branch-new-name" />
                <TextField label={t('branch.fields.address')} value={address} onChangeText={setAddress} maxLength={200} testID="branch-new-address" />
                <TextField label={t('branch.fields.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={30} />
                <Text variant="bodyStrong">{t('branch.mode')}</Text>
                {MODES.map((m) => (
                  <ModeCard key={m} mode={m} selected={mode === m} onPress={() => setMode(m)} testID={`branch-new-mode-${m}`} />
                ))}
                {priced ? (
                  <Text color="textSecondary" testID="branch-new-price">
                    {t('branches.priceNote', {
                      price: formatMoney(plan.base_minor, plan.currency),
                      included: plan.included_people,
                      extra: formatMoney(plan.extra_person_minor, plan.currency),
                    })}
                  </Text>
                ) : null}
                <FormError error={create.error} />
                <Button
                  label={t('branches.add')}
                  loading={create.isPending}
                  disabled={name.trim().length < 2}
                  onPress={add}
                  testID="branch-new-save"
                />
              </Card>
            ) : (
              <Button label={t('branches.new')} icon="plus" variant="secondary" onPress={() => setAdding(true)} testID="branch-add" />
            )}
          </View>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  form: { gap: spacing.md },
});
