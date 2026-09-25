import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { useWorkspace } from '@/features/auth/session';
import { spacing } from '@/theme';
import { Button, Chip, FormError, FormTextField, HeaderBand, QueryState, Screen, SwitchRow, Text, useToast } from '@/ui';

import { useCustomer, useSaveCustomer } from './api';

const schema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(80),
  phone: z.string().trim().regex(/^$|^\+?[0-9 ]{7,20}$/, 'validation.phone'),
  preferences: z.string().trim().max(200),
  notes: z.string().trim().max(500),
  risk_flags: z.array(z.string()),
  marketing_opt_in: z.boolean(),
});
type Values = z.infer<typeof schema>;
const RISKS = ['allergy', 'patch_test'] as const;

export function CustomerFormScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { business } = useWorkspace();
  const existing = useCustomer(business.id, id);
  const save = useSaveCustomer(business.id);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', phone: '', preferences: '', notes: '', risk_flags: [], marketing_opt_in: false },
  });

  const loaded = existing.data?.customer;
  useEffect(() => {
    if (loaded) {
      form.reset({
        name: loaded.name,
        phone: loaded.phone ?? '',
        preferences: loaded.preferences ?? '',
        notes: loaded.notes ?? '',
        risk_flags: loaded.risk_flags,
        marketing_opt_in: loaded.marketing_opt_in,
      });
    }
  }, [loaded, form]);

  const submit = form.handleSubmit((v) =>
    save.mutate(
      {
        id,
        name: v.name,
        phone: v.phone || null,
        preferences: v.preferences || null,
        notes: v.notes || null,
        risk_flags: v.risk_flags,
        marketing_opt_in: v.marketing_opt_in,
      },
      {
        onSuccess: (savedId) => {
          toast(t('customers.saved'));
          if (id) router.back();
          else router.replace({ pathname: '/customers/[id]', params: { id: savedId } });
        },
      },
    ),
  );

  const body = (
    <View style={styles.body}>
      <FormTextField control={form.control} name="name" label={t('customers.fields.name')} autoComplete="name" />
      <FormTextField control={form.control} name="phone" label={t('customers.fields.phone')} keyboardType="phone-pad" />
      <FormTextField control={form.control} name="preferences" label={t('customers.fields.preferences')} />
      <FormTextField control={form.control} name="notes" label={t('customers.fields.notes')} multiline />
      <Controller
        control={form.control}
        name="risk_flags"
        render={({ field }) => (
          <View style={styles.section}>
            <Text variant="bodyStrong">{t('customers.fields.risk')}</Text>
            <View style={styles.wrap}>
              {RISKS.map((flag) => {
                const on = field.value.includes(flag);
                return (
                  <Chip
                    key={flag}
                    label={t(`customers.risk.${flag}`)}
                    selected={on}
                    onPress={() => field.onChange(on ? field.value.filter((f) => f !== flag) : [...field.value, flag])}
                    testID={`risk-${flag}`}
                  />
                );
              })}
            </View>
          </View>
        )}
      />
      <Controller
        control={form.control}
        name="marketing_opt_in"
        render={({ field }) => (
          <SwitchRow label={t('customers.fields.marketing')} value={field.value} onChange={field.onChange} />
        )}
      />
      <FormError error={save.error} />
    </View>
  );

  return (
    <Screen
      header={<HeaderBand title={t(id ? 'customers.editTitle' : 'customers.newTitle')} onBack />}
      footer={<Button label={t('common.save')} onPress={submit} loading={save.isPending} testID="customer-save" />}
    >
      {id ? <QueryState query={existing}>{() => body}</QueryState> : body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  section: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
