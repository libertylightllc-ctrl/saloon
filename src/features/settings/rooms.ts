/**
 * The salon's rooms (2026-10-24): treatment and massage rooms that bookings of room services need (ladies salons and
 * beauty & wellness studios). The owner adds, renames and stops using them; a room is never deleted.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keys } from '@/features/live/useLiveSync';
import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type Room = Tables<'rooms'>;

/** Every room of the branch, in use first. */
export function useBranchRooms(branchId: string) {
  return useQuery({
    queryKey: ['rooms', branchId, 'all'],
    queryFn: async (): Promise<Room[]> => {
      const { data, error } = await supabase.from('rooms').select('*').eq('branch_id', branchId).order('active', { ascending: false }).order('name');
      if (error) throw error;
      return data;
    },
  });
}

/** Adds a room (`room` null), renames one, or stops or starts using it. */
export function useSaveRoom(branchId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ room, name, active = true }: { room: string | null; name: string; active?: boolean }) => {
      // null adds a room (the generated types cannot say a function argument may be null).
      const { data, error } = await supabase.rpc('save_room', { p_branch: branchId, p_room: room as string, p_name: name, p_active: active });
      if (error) throw error;
      return data;
    },
    // The rooms list here and the booking screen's room chips.
    onSuccess: () => client.invalidateQueries({ queryKey: keys.rooms(branchId) }),
  });
}
