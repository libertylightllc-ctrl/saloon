-- Platform console, Part B (owner's brief, 24 Nov 2026), B3 "Active salons": a salon is active when someone signed in,
-- opened the app or recorded anything. Signing in alone undercounts: a phone stays signed in for weeks. The app now
-- says when a login opens it (at most once an hour) and in which language, which the console also uses to write to
-- an owner in their own language (B6). Kept apart from members, whose every change is broadcast to the salon's
-- devices.

create table public.member_seen (
  member_id uuid primary key references public.members (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  last_seen_at timestamptz not null,
  language text check (language in ('en', 'ar', 'hi', 'ur', 'es', 'fr', 'pt'))
);
create index member_seen_business_idx on public.member_seen (business_id, last_seen_at desc);
alter table public.member_seen enable row level security;
revoke all on public.member_seen from anon, authenticated;
-- No policies: written by touch_seen(), read by the console's functions.

-- The signed-in person opened the app on this salon: at most one write an hour, unless the language changed.
create function public.touch_seen(p_business uuid, p_language text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_language text := case when p_language in ('en', 'ar', 'hi', 'ur', 'es', 'fr', 'pt') then p_language end;
begin
  insert into member_seen (member_id, business_id, last_seen_at, language)
  select m.id, m.business_id, now(), v_language
  from members m where m.user_id = auth.uid() and m.business_id = p_business and m.active
  on conflict (member_id) do update
    set last_seen_at = now(), language = coalesce(excluded.language, member_seen.language)
    where member_seen.last_seen_at < now() - interval '1 hour'
       or member_seen.language is distinct from coalesce(excluded.language, member_seen.language);
end;
$$;
revoke execute on function public.touch_seen(uuid, text) from public, anon;
grant execute on function public.touch_seen(uuid, text) to authenticated;

-- When the salon was last used: a sign-in, the app opened, or anything recorded (sales, bookings, clock-ins, changes).
create index audit_log_business_idx on public.audit_log (business_id, created_at desc);

create function public.salon_last_active(p_business uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select greatest(
    (select max(u.last_sign_in_at) from members m join auth.users u on u.id = m.user_id where m.business_id = p_business),
    (select max(s.last_seen_at) from member_seen s where s.business_id = p_business),
    (select max(a.created_at) from audit_log a where a.business_id = p_business))
$$;
revoke execute on function public.salon_last_active(uuid) from public, anon, authenticated;
