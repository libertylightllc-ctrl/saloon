import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useCatalog, useSaveCategory, type Category } from '@/features/catalog/api';
import { spacing } from '@/theme';
import {
  BottomSheet,
  Button,
  FormError,
  HeaderBand,
  IconButton,
  ListRow,
  QueryState,
  Screen,
  TextField,
  Thumb,
  useToast,
  type IconName,
} from '@/ui';

const ICONS: IconName[] = ['scissors', 'brush', 'palette', 'face', 'massage', 'hand', 'sparkles', 'feather', 'flower', 'gem', 'star', 'tag'];

export function CategoriesScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const { business } = useWorkspace();
  const catalog = useCatalog(business.id);
  const save = useSaveCategory(business.id);
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<IconName>('scissors');

  const open = (c: Partial<Category>) => {
    save.reset();
    setEditing(c);
    setName(c.name ?? '');
    setIcon((c.icon as IconName | undefined) ?? 'scissors');
  };
  const used = (id: string) => (catalog.data?.services ?? []).some((s) => s.category_id === id && s.status === 'active');

  const submit = (archived = false) =>
    save.mutate(
      { id: editing?.id, name, icon, archived, sort: (catalog.data?.categories.length ?? 0) + 1 },
      {
        onSuccess: () => {
          toast(t(archived ? 'services.categoryArchived' : 'services.categorySaved'));
          setEditing(null);
        },
      },
    );

  return (
    <>
      <Screen
        refreshing={catalog.isRefetching}
        onRefresh={() => void catalog.refetch()}
        header={
          <HeaderBand
            title={t('services.categories')}
            onBack
            right={
              <Button label={t('common.new')} icon="plus" size="sm" variant="secondary" onPress={() => open({})} testID="category-new" />
            }
          />
        }
      >
        <QueryState query={catalog}>
          {(data) => (
            <View style={styles.body}>
              {data.categories.map((c, i) => (
                <ListRow
                  key={c.id}
                  testID={`category-row-${c.name}`}
                  leading={<Thumb icon={c.icon as IconName} index={i} size={44} />}
                  title={c.name}
                  meta={[t('services.countInCategory', { count: data.services.filter((s) => s.category_id === c.id && s.status === 'active').length })]}
                  chevron
                  onPress={() => open(c)}
                />
              ))}
            </View>
          )}
        </QueryState>
      </Screen>
      <BottomSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={t(editing?.id ? 'services.editCategory' : 'services.newCategory')}
      >
        <TextField label={t('services.fields.categoryName')} value={name} onChangeText={setName} maxLength={40} testID="category-name" />
        <View style={styles.wrap}>
          {ICONS.map((key, i) => (
            <IconButton
              key={key}
              icon={key}
              variant={icon === key ? 'filled' : 'tinted'}
              accessibilityLabel={t('services.iconOption', { n: i + 1 })}
              onPress={() => setIcon(key)}
            />
          ))}
        </View>
        <FormError error={save.error} />
        <Button label={t('common.save')} onPress={() => submit()} loading={save.isPending} disabled={!name.trim()} testID="category-save" />
        {editing?.id && !used(editing.id) ? (
          <Button label={t('services.archiveCategory')} variant="ghost" size="md" onPress={() => submit(true)} disabled={save.isPending} />
        ) : null}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});

