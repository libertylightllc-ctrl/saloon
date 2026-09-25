import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { useWorkspace } from '@/features/auth/session';
import { useCatalog, useSaveService } from '@/features/catalog/api';
import { spacing } from '@/theme';
import {
  Button,
  Chip,
  FormError,
  FormMoneyField,
  FormTextField,
  HeaderBand,
  QueryState,
  Screen,
  SwitchRow,
  Text,
  useToast,
  type IconName,
} from '@/ui';

import { RecipeEditor, type RecipeDraft } from './RecipeEditor';

const minutes = (min: number, max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, 'validation.number')
    .refine((v) => Number(v) >= min && Number(v) <= max, 'validation.range');

const schema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(60, 'validation.tooLong'),
  category_id: z.string().min(1, 'validation.pickCategory'),
  price_minor: z.number({ message: 'validation.required' }).int().min(0, 'validation.required'),
  duration_min: minutes(5, 600),
  buffer_min: minutes(0, 120),
  requires_room: z.boolean(),
  requires_patch_test: z.boolean(),
  recipe: z
    .array(z.custom<RecipeDraft>())
    .refine((lines) => lines.every((l) => Number(l.qty) > 0), 'validation.recipeQty'),
});
type Values = z.infer<typeof schema>;

export function ServiceFormScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { business, branch } = useWorkspace();
  const catalog = useCatalog(business.id);
  const save = useSaveService(business.id);
  const existing = catalog.data?.services.find((s) => s.id === id);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      category_id: '',
      price_minor: undefined,
      duration_min: '30',
      buffer_min: '0',
      requires_room: false,
      requires_patch_test: false,
      recipe: [],
    },
  });

  useEffect(() => {
    if (!existing) return;
    form.reset({
      name: existing.name,
      category_id: existing.category_id,
      price_minor: existing.price_minor,
      duration_min: String(existing.duration_min),
      buffer_min: String(existing.buffer_min),
      requires_room: existing.requires_room,
      requires_patch_test: existing.requires_patch_test,
      recipe: existing.recipe.map((r) => ({
        key: r.item_id,
        item_id: r.item_id,
        item_name: r.name,
        unit: r.unit as RecipeDraft['unit'],
        qty: String(r.qty),
      })),
    });
  }, [existing, form]);

  const write = (v: Values, status?: 'active' | 'archived') =>
    save.mutate(
      {
        id,
        category_id: v.category_id,
        name: v.name,
        price_minor: v.price_minor,
        duration_min: Number(v.duration_min),
        buffer_min: Number(v.buffer_min),
        requires_room: v.requires_room,
        requires_patch_test: v.requires_patch_test,
        status,
        recipe: v.recipe.map((l) =>
          l.item_id ? { item_id: l.item_id, qty: Number(l.qty) } : { item_name: l.item_name, unit: l.unit, qty: Number(l.qty) },
        ),
      },
      {
        onSuccess: () => {
          toast(t(status === 'archived' ? 'services.archivedToast' : status === 'active' ? 'services.restoredToast' : 'services.saved'));
          router.back();
        },
      },
    );

  const submit = form.handleSubmit((v) => write(v));
  const toggleArchive = form.handleSubmit((v) => write(v, existing?.status === 'archived' ? 'active' : 'archived'));
  const ladies = branch.mode === 'ladies';

  const body = (data: NonNullable<typeof catalog.data>) => (
    <View style={styles.body}>
      <FormTextField control={form.control} name="name" label={t('services.fields.name')} />
      <Controller
        control={form.control}
        name="category_id"
        render={({ field, fieldState }) => (
          <View style={styles.section}>
            <Text variant="bodyStrong">{t('services.fields.category')}</Text>
            <View style={styles.wrap}>
              {data.categories.map((c) => (
                <Chip
                  key={c.id}
                  icon={c.icon as IconName}
                  label={c.name}
                  selected={field.value === c.id}
                  onPress={() => field.onChange(c.id)}
                  testID={`category-${c.name}`}
                />
              ))}
            </View>
            {fieldState.error?.message ? (
              <Text variant="small" color="primaryText">
                {t(fieldState.error.message as 'validation.required')}
              </Text>
            ) : null}
          </View>
        )}
      />
      <FormMoneyField control={form.control} name="price_minor" label={t('services.fields.price')} />
      <View style={styles.pair}>
        <View style={styles.flex}>
          <FormTextField control={form.control} name="duration_min" label={t('services.fields.duration')} keyboardType="number-pad" />
        </View>
        <View style={styles.flex}>
          <FormTextField control={form.control} name="buffer_min" label={t('services.fields.buffer')} keyboardType="number-pad" />
        </View>
      </View>
      {ladies ? (
        <>
          <Controller
            control={form.control}
            name="requires_room"
            render={({ field }) => (
              <SwitchRow label={t('services.fields.room')} hint={t('services.fields.roomHint')} value={field.value} onChange={field.onChange} />
            )}
          />
          <Controller
            control={form.control}
            name="requires_patch_test"
            render={({ field }) => (
              <SwitchRow label={t('services.fields.patchTest')} value={field.value} onChange={field.onChange} />
            )}
          />
        </>
      ) : null}
      <View style={styles.section}>
        <Text variant="bodyStrong">{t('services.fields.recipe')}</Text>
        <Text variant="small" color="textSecondary">
          {t('services.fields.recipeHint')}
        </Text>
        <Controller
          control={form.control}
          name="recipe"
          render={({ field, fieldState }) => (
            <RecipeEditor
              items={data.items}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message ? t(fieldState.error.message as 'validation.required') : undefined}
            />
          )}
        />
      </View>
      <FormError error={save.error} />
      {existing ? (
        <Button
          label={t(existing.status === 'archived' ? 'services.restore' : 'services.archive')}
          variant="ghost"
          size="md"
          onPress={toggleArchive}
          disabled={save.isPending}
          testID="service-archive"
        />
      ) : null}
    </View>
  );

  return (
    <Screen
      header={<HeaderBand title={t(id ? 'services.editTitle' : 'services.newTitle')} onBack />}
      footer={<Button label={t('common.save')} onPress={submit} loading={save.isPending} testID="service-save" />}
    >
      <QueryState query={catalog}>{body}</QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  section: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pair: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
