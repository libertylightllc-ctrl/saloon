import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useAdminPlanAction, useAdminSalons, type AdminSalon } from '@/features/plan/api';
import { countryName } from '@/lib/countries';
import { isCurrency } from '@/lib/currencies';
import { formatMoney } from '@/lib/money';
import { useDates } from '@/lib/useDates';
import { spacing } from '@/theme';
import {
  BottomSheet,
  Button,
  EmptyState,
  FormError,
  ListRow,
  MoneyInput,
  PillTabs,
  QueryState,
  SearchBar,
  StatusPill,
  Text,
  TextField,
  useToast,
} from '@/ui';

import { useCloseSalon, useSalonStats } from './api';

const MONTHS = [1, 3, 6, 12] as const;

/** Every salon: owner, plan and request, and what it does — staff, customers, sales, last activity. */
export function SalonsTab({ onHistory }: { onHistory: (salon: { id: string; name: string }) => void }) {
  const { t, i18n } = useTranslation();
  const dates = useDates();
  const salons = useAdminSalons();
  const stats = useSalonStats();
  const [open, setOpen] = useState<AdminSalon | null>(null);
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();

  return (
    <>
      <SearchBar value={search} onChangeText={setSearch} placeholder={t('console.salons.search')} testID="console-salon-search" />
      <QueryState query={salons} isEmpty={(rows) => rows.length === 0} empty={<EmptyState illustration="no-results" message={t('admin.empty')} />}>
        {(rows) => (
          <View style={styles.list}>
            {rows
              .filter((s) => !q || [s.name, s.code, s.owner_name, s.owner_email].some((v) => v?.toLowerCase().includes(q)))
              .map((s) => {
                const st = stats.data?.get(s.business_id);
                const currency = st && isCurrency(st.currency) ? st.currency : undefined;
                return (
                  <ListRow
                    key={s.business_id}
                    testID={`admin-salon-${s.code}`}
                    title={s.name}
                    meta={[
                      [s.owner_name, s.owner_email].filter(Boolean).join(' · '),
                      t('admin.meta', { code: s.code, branches: s.branches, date: dates.at(s.created_at, s.timezone, 'd MMM yyyy') }),
                      [countryName(s.country_code, i18n.language), st?.mode].filter(Boolean).join(' · '),
                      t('console.salons.plan', { people: s.people, price: formatMoney(s.monthly_minor, s.plan_currency) }),
                      ...(st
                        ? [
                            t('console.salons.stats', { staff: st.staff, customers: st.customers, services: st.services }),
                            t('console.salons.sales', {
                              count: st.sales_30d,
                              total: currency ? formatMoney(st.sales_month_minor, currency) : `${st.currency} ${st.sales_month_minor}`,
                            }),
                            st.last_sign_in_at
                              ? t('console.salons.lastActive', { date: dates.at(st.last_sign_in_at, s.timezone, 'd MMM yyyy · HH:mm') })
                              : t('console.salons.never'),
                          ]
                        : []),
                      ...(s.requested_at ? [t('admin.requested', { months: s.requested_months ?? 1, note: s.request_note ?? '' }).trim()] : []),
                    ]}
                    badges={
                      <View style={styles.badges}>
                        <StatusPill
                          status={s.active ? 'valid' : 'expired'}
                          label={s.active && s.paid_until ? t('admin.until', { date: dates.day(s.paid_until, 'd MMM yyyy') }) : t('plan.inactive')}
                        />
                        {s.requested_at ? <StatusPill status="pending_approval" label={t('admin.asked')} /> : null}
                        {st?.closed ? <StatusPill status="cancelled" label={t('console.salons.closed')} /> : null}
                      </View>
                    }
                    chevron
                    onPress={() => setOpen(s)}
                  />
                );
              })}
          </View>
        )}
      </QueryState>
      <BottomSheet open={open !== null} onClose={() => setOpen(null)} title={open?.name ?? ''}>
        {open ? (
          <View style={styles.sheet}>
            <Button
              label={t('console.salons.history')}
              icon="fileText"
              variant="secondary"
              size="md"
              onPress={() => {
                const s = open;
                setOpen(null);
                onHistory({ id: s.business_id, name: s.name });
              }}
              testID="console-salon-history"
            />
            <SalonPlanForm salon={open} onDone={() => setOpen(null)} />
            {stats.data?.get(open.business_id)?.closed ? null : <CloseSalon salon={open} onDone={() => setOpen(null)} />}
          </View>
        ) : null}
      </BottomSheet>
    </>
  );
}

/** Record a plan payment (it runs from today, or from the current end) or end a plan (a note is needed). */
function SalonPlanForm({ salon, onDone }: { salon: AdminSalon; onDone: () => void }) {
  // The salon's own monthly price (by its people): AED in the UAE, USD elsewhere.
  const price = salon.monthly_minor;
  const currency = salon.plan_currency;
  const { t } = useTranslation();
  const toast = useToast();
  const action = useAdminPlanAction();
  const [months, setMonths] = useState<number>(salon.requested_months ?? 1);
  const [amount, setAmount] = useState<number | null>(price * (salon.requested_months ?? 1));
  const [note, setNote] = useState('');

  return (
    <View style={styles.sheet}>
      <PillTabs<string>
        items={MONTHS.map((m) => ({ key: String(m), label: t(`plan.monthsOption.${m}` as 'plan.monthsOption.1') }))}
        value={String(months)}
        onChange={(v) => {
          setMonths(Number(v));
          setAmount(price * Number(v));
        }}
        testID="admin-months"
      />
      <MoneyInput label={t('admin.amount')} value={amount} onChange={setAmount} currency={currency} testID="admin-amount" />
      <TextField label={t('admin.note')} placeholder={t('admin.notePlaceholder')} value={note} onChangeText={setNote} testID="admin-note" />
      <FormError error={action.error} />
      <Button
        label={t('admin.recordPayment', { total: formatMoney(amount ?? 0, currency) })}
        loading={action.isPending}
        disabled={amount === null}
        onPress={() =>
          action.mutate(
            { business: salon.business_id, action: 'activate', months, amount_minor: amount ?? 0, note },
            {
              onSuccess: () => {
                toast(t('admin.activated', { name: salon.name }));
                onDone();
              },
            },
          )
        }
        testID="admin-activate"
      />
      {salon.active ? (
        <Button
          label={t('admin.endPlan')}
          variant="ghost"
          disabled={note.trim().length < 3}
          onPress={() =>
            action.mutate(
              { business: salon.business_id, action: 'end', note },
              {
                onSuccess: () => {
                  toast(t('admin.ended', { name: salon.name }));
                  onDone();
                },
              },
            )
          }
          testID="admin-end"
        />
      ) : null}
      <Text variant="small" color="textSecondary">
        {t('admin.hint')}
      </Text>
    </View>
  );
}

/** Close the salon for good: its logins switched off and its plan ended, every record kept. */
function CloseSalon({ salon, onDone }: { salon: AdminSalon; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const close = useCloseSalon();
  const [note, setNote] = useState('');
  return (
    <View style={styles.sheet}>
      <Text variant="bodyStrong">{t('console.salons.close')}</Text>
      <Text variant="small" color="textSecondary">
        {t('console.salons.closeHint')}
      </Text>
      <TextField label={t('console.salons.closeReason')} value={note} onChangeText={setNote} maxLength={200} testID="console-close-reason" />
      <FormError error={close.error} />
      <Button
        label={t('console.salons.close')}
        icon="lock"
        variant="danger"
        disabled={note.trim().length < 3}
        loading={close.isPending}
        onPress={() =>
          close.mutate(
            { business: salon.business_id, note },
            {
              onSuccess: () => {
                toast(t('console.salons.closedToast', { name: salon.name }));
                onDone();
              },
            },
          )
        }
        testID="console-close-salon"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  badges: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  sheet: { gap: spacing.lg },
});
