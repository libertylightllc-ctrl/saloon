import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useCatalog, type Service } from '@/features/catalog/api';
import { recipeText } from '@/features/catalog/recipeText';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { spacing } from '@/theme';
import {
  Button,
  EmptyState,
  HeaderBand,
  ListRow,
  QueryState,
  Screen,
  SectionHeader,
  SegmentTabs,
  StatusPill,
  Text,
  Thumb,
  type IconName,
} from '@/ui';

type Tab = 'active' | 'archived';

export function ServicesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { business, role } = useWorkspace();
  const catalog = useCatalog(business.id);
  const [tab, setTab] = useState<Tab>('active');
  const owner = can(role, 'manageServices');

  const open = (s: Service) =>
    owner ? () => router.push({ pathname: '/services/form', params: { id: s.id } }) : undefined;

  return (
    <Screen
      refreshing={catalog.isRefetching}
      onRefresh={() => void catalog.refetch()}
      header={
        <HeaderBand
          title={t('services.title')}
          onBack
          right={
            owner ? (
              <Button
                label={t('common.new')}
                icon="plus"
                size="sm"
                variant="secondary"
                onPress={() => router.push('/services/form')}
                testID="services-new"
              />
            ) : undefined
          }
        >
          <SegmentTabs<Tab>
            items={[
              { key: 'active', label: t('services.active') },
              { key: 'archived', label: t('services.archived') },
            ]}
            value={tab}
            onChange={setTab}
          />
        </HeaderBand>
      }
    >
      <QueryState
        query={catalog}
        isEmpty={(data) => !data.services.some((s) => s.status === tab)}
        empty={
          <EmptyState
            illustration="no-results"
            message={t(tab === 'active' ? 'services.empty' : 'services.noArchived')}
            actionLabel={owner && tab === 'active' ? t('services.add') : undefined}
            onAction={owner && tab === 'active' ? () => router.push('/services/form') : undefined}
          />
        }
      >
        {(data) => (
          <View style={styles.body}>
            {owner ? (
              <Button
                label={t('services.categories')}
                icon="grid"
                variant="ghost"
                size="md"
                onPress={() => router.push('/services/categories')}
                testID="services-categories"
              />
            ) : null}
            {data.categories.map((category, ci) => {
              const list = data.services.filter((s) => s.category_id === category.id && s.status === tab);
              if (!list.length) return null;
              return (
                <View key={category.id} style={styles.group}>
                  <SectionHeader title={category.name} />
                  {list.map((s) => (
                    <ListRow
                      key={s.id}
                      testID={`service-${s.name}`}
                      leading={<Thumb icon={category.icon as IconName} index={ci} size={44} />}
                      title={s.name}
                      meta={[
                        t('common.minutes', { n: s.duration_min }),
                        ...(s.recipe.length ? [recipeText(s.recipe, t)] : []),
                      ]}
                      badges={
                        s.requires_room || s.requires_patch_test ? (
                          <>
                            {s.requires_room ? <StatusPill tone="info" label={t('services.needsRoom')} /> : null}
                            {s.requires_patch_test ? <StatusPill tone="warning" label={t('services.patchTest')} /> : null}
                          </>
                        ) : undefined
                      }
                      trailing={
                        <Text variant="bodyStrong" tabular>
                          {formatMoney(s.price_minor)}
                        </Text>
                      }
                      chevron={owner}
                      onPress={open(s)}
                    />
                  ))}
                </View>
              );
            })}
          </View>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl },
  group: { gap: spacing.sm },
});
