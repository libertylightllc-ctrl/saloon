/**
 * PIN quick-switch on a shared counter device (01-PRODUCT §2.1). People who signed in on this device and set
 * a PIN are remembered here with their session; switching checks the PIN on the server first, then swaps the
 * session. Signing out forgets the person on this device.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppError } from '@/lib/errors';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

const KEY = 'salon.quickSwitch.v1';

export interface Remembered {
  member_id: string;
  business_id: string;
  name: string;
  role: string;
  access_token: string;
  refresh_token: string;
}

async function readAll(): Promise<Record<string, Remembered>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, Remembered>) : {};
  } catch {
    return {};
  }
}

async function writeAll(all: Record<string, Remembered>) {
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}

export async function remember(entry: Remembered): Promise<void> {
  const all = await readAll();
  all[entry.member_id] = entry;
  await writeAll(all);
}

export async function forget(memberId: string): Promise<void> {
  const all = await readAll();
  if (!(memberId in all)) return;
  delete all[memberId];
  await writeAll(all);
}

/** Everyone remembered on this device for the salon, except me. */
export function useRemembered(businessId: string, memberId: string) {
  return useQuery({
    queryKey: ['quickSwitch', businessId, memberId],
    // Device storage, not the server: read it fresh each time the sheet opens.
    refetchOnMount: 'always',
    queryFn: async () =>
      Object.values(await readAll())
        .filter((r) => r.business_id === businessId && r.member_id !== memberId)
        .sort((a, b) => a.name.localeCompare(b.name)),
  });
}

export function useHasPin(businessId: string) {
  return useQuery({
    queryKey: ['quickSwitch', businessId, 'hasPin'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('has_pin', { p_business: businessId });
      if (error) throw error;
      return data === true;
    },
  });
}

export function sessionEntry(
  session: Session,
  member: { id: string; business_id: string; display_name: string; role: string },
): Remembered {
  return {
    member_id: member.id,
    business_id: member.business_id,
    name: member.display_name,
    role: member.role,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  };
}

export function useSetPin(businessId: string, onSaved: () => Promise<void>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (pin: string) => {
      const { error } = await supabase.rpc('set_my_pin', { p_business: businessId, p_pin: pin });
      if (error) throw error;
      await onSaved();
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['quickSwitch', businessId] }),
  });
}

/**
 * Switch to a remembered person: their PIN is checked on the server, my session is kept (so I can switch
 * back), the cached data is dropped (it was read with my role), and their session is restored.
 */
export async function switchTo(target: Remembered, pin: string, me: Remembered | null): Promise<void> {
  const { data, error } = await supabase.rpc('check_pin', { p_member: target.member_id, p_pin: pin });
  if (error) throw error;
  if (data !== true) throw new AppError('wrong_pin');
  if (me) await remember(me);
  queryClient.clear();
  const { error: restoreError } = await supabase.auth.setSession({
    access_token: target.access_token,
    refresh_token: target.refresh_token,
  });
  if (restoreError) {
    await forget(target.member_id);
    // Still signed in as me: put my session back.
    if (me) await supabase.auth.setSession({ access_token: me.access_token, refresh_token: me.refresh_token });
    throw new AppError('switch_expired');
  }
}
