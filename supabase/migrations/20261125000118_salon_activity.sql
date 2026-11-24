-- Platform console, Part B (owner's brief, 24 Nov 2026).
-- B3 Active salons: of the open salons (test and closed left out), how many were used in the last 7 and 30 days:
--    someone signed in, opened the app, or recorded anything (migration 115).
-- B7 At risk: salons that are paying, free, pilot or free for good with nothing for 14 days or more, the quietest
--    first (never used counts as quietest), at most p_limit of them. Ended salons are not "at risk": they have
--    already stopped.

create function public.admin_salon_activity(p_limit integer default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  with open_salons as materialized (
    select b.id, b.name, b.code, b.country_code, b.timezone,
           public.salon_status(b.closed_at, s.access_type, s.free_until, s.paid_until, public.business_today(b.id)) as status,
           public.salon_last_active(b.id) as last_active
    from businesses b left join subscriptions s on s.business_id = b.id
    where not b.is_demo and b.closed_at is null
      and not exists (select 1 from test_salons t where t.business_id = b.id and t.test)
  ), risk as (
    select * from open_salons
    where status in ('paid', 'free', 'pilot', 'comp') and (last_active is null or last_active < now() - interval '14 days')
  )
  select jsonb_build_object(
    'open', (select count(*) from open_salons),
    'active_7d', (select count(*) from open_salons where last_active > now() - interval '7 days'),
    'active_30d', (select count(*) from open_salons where last_active > now() - interval '30 days'),
    'at_risk_count', (select count(*) from risk),
    'at_risk', coalesce((select jsonb_agg(jsonb_build_object('business_id', id, 'name', name, 'code', code, 'status', status,
                                                             'country_code', country_code, 'timezone', timezone, 'last_active', last_active)
                                          order by last_active nulls first, name)
                         from (select * from risk order by last_active nulls first, name limit greatest(p_limit, 0)) r), '[]'))
    into v;
  return v;
end;
$$;
revoke execute on function public.admin_salon_activity(integer) from public, anon;
grant execute on function public.admin_salon_activity(integer) to authenticated;
