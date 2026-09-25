/**
 * Who is signed in, for which business and branch. Everything role- or branch-dependent reads
 * this. It follows the branch row live, so an owner switching gents ↔ ladies re-themes every
 * signed-in device, and a disabled login is signed out.
 */
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import type { Tables } from '@/lib/database.types';
import { errorCode, type ErrorCode } from '@/lib/errors';
import type { BranchRules, Role } from '@/lib/permissions';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

export type Member = Tables<'members'>;
export type Business = Tables<'businesses'>;
export type Branch = Tables<'branches'>;

export type SessionStatus = 'loading' | 'signedOut' | 'needsSetup' | 'ready' | 'error';

interface SessionValue {
  status: SessionStatus;
  session: Session | null;
  member: Member | null;
  business: Business | null;
  branch: Branch | null;
  role: Role | null;
  employeeId: string | null;
  rules: BranchRules;
  /** Why the last session ended or failed to load (disabled login, no internet…). */
  notice: ErrorCode | null;
  clearNotice: () => void;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

interface Loaded {
  member: Member | null;
  business: Business | null;
  branch: Branch | null;
  /** The signed-in person's employee row (barbers, stylists, cashiers), if any. */
  employeeId: string | null;
}

async function loadMembership(userId: string): Promise<Loaded> {
  const { data: member, error } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', userId)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!member) return { member: null, business: null, branch: null, employeeId: null };
  if (!member.active) return { member, business: null, branch: null, employeeId: null };

  const [{ data: business, error: bError }, { data: branches, error: brError }, { data: employee }] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', member.business_id).single(),
    supabase.from('branches').select('*').eq('business_id', member.business_id).order('created_at'),
    supabase.from('employees').select('id').eq('member_id', member.id).maybeSingle(),
  ]);
  if (bError) throw bError;
  if (brError) throw brError;
  const branch = branches?.find((b) => b.id === member.default_branch_id) ?? branches?.[0] ?? null;
  return { member, business, branch, employeeId: employee?.id ?? null };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [loaded, setLoaded] = useState<Loaded>({ member: null, business: null, branch: null, employeeId: null });
  const [notice, setNotice] = useState<ErrorCode | null>(null);
  const userId = session?.user.id ?? null;
  const loadedFor = useRef<string | null>(null);
  /**
   * Bumped whenever the signed-in person changes (sign-out, another sign-in) and on every load.
   * A membership load that finishes after that belongs to the past and is dropped — otherwise a
   * slow answer could put a signed-out device, or the next person on a shared phone, into the
   * previous person's salon.
   */
  const generation = useRef(0);
  const currentUser = useRef<string | null>(null);

  const signOut = useCallback(async () => {
    // The audit row is sent with the current token; the local session is cleared right away so a
    // closed app or a slow network can never leave this device signed in.
    const logged = supabase.rpc('log_access', { p_event: 'sign_out', p_device: Platform.OS }).then(
      () => undefined,
      () => undefined,
    );
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    queryClient.clear();
    await logged;
  }, []);

  const reload = useCallback(async () => {
    if (!userId) return;
    const mine = ++generation.current;
    const stale = () => mine !== generation.current || currentUser.current !== userId;
    try {
      const next = await loadMembership(userId);
      if (stale()) return;
      if (next.member && !next.member.active) {
        setNotice('disabled');
        await signOut();
        return;
      }
      setLoaded(next);
      setStatus(next.member ? 'ready' : 'needsSetup');
    } catch (error) {
      if (stale()) return;
      setNotice(errorCode(error));
      setStatus('error');
    }
  }, [userId, signOut]);

  useEffect(() => {
    const follow = (next: Session | null) => {
      const user = next?.user.id ?? null;
      if (user !== currentUser.current) {
        currentUser.current = user;
        generation.current++;
      }
      setSession(next);
    };
    supabase.auth.getSession().then(({ data }) => {
      follow(data.session);
      if (!data.session) setStatus('signedOut');
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      follow(next);
      if (!next) {
        loadedFor.current = null;
        setLoaded({ member: null, business: null, branch: null, employeeId: null });
        setStatus('signedOut');
      }
      if (event === 'SIGNED_IN') {
        supabase.rpc('log_access', { p_event: 'sign_in', p_device: Platform.OS }).then(
          () => undefined,
          () => undefined,
        );
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (userId && loadedFor.current !== userId) {
      loadedFor.current = userId;
      setStatus('loading');
      void reload();
    }
  }, [userId, reload]);

  // Follow the branch (salon type, settings) and my own member row (disabled) live.
  const branchId = loaded.branch?.id;
  const memberId = loaded.member?.id;
  useEffect(() => {
    if (!branchId || !memberId) return;
    const channel = supabase
      .channel(`session-${memberId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'branches', filter: `id=eq.${branchId}` },
        (payload) =>
          setLoaded((prev) => (prev.branch?.id === branchId ? { ...prev, branch: { ...prev.branch, ...(payload.new as Branch) } } : prev)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'members', filter: `id=eq.${memberId}` },
        () => void reload())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [branchId, memberId, reload]);

  const value = useMemo<SessionValue>(() => {
    const settings = (loaded.branch?.settings ?? {}) as Record<string, unknown>;
    return {
      status,
      session,
      ...loaded,
      role: (loaded.member?.role as Role | undefined) ?? null,
      rules: { staffCanSell: settings.staff_can_sell === true },
      notice,
      clearNotice: () => setNotice(null),
      reload,
      signOut,
    };
  }, [status, session, loaded, notice, reload, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

/** For screens inside the signed-in area, where a business and branch always exist. */
export function useWorkspace() {
  const s = useSession();
  if (!s.member || !s.business || !s.branch || !s.role) {
    throw new Error('useWorkspace used outside the signed-in area');
  }
  return {
    member: s.member,
    business: s.business,
    branch: s.branch,
    role: s.role,
    rules: s.rules,
    employeeId: s.employeeId,
  };
}
