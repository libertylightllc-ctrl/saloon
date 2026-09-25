import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keys } from '@/features/live/useLiveSync';
import type { Tables } from '@/lib/database.types';
import { businessDate, shiftBusinessDate, type BusinessDate } from '@/lib/dates';
import { asJson, supabase } from '@/lib/supabase';

export type Appointment = Tables<'appointments'> & {
  appointment_services: Pick<Tables<'appointment_services'>, 'id' | 'service_id' | 'name_snapshot' | 'price_minor' | 'duration_min'>[];
  employees: Pick<Tables<'employees'>, 'full_name' | 'colour'> | null;
  rooms: Pick<Tables<'rooms'>, 'name'> | null;
};
export type Employee = Tables<'employees'>;
export type Room = Tables<'rooms'>;
export type QueueDay = 'today' | 'tomorrow' | 'week';

export function dayRange(day: QueueDay, timeZone: string): [BusinessDate, BusinessDate] {
  const today = businessDate(new Date(), timeZone);
  if (day === 'today') return [today, today];
  if (day === 'tomorrow') return [shiftBusinessDate(today, 1), shiftBusinessDate(today, 1)];
  return [today, shiftBusinessDate(today, 6)];
}

export function useAppointments(branchId: string, timeZone: string, day: QueueDay) {
  const [from, to] = dayRange(day, timeZone);
  return useQuery({
    queryKey: [...keys.appointments(branchId), from, to],
    queryFn: async (): Promise<Appointment[]> => {
      const { data, error } = await supabase
        .from('appointments')
        .select(
          '*, appointment_services(id, service_id, name_snapshot, price_minor, duration_min), employees(full_name, colour), rooms(name)',
        )
        .eq('branch_id', branchId)
        .gte('business_date', from)
        .lte('business_date', to)
        .order('scheduled_at');
      if (error) throw error;
      return data as Appointment[];
    },
  });
}

export function useAppointment(branchId: string, id: string | undefined) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: [...keys.appointments(branchId), 'one', id],
    queryFn: async (): Promise<Appointment> => {
      const { data, error } = await supabase
        .from('appointments')
        .select(
          '*, appointment_services(id, service_id, name_snapshot, price_minor, duration_min), employees(full_name, colour), rooms(name)',
        )
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as Appointment;
    },
  });
}

export function useEmployees(branchId: string) {
  return useQuery({
    queryKey: ['employees', branchId],
    queryFn: async (): Promise<Employee[]> => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('branch_id', branchId)
        .eq('active', true)
        .neq('role_title', 'cashier')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });
}

export function useRooms(branchId: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: keys.rooms(branchId),
    queryFn: async (): Promise<Room[]> => {
      const { data, error } = await supabase.from('rooms').select('*').eq('branch_id', branchId).eq('active', true).order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useAvailableSlots(
  branchId: string,
  date: BusinessDate,
  duration: number,
  employeeId: string | null,
  enabled = true,
) {
  return useQuery({
    enabled,
    queryKey: ['slots', branchId, date, duration, employeeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('available_slots', {
        p_branch: branchId,
        p_date: date,
        p_duration: duration,
        p_employee: employeeId ?? undefined,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface NewAppointment {
  kind: 'walk_in' | 'booking';
  customer_id?: string | null;
  guest_name?: string | null;
  service_ids: string[];
  employee_id?: string | null;
  room_id?: string | null;
  scheduled_at?: string | null;
  notes?: string | null;
  deposit_minor?: number;
  deposit_method?: 'cash' | 'card' | 'wallet' | null;
}

function useInvalidateQueue(branchId: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: keys.appointments(branchId) });
    void client.invalidateQueries({ queryKey: keys.dashboard(branchId) });
  };
}

export function useCreateAppointment(branchId: string) {
  const invalidate = useInvalidateQueue(branchId);
  return useMutation({
    mutationFn: async (input: NewAppointment) => {
      const { data, error } = await supabase.rpc('create_appointment', { p: asJson({ ...input, branch_id: branchId }) });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export type QueueAction = 'checkIn' | 'start' | 'noShow' | 'cancel';

export function useQueueAction(branchId: string) {
  const invalidate = useInvalidateQueue(branchId);
  return useMutation({
    mutationFn: async ({ action, id, reason }: { action: QueueAction; id: string; reason?: string }) => {
      const result =
        action === 'checkIn'
          ? await supabase.rpc('check_in', { p_id: id })
          : action === 'start'
            ? await supabase.rpc('start_service', { p_id: id })
            : action === 'noShow'
              ? await supabase.rpc('mark_no_show', { p_id: id })
              : await supabase.rpc('cancel_appointment', { p_id: id, p_reason: reason ?? '' });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: invalidate,
  });
}
