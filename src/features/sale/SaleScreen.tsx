import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useCatalog, type Service } from '@/features/catalog/api';
import { useInventory } from '@/features/inventory/api';
import type { PickedCustomer } from '@/features/customers/CustomerPicker';
import { modeConfig } from '@/features/mode/modeConfig';
import { useAppointment } from '@/features/queue/api';
import type { SaleResult } from '@/features/sales/api';
import { useTax } from '@/features/tax/useTax';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { spacing, useThemeMode } from '@/theme';
import {
  Button,
  Card,
  EmptyState,
  HeaderBand,
  QueryState,
  Screen,
  SegmentTabs,
  Text,
  useTwoPane,
  type IconName,
} from '@/ui';

import { basketTotals, type BasketLine } from './basket';
import { CheckoutSheet, type CheckoutProps } from './CheckoutSheet';
import { CustomItemSheet } from './CustomItemSheet';
import { ProductTile } from './ProductTile';
import { SalePanel } from './SalePanel';
import { SaleDoneSheet } from './SaleDoneSheet';
import { ServiceTile } from './ServiceTile';

export function SaleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { mode } = useThemeMode();
  const { business, branch, role } = useWorkspace();
  const tax = useTax();
  const params = useLocalSearchParams<{ appointment?: string; customer?: string; customerName?: string }>();
  const catalog = useCatalog(business.id);
  const appointment = useAppointment(branch.id, params.appointment);
  const inventory = useInventory(branch.id);

  const [category, setCategory] = useState('all');
  const [lines, setLines] = useState<BasketLine[]>([]);
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [guestName, setGuestName] = useState('');
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [done, setDone] = useState<(SaleResult & { method: string }) | null>(null);
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);

  // Complete from the queue → basket, customer and staff come from the appointment.
  // (State is adjusted during render when the source changes — no effect round-trip.)
  const appt = appointment.data;
  if (appt && prefilledFor !== appt.id) {
    setPrefilledFor(appt.id);
    setLines(
      appt.appointment_services.map((s) => ({
        key: s.service_id,
        kind: 'service',
        serviceId: s.service_id,
        name: s.name_snapshot,
        unitPriceMinor: s.price_minor,
        qty: 1,
      })),
    );
    setCustomer(appt.customer_id ? { id: appt.customer_id, name: appt.customer_name ?? '' } : null);
    setGuestName(appt.customer_id ? '' : (appt.customer_name ?? ''));
    setEmployeeId(appt.employee_id);
  }
  const [customerParam, setCustomerParam] = useState<string | undefined>();
  if (params.customer !== customerParam) {
    setCustomerParam(params.customer);
    if (params.customer && !params.appointment) setCustomer({ id: params.customer, name: params.customerName ?? '' });
  }

  const services = useMemo(() => (catalog.data?.services ?? []).filter((s) => s.status === 'active'), [catalog.data]);
  const categories = (catalog.data?.categories ?? []).filter((c) => services.some((s) => s.category_id === c.id));
  const shown = services.filter((s) => category === 'all' || s.category_id === category);
  const products = (inventory.data ?? []).filter((i) => i.kind === 'retail' && i.active && i.sell_price_minor !== null);
  const iconFor = (s: Service): IconName =>
    (categories.find((c) => c.id === s.category_id)?.icon as IconName | undefined) ??
    modeConfig[mode].defaultCategories[0]!.icon;
  const deposit = appt?.deposit_status === 'held' ? appt.deposit_minor : 0;
  const totals = basketTotals(lines, { tax: tax.rule, deposit });
  // Tablets and computers: the services in as many columns as fit beside the always-open sale panel.
  const twoPane = useTwoPane();
  const [gridWidth, setGridWidth] = useState(0);
  const columns = Math.max(2, Math.min(5, Math.floor(gridWidth / 200)));
  const tileWidth = twoPane && gridWidth > 0 ? Math.floor((gridWidth - (columns - 1) * spacing.md) / columns) : undefined;
  const qtyOf = (id: string) => lines.find((l) => l.serviceId === id)?.qty ?? 0;
  const qtyOfItem = (id: string) => lines.find((l) => l.itemId === id)?.qty ?? 0;

  const setQty = (key: string, qty: number, add?: BasketLine) =>
    setLines((all) => {
      if (qty <= 0) return all.filter((l) => l.key !== key);
      if (all.some((l) => l.key === key)) return all.map((l) => (l.key === key ? { ...l, qty } : l));
      return add ? [...all, { ...add, qty }] : all;
    });

  const reset = () => {
    setLines([]);
    setCustomer(null);
    setGuestName('');
    setEmployeeId(null);
    setPrefilledFor(null);
    if (params.appointment || params.customer) router.setParams({ appointment: undefined, customer: undefined, customerName: undefined });
  };

  const checkoutProps: CheckoutProps = {
    lines,
    onQtyChange: (key, qty) => setQty(key, qty),
    customer,
    onCustomer: setCustomer,
    guestName,
    onGuestName: setGuestName,
    employeeId,
    onEmployee: setEmployeeId,
    appointmentId: appt?.id ?? null,
    deposit,
    onSaved: (result, method) => {
      setCheckout(false);
      reset();
      setDone({ ...result, method });
    },
  };

  const catalogView = (
    <QueryState
      query={catalog}
      isEmpty={() => services.length === 0 && products.length === 0}
      empty={
        <EmptyState
          illustration="no-results"
          message={t('sale.noServices')}
          actionLabel={can(role, 'manageServices') ? t('services.add') : undefined}
          onAction={can(role, 'manageServices') ? () => router.push('/services/form') : undefined}
        />
      }
    >
      {() => (
        <View style={styles.grid}>
          {category === 'products'
            ? products.map((item, i) => (
                <ProductTile
                  key={item.item_id}
                  item={item}
                  index={i}
                  width={tileWidth}
                  qty={qtyOfItem(item.item_id)}
                  onChange={(n) =>
                    setQty(`item-${item.item_id}`, n, {
                      key: `item-${item.item_id}`,
                      kind: 'retail',
                      itemId: item.item_id,
                      unit: item.unit,
                      name: item.name,
                      unitPriceMinor: item.sell_price_minor ?? 0,
                      qty: n,
                    })
                  }
                />
              ))
            : null}
          {(category === 'products' ? [] : shown).map((service, i) => (
            <ServiceTile
              key={service.id}
              service={service}
              icon={iconFor(service)}
              index={i}
              width={tileWidth}
              qty={qtyOf(service.id)}
              onChange={(n) =>
                setQty(service.id, n, {
                  key: service.id,
                  kind: 'service',
                  serviceId: service.id,
                  name: service.name,
                  unitPriceMinor: service.price_minor,
                  qty: n,
                })
              }
            />
          ))}
          <Card variant="outlined" padding={spacing.md} style={[styles.tile, tileWidth ? { flexBasis: tileWidth, flexGrow: 0, width: tileWidth } : null]}>
            <Button
              label={t('sale.customItem')}
              icon="plus"
              variant="ghost"
              size="md"
              onPress={() => setCustomOpen(true)}
              testID="custom-item"
            />
          </Card>
        </View>
      )}
    </QueryState>
  );

  return (
    <>
      <Screen
        insetBottom={false}
        width="full"
        scroll={!twoPane}
        refreshing={catalog.isRefetching}
        onRefresh={() => {
          void catalog.refetch();
          void inventory.refetch();
        }}
        header={
          <HeaderBand
            title={t('sale.title')}
            subtitle={appt ? t('sale.forCustomer', { name: appt.customer_name ?? t('queue.guest') }) : t('sale.subtitle')}
          >
            <SegmentTabs
              items={[
                { key: 'all', label: t('sale.all') },
                ...categories.map((c) => ({ key: c.id, label: c.name })),
                ...(products.length ? [{ key: 'products', label: t('sale.products') }] : []),
              ]}
              value={category}
              onChange={setCategory}
              testID="sale-tab"
            />
          </HeaderBand>
        }
        footer={
          twoPane ? undefined : (
          <View style={styles.footer}>
            <View style={styles.flex}>
              <Text variant="small" color="textSecondary">
                {totals.count ? t('sale.basketCount', { n: totals.count }) : t('sale.basketEmpty')}
              </Text>
              <Text variant="h3" weight="bold" tabular testID="basket-total">
                {formatMoney(totals.total)}
              </Text>
            </View>
            <Button
              label={t('sale.checkout')}
              size="md"
              disabled={!totals.count}
              onPress={() => setCheckout(true)}
              testID="checkout"
            />
          </View>
          )
        }
      >
        {twoPane ? (
          <View style={styles.split}>
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.gridPad}
              showsVerticalScrollIndicator={false}
              onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
            >
              {catalogView}
            </ScrollView>
            <SalePanel {...checkoutProps} onClear={reset} />
          </View>
        ) : (
          catalogView
        )}
      </Screen>
      <CustomItemSheet
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onAdd={(name, price) =>
          setLines((all) => [
            ...all,
            { key: `custom-${all.length}-${name}`, kind: 'custom', name, unitPriceMinor: price, qty: 1 },
          ])
        }
      />
      {twoPane ? null : <CheckoutSheet open={checkout} onClose={() => setCheckout(false)} {...checkoutProps} />}
      <SaleDoneSheet sale={done} onClose={() => setDone(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { flexBasis: '46%', flexGrow: 1, gap: spacing.sm, justifyContent: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  split: { flex: 1, minHeight: 0, flexDirection: 'row', gap: spacing['2xl'] },
  gridPad: { paddingBottom: spacing['2xl'] },
});
