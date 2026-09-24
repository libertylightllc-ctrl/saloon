import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { modeConfig } from '@/features/mode/modeConfig';
import { formatMoney, multiply, sum } from '@/lib/money';
import { spacing, useTheme, useThemeMode } from '@/theme';
import {
  Button,
  Card,
  HeaderBand,
  Icon,
  Screen,
  SegmentTabs,
  Stepper,
  Text,
  Thumb,
  type IconName,
} from '@/ui';

import { CheckoutSheet, SaleDoneSheet, type SavedSale } from './CheckoutSheet';
import type { DemoService } from './data';
import { useDemoBranch } from './useDemo';

export function SaleDemo() {
  const { t } = useTranslation();
  const { mode } = useThemeMode();
  const demo = useDemoBranch();
  const categories = modeConfig[mode].defaultCategories.filter((c) =>
    demo.services.some((s) => s.category === c.key),
  );
  const [category, setCategory] = useState('all');
  const [qty, setQty] = useState<Record<string, number>>({});
  const [checkout, setCheckout] = useState(false);
  const [done, setDone] = useState<SavedSale | null>(null);

  // Mode switch = different branch: clear the basket.
  const [source, setSource] = useState(demo);
  if (source !== demo) {
    setSource(demo);
    setQty({});
    setCategory('all');
  }

  const lines = demo.services
    .filter((s) => (qty[s.id] ?? 0) > 0)
    .map((service) => ({
      service,
      qty: qty[service.id]!,
      totalMinor: multiply(service.priceMinor, qty[service.id]!),
    }));
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const total = sum(lines.map((l) => l.totalMinor));
  const iconFor = (s: DemoService): IconName =>
    categories.find((c) => c.key === s.category)?.icon ?? 'scissors';
  const shown = demo.services.filter((s) => category === 'all' || s.category === category);

  return (
    <>
      <Screen
        insetBottom={false}
        header={
          <HeaderBand title={t('sale.title')} subtitle={t('sale.subtitle')}>
            <SegmentTabs
              items={[
                { key: 'all', label: t('sale.all') },
                ...categories.map((c) => ({
                  key: c.key,
                  label: t(`categories.${c.key}` as 'categories.hair'),
                })),
              ]}
              value={category}
              onChange={setCategory}
            />
          </HeaderBand>
        }
        footer={
          <View style={styles.footer}>
            <View style={styles.flex}>
              <Text variant="small" color="textSecondary">
                {count ? t('sale.basketCount', { n: count }) : t('sale.basketEmpty')}
              </Text>
              <Text variant="h3" weight="bold" tabular>
                {formatMoney(total)}
              </Text>
            </View>
            <Button
              label={t('sale.checkout')}
              size="md"
              disabled={!count}
              onPress={() => setCheckout(true)}
            />
          </View>
        }
      >
        <View style={styles.grid}>
          {shown.map((service, i) => (
            <ServiceTile
              key={service.id}
              service={service}
              icon={iconFor(service)}
              index={i}
              qty={qty[service.id] ?? 0}
              onChange={(n) => setQty((all) => ({ ...all, [service.id]: n }))}
            />
          ))}
        </View>
      </Screen>
      <CheckoutSheet
        open={checkout}
        onClose={() => setCheckout(false)}
        lines={lines}
        onQtyChange={(id, n) => setQty((all) => ({ ...all, [id]: n }))}
        onSaved={(totalMinor, method) => {
          setCheckout(false);
          setQty({});
          setDone({ number: demo.nextSaleNumber, totalMinor, method });
        }}
      />
      <SaleDoneSheet sale={done} onClose={() => setDone(null)} />
    </>
  );
}

function ServiceTile({
  service,
  icon,
  index,
  qty,
  onChange,
}: {
  service: DemoService;
  icon: IconName;
  index: number;
  qty: number;
  onChange: (n: number) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Card
      variant="outlined"
      padding={spacing.md}
      style={[styles.tile, qty > 0 && { borderColor: theme.colors.primary400 }]}
    >
      <View style={styles.tileTop}>
        <Thumb icon={icon} index={index} size={44} />
        <View style={styles.flex}>
          <Text variant="bodyStrong" weight="semibold" numberOfLines={2}>
            {service.name}
          </Text>
          <View style={styles.duration}>
            <Icon name="clock" size={12} color={theme.colors.textSecondary} />
            <Text variant="small" color="textSecondary">
              {t('common.minutes', { n: service.durationMin })}
            </Text>
          </View>
        </View>
      </View>
      {service.recipe ? (
        <Text variant="small" color="textSecondary" numberOfLines={1}>
          {service.recipe}
        </Text>
      ) : null}
      <Text variant="h4" weight="bold" tabular numberOfLines={1}>
        {formatMoney(service.priceMinor)}
      </Text>
      <Stepper value={qty} onChange={onChange} itemLabel={service.name} fullWidth />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { flexBasis: '46%', flexGrow: 1, gap: spacing.sm },
  tileTop: { flexDirection: 'row', gap: spacing.sm },
  duration: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
});
