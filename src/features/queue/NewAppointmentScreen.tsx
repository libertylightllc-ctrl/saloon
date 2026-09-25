import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useWorkspace } from '@/features/auth/session';
import { useCatalog } from '@/features/catalog/api';
import { CustomerPicker, type PickedCustomer } from '@/features/customers/CustomerPicker';
import { useTerms } from '@/features/mode/useTerms';
import { businessDate, shiftBusinessDate } from '@/lib/dates';
import { formatMoney, sum, type Minor } from '@/lib/money';
import { spacing } from '@/theme';
import {
  Button,
  Chip,
  DateStrip,
  FormError,
  HeaderBand,
  MoneyInput,
  QueryState,
  Screen,
  SegmentTabs,
  Text,
  TextField,
  TimeSlotGrid,
  useToast,
} from '@/ui';

import { useAvailableSlots, useCreateAppointment, useEmployees, useRooms } from './api';

type Kind = 'walk_in' | 'booking';
type Method = 'cash' | 'card' | 'wallet';

export function NewAppointmentScreen() {
  const { t } = useTranslation();
  const terms = useTerms();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ kind?: string; customer?: string; customerName?: string }>();
  const { business, branch } = useWorkspace();
  const settings = branch.settings as Record<string, unknown>;
  const today = businessDate(new Date(), business.timezone);

  const [kind, setKind] = useState<Kind>(params.kind === 'booking' ? 'booking' : 'walk_in');
  const [customer, setCustomer] = useState<PickedCustomer | null>(
    params.customer ? { id: params.customer, name: params.customerName ?? '' } : null,
  );
  const [guestName, setGuestName] = useState('');
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState<string | undefined>();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [deposit, setDeposit] = useState<Minor | null>(Number(settings.default_deposit_minor ?? 0) || null);
  const [method, setMethod] = useState<Method>('cash');
  const [notes, setNotes] = useState('');

  const catalog = useCatalog(business.id);
  const employees = useEmployees(branch.id);
  const services = (catalog.data?.services ?? []).filter((s) => s.status === 'active');
  const chosen = services.filter((s) => serviceIds.includes(s.id));
  const duration = sum(chosen.map((s) => s.duration_min + s.buffer_min)) || 30;
  const needsRoom = branch.mode === 'ladies' && chosen.some((s) => s.requires_room);
  const rooms = useRooms(branch.id, needsRoom);
  const booking = kind === 'booking';
  const slots = useAvailableSlots(branch.id, date, duration, employeeId, booking);
  const create = useCreateAppointment(branch.id);
  // The exact instant of the chosen slot (slots after midnight fall on the next calendar day).
  const startsAt = slots.data?.find((s) => s.slot === time)?.starts_at ?? null;
  const ready =
    !create.isPending &&
    (!booking || (chosen.length > 0 && Boolean(startsAt))) &&
    (!needsRoom || Boolean(roomId)) &&
    (!booking || !deposit || deposit >= 0);

  const submit = () => {
    create.mutate(
      {
        kind,
        customer_id: customer?.id ?? null,
        guest_name: customer ? null : guestName.trim() || null,
        service_ids: serviceIds,
        employee_id: employeeId,
        room_id: needsRoom ? roomId : null,
        scheduled_at: booking ? startsAt : null,
        notes: notes.trim() || null,
        deposit_minor: booking ? (deposit ?? 0) : 0,
        deposit_method: booking && deposit ? method : null,
      },
      {
        onSuccess: () => {
          toast(t(booking ? 'queue.toast.booked' : 'queue.toast.walkIn', { name: customer?.name || guestName || t('queue.guest') }));
          router.back();
        },
      },
    );
  };

  return (
    <Screen
      header={<HeaderBand title={t(booking ? 'queue.newBooking' : 'queue.newWalkIn')} onBack />}
      footer={
        <Button
          label={t(booking ? 'queue.book' : 'queue.addToQueue')}
          onPress={submit}
          loading={create.isPending}
          disabled={!ready}
          testID="appointment-submit"
        />
      }
    >
      <View style={styles.body}>
        <SegmentTabs<Kind>
          items={[
            { key: 'walk_in', label: t('queue.walkIn') },
            { key: 'booking', label: t('queue.appointment') },
          ]}
          value={kind}
          onChange={setKind}
          testID="appt-kind"
        />

        <Section title={t('sale.customer')}>
          <CustomerPicker value={customer} onChange={setCustomer} guestName={guestName} onGuestName={setGuestName} />
        </Section>

        <Section title={t('queue.services')}>
          <QueryState query={catalog}>
            {() => (
              <View style={styles.wrap}>
                {services.map((s) => {
                  const on = serviceIds.includes(s.id);
                  return (
                    <Chip
                      key={s.id}
                      label={`${s.name} · ${formatMoney(s.price_minor)}`}
                      selected={on}
                      onPress={() => setServiceIds(on ? serviceIds.filter((id) => id !== s.id) : [...serviceIds, s.id])}
                      testID={`pick-service-${s.name}`}
                    />
                  );
                })}
              </View>
            )}
          </QueryState>
        </Section>

        <Section title={terms.staff}>
          <View style={styles.wrap}>
            <Chip label={terms.anyStaff} selected={employeeId === null} onPress={() => setEmployeeId(null)} />
            {(employees.data ?? []).map((e) => (
              <Chip
                key={e.id}
                label={e.full_name}
                selected={employeeId === e.id}
                onPress={() => setEmployeeId(e.id)}
                testID={`staff-${e.full_name}`}
              />
            ))}
          </View>
        </Section>

        {needsRoom ? (
          <Section title={t('queue.room')}>
            <View style={styles.wrap}>
              {(rooms.data ?? []).map((r) => (
                <Chip key={r.id} label={r.name} selected={roomId === r.id} onPress={() => setRoomId(r.id)} testID={`room-${r.name}`} />
              ))}
            </View>
          </Section>
        ) : null}

        {booking ? (
          <>
            <Section title={t('queue.date')}>
              <DateStrip
                dates={Array.from({ length: 14 }, (_, i) => shiftBusinessDate(today, i))}
                value={date}
                onChange={(d) => {
                  setDate(d);
                  setTime(undefined);
                }}
              />
            </Section>
            <Section title={t('queue.time')}>
              <QueryState
                query={slots}
                isEmpty={(data) => data.every((s) => !s.available)}
                empty={<Text color="textSecondary">{t('queue.noSlots')}</Text>}
              >
                {(data) => (
                  <TimeSlotGrid
                    slots={data.map((s) => ({ time: s.slot, available: s.available }))}
                    value={time}
                    onChange={setTime}
                  />
                )}
              </QueryState>
            </Section>
            <Section title={t('queue.deposit')}>
              <MoneyInput label={t('queue.depositAmount')} value={deposit} onChange={setDeposit} testID="deposit" />
              {deposit ? (
                <SegmentTabs<Method>
                  items={(['cash', 'card', 'wallet'] as const).map((key) => ({ key, label: t(`sale.methods.${key}`) }))}
                  value={method}
                  onChange={setMethod}
                  testID="deposit-method"
                />
              ) : null}
            </Section>
          </>
        ) : null}

        <TextField label={t('queue.notes')} value={notes} onChangeText={setNotes} multiline />
        {chosen.length > 0 ? (
          <Text color="textSecondary">
            {t('queue.summaryLine', { minutes: duration, amount: formatMoney(sum(chosen.map((s) => s.price_minor))) })}
          </Text>
        ) : null}
        <FormError error={create.error} />
      </View>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="bodyStrong">{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xl },
  section: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
