import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useCatalog, type Service } from '@/features/catalog/api';
import { recipeText } from '@/features/catalog/recipeText';
import type { PickedCustomer } from '@/features/customers/CustomerPicker';
import { modeConfig } from '@/features/mode/modeConfig';
import { useAppointment } from '@/features/queue/api';
import type { SaleResult } from '@/features/sales/api';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { spacing, useTheme, useThemeMode } from '@/theme';
import {
  Button,
  Card,
  EmptyState,
  HeaderBand,
  Icon,
  QueryState,
  Screen,
  SegmentTabs,
  Stepper,
  Text,
  Thumb,
  type IconName,
} from '@/ui';

import { basketTotals, type BasketLine } from './basket';
import { CheckoutSheet } from './CheckoutSheet';
import { CustomItemSheet } from './CustomItemSheet';
import { SaleDoneSheet } from './SaleDoneSheet';

export function SaleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { mode } = useThemeMode();
  const { business, branch, role } = useWorkspace();
  const params = useLocalSearchParams<{ appointment?: string; customer?: string; customerName?: string }>();
  const catalog = useCatalog(business.id);
  const appointment = useAppointment(branch.id, params.appointment);

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
  const iconFor = (s: Service): IconName =>
    (categories.find((c) => c.id === s.category_id)?.icon as IconName | undefined) ??
    modeConfig[mode].defaultCategories[0]!.icon;
  const deposit = appt?.deposit_status === 'held' ? appt.deposit_minor : 0;
  const totals = basketTotals(lines, { vatOn: branch.vat_mode === 'on', deposit });
  const qtyOf = (id: string) => lines.find((l) => l.serviceId === id)?.qty ?? 0;

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

  return (
    <>
      <Screen
        insetBottom={false}
        refreshing={catalog.isRefetching}
        onRefresh={() => void catalog.refetch()}
        header={
          <HeaderBand
            title={t('sale.title')}
            subtitle={appt ? t('sale.forCustomer', { name: appt.customer_name ?? t('queue.guest') }) : t('sale.subtitle')}
          >
            <SegmentTabs
              items={[{ key: 'all', label: t('sale.all') }, ...categories.map((c) => ({ key: c.id, label: c.name }))]}
              value={category}
              onChange={setCategory}
            />
          </HeaderBand>
        }
        footer={
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
        }
      >
        <QueryState
          query={catalog}
          isEmpty={() => services.length === 0}
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
              {shown.map((service, i) => (
                <ServiceTile
                  key={service.id}
                  service={service}
                  icon={iconFor(service)}
                  index={i}
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
              <Card variant="outlined" padding={spacing.md} style={styles.tile}>
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
      <CheckoutSheet
        open={checkout}
        onClose={() => setCheckout(false)}
        lines={lines}
        onQtyChange={(key, qty) => setQty(key, qty)}
        customer={customer}
        onCustomer={setCustomer}
        guestName={guestName}
        onGuestName={setGuestName}
        employeeId={employeeId}
        onEmployee={setEmployeeId}
        appointmentId={appt?.id ?? null}
        deposit={deposit}
        onSaved={(result, method) => {
          setCheckout(false);
          reset();
          setDone({ ...result, method });
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
  service: Service;
  icon: IconName;
  index: number;
  qty: number;
  onChange: (n: number) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const recipe = recipeText(service.recipe, t);
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
              {t('common.minutes', { n: service.duration_min })}
            </Text>
          </View>
        </View>
      </View>
      {recipe ? (
        <Text variant="small" color="textSecondary" numberOfLines={1}>
          {recipe}
        </Text>
      ) : null}
      <Text variant="h4" weight="bold" tabular numberOfLines={1}>
        {formatMoney(service.price_minor)}
      </Text>
      <Stepper value={qty} onChange={onChange} itemLabel={service.name} fullWidth testID={`tile-${service.name}`} />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { flexBasis: '46%', flexGrow: 1, gap: spacing.sm, justifyContent: 'center' },
  tileTop: { flexDirection: 'row', gap: spacing.sm },
  duration: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
});
