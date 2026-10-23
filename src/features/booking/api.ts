/**
 * The salon's online booking link (owner, 2026-10-20): the public page's data, free times, booking and the customer's
 * own booking (open to visitors, migration 55), and the owner's switch. No account and no download for the customer.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { brand } from '@/config/brand';
import { useSession } from '@/features/auth/session';
import type { BusinessDate } from '@/lib/dates';
import { asJson, supabase } from '@/lib/supabase';
import type { Mode } from '@/theme';

export interface BookingSalon {
  business_name: string;
  branch_name: string;
  mode: Mode;
  address: string | null;
  phone: string | null;
  logo_path: string | null;
  /** The booking page's cover photo and Instagram handle (website brief 5.1); not on a customer's booking page. */
  cover_path?: string | null;
  instagram?: string | null;
  currency: string;
  timezone: string;
  country_code: string;
  cancel_cutoff_hours: number;
}

export interface BookingPage {
  salon: BookingSalon & { open_days: number[]; today: BusinessDate; tax_added: boolean; tax_name: string };
  categories: { id: string; name: string }[];
  services: { id: string; category_id: string; name: string; price_minor: number; duration_min: number | null }[];
  staff: { id: string; name: string }[];
}

export interface MyBooking {
  status: 'booked' | 'waiting' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  scheduled_at: string;
  duration_min: number;
  customer_name: string | null;
  staff_name: string | null;
  services: { name: string; price_minor: number }[];
  can_cancel: boolean;
  salon: BookingSalon & { slug: string | null };
}

/** saloqo.com/b/<link>. */
export const bookingUrl = (slug: string) => `${brand.website}/b/${slug}`;

/** The page behind a link; null when the link is unknown or switched off. */
export function useBookingPage(slug: string) {
  return useQuery({
    queryKey: ['booking-page', slug],
    queryFn: async (): Promise<BookingPage | null> => {
      const { data, error } = await supabase.rpc('public_booking_page', { p_slug: slug });
      if (error) throw error;
      return (data as unknown as BookingPage | null) ?? null;
    },
  });
}

/** Free start times on a day for the picked services, with anyone (null) or one person. */
export function useBookingSlots(slug: string, date: BusinessDate | null, serviceIds: string[], employeeId: string | null) {
  return useQuery({
    enabled: Boolean(date) && serviceIds.length > 0,
    queryKey: ['booking-slots', slug, date, [...serviceIds].sort().join(','), employeeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('public_booking_slots', {
        p_slug: slug,
        p_date: date!,
        p_services: serviceIds,
        // null: anyone (the generated types cannot say a function argument may be null).
        p_employee: employeeId as string,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface BookInput {
  service_ids: string[];
  employee_id: string | null;
  starts_at: string;
  name: string;
  phone: string;
  notes: string;
}

export function useBook(slug: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: BookInput) => {
      const { data, error } = await supabase.rpc('public_book', { p: asJson({ slug, ...input }) });
      if (error) throw error;
      return data as unknown as { token: string; scheduled_at: string };
    },
    // A time just taken by someone else disappears from the list.
    onError: () => client.invalidateQueries({ queryKey: ['booking-slots', slug] }),
  });
}

/** The customer's own booking, behind the token in its link; null for an unknown link. */
export function useMyBooking(token: string) {
  return useQuery({
    queryKey: ['my-booking', token],
    queryFn: async (): Promise<MyBooking | null> => {
      if (!/^[A-Za-z0-9_-]{24}$/.test(token)) return null;
      const { data, error } = await supabase.rpc('public_booking', { p_token: token });
      if (error) throw error;
      return (data as unknown as MyBooking | null) ?? null;
    },
  });
}

export function useCancelBooking(token: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('public_booking_cancel', { p_token: token });
      if (error) throw error;
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['my-booking', token] }),
  });
}

/** Owner: the booking page on or off, and its link (made from the salon's name when none is given). */
export function useSetOnlineBooking(branchId: string) {
  const { reload } = useSession();
  return useMutation({
    mutationFn: async (input: { on: boolean; slug?: string }) => {
      const { data, error } = await supabase.rpc('set_online_booking', { p_branch: branchId, p_on: input.on, p_slug: input.slug });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => reload(),
  });
}
