-- Owner, 8 Nov 2026: an "Ended" status in the platform console for salons whose free, paid or pilot period is over and
-- that are not closed. Each salon is in exactly one group, so the Overview's groups add up to its salon total:
--   closed (closed for good) · free for good · paid (paid until today or later) · pilot (pilot period running) ·
--   free (any other free period running) · ended (none of these: its last period is over).
-- A salon both paid and in a free period counts as paid. Only the console's two read functions change: who can use
-- the app, plans, pilot places and billing are as before.

-- 1. The one rule, for both read functions.
create function public.salon_status(p_closed timestamptz, p_access text, p_free date, p_paid date, p_today date)
returns text
language sql immutable parallel safe set search_path = public as $$
  select case
    when p_closed is not null then 'closed'
    when p_access = 'comp' then 'comp'
    when p_paid >= p_today then 'paid'
    when p_free >= p_today then case when p_access = 'pilot' then 'pilot' else 'free' end
    else 'ended'
  end
$$;

-- 2. The Overview: as migration 76, with the salon groups from the rule above and the ended ones added. "salons" is
--    still the open salons; closed ones are counted apart, and test salons are left out of all of it.
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', now() at time zone 'Asia/Dubai')::date;
  v_groups jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select jsonb_build_object(
           'salons', count(*) filter (where st <> 'closed'),
           'salons_closed', count(*) filter (where st = 'closed'),
           'salons_plan_active', count(*) filter (where st = 'paid'),
           'salons_trial', count(*) filter (where st = 'free'),
           'salons_pilot', count(*) filter (where st = 'pilot'),
           'salons_comp', count(*) filter (where st = 'comp'),
           'salons_ended', count(*) filter (where st = 'ended'))
    into v_groups
    from (select public.salon_status(b.closed_at, s.access_type, s.free_until, s.paid_until, public.business_today(b.id)) as st
          from businesses b left join subscriptions s on s.business_id = b.id
          where not b.is_demo and not public.is_test_salon(b.id)) g;
  return v_groups || jsonb_build_object(
    'salons_test', (select count(*) from businesses where not is_demo and public.is_test_salon(id)),
    'billing_enabled', (select billing_enabled from platform_settings),
    'pilot_places_left', (select greatest(pilot_max_salons - public.pilot_active_count(), 0) from platform_settings),
    'pilot_applications_new', (select count(*) from pilot_applications where status = 'new'),
    'plan_requests_open', (select count(distinct e.business_id) from plan_events e where e.kind = 'request'
                             and not public.is_test_salon(e.business_id)
                             and not exists (select 1 from plan_events a where a.business_id = e.business_id
                                             and a.kind in ('activate', 'end') and a.created_at > e.created_at)),
    'branches', (select count(*) from branches br join businesses b on b.id = br.business_id
                 where not b.is_demo and not public.is_test_salon(b.id)),
    'accounts', (select count(*) from auth.users u where not public.is_test_account(u.id)),
    'owners', (select count(*) from members m join businesses b on b.id = m.business_id
               where m.role = 'owner' and not b.is_demo and not public.is_test_salon(b.id)),
    'staff_logins', (select count(*) from members m join businesses b on b.id = m.business_id
                     where m.role <> 'owner' and not b.is_demo and not public.is_test_salon(b.id)),
    'no_salon', (select count(*) from auth.users u where not exists (select 1 from members m where m.user_id = u.id)),
    'signups_7d', (select count(*) from auth.users u where u.created_at > now() - interval '7 days' and not public.is_test_account(u.id)),
    'signups_30d', (select count(*) from auth.users u where u.created_at > now() - interval '30 days' and not public.is_test_account(u.id)),
    'signed_in_7d', (select count(*) from auth.users u where u.last_sign_in_at > now() - interval '7 days' and not public.is_test_account(u.id)),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('code', country_code, 'salons', n) order by n desc)
                           from (select country_code, count(*) as n from businesses
                                 where not is_demo and not public.is_test_salon(id) group by 1) c), '[]'),
    'sales_month', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'count', n, 'total_minor', total) order by total desc)
                             from (select b.currency, count(*) as n, sum(s.total_minor) as total from sales s
                                   join businesses b on b.id = s.business_id
                                   where not b.is_demo and not public.is_test_salon(b.id) and s.business_date >= v_month
                                   group by 1) x), '[]'),
    'plan_income', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'total_minor', total) order by total desc)
                             from (select coalesce(e.currency, 'AED') as currency, sum(e.amount_minor) as total from plan_events e
                                   where e.kind = 'activate' and e.amount_minor > 0 and not public.is_test_salon(e.business_id)
                                   group by 1) y), '[]')
  );
end;
$$;

-- 3. The Salons list: as migration 70, with each salon's status and, for an ended one, the day its last period ended.
--    A new column needs the function made again, so its access is set again as before.
drop function public.admin_salons();
create function public.admin_salons()
 RETURNS TABLE(business_id uuid, name text, code text, created_at timestamp with time zone, owner_name text,
               owner_email text, branches integer, paid_until date, active boolean, requested_at timestamp with time zone,
               requested_months integer, request_note text, country_code text, timezone text, people integer,
               monthly_minor bigint, plan_currency text, trial boolean, access_type text, free_until date,
               pilot_code text, admin_note text, staff integer, last_active timestamp with time zone,
               status text, ended_on date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select b.id, b.name, b.code, b.created_at, m.display_name, u.email::text,
           (select count(*)::int from branches br where br.business_id = b.id),
           s.paid_until,
           b.closed_at is null
             and (not ps.billing_enabled
                  or coalesce(s.access_type = 'comp' or s.free_until >= d.today or s.paid_until >= d.today, false)),
           r.created_at, r.months, r.note, b.country_code, b.timezone, q.people, q.monthly_minor, q.currency,
           coalesce(s.access_type = 'trial', false), s.access_type, s.free_until, s.pilot_code, s.admin_note,
           (select count(*)::int from members mm where mm.business_id = b.id and mm.active and mm.role <> 'owner'),
           (select max(au.last_sign_in_at) from members mm join auth.users au on au.id = mm.user_id
            where mm.business_id = b.id),
           st.status,
           case when st.status = 'ended' then greatest(s.paid_until, s.free_until) end
    from businesses b
    cross join platform_settings ps
    cross join lateral (select (now() at time zone coalesce(b.timezone, 'Asia/Dubai'))::date as today) d
    left join lateral (select * from members mm where mm.business_id = b.id and mm.role = 'owner'
                       order by mm.created_at limit 1) m on true
    left join auth.users u on u.id = m.user_id
    left join subscriptions s on s.business_id = b.id
    cross join lateral (select public.salon_status(b.closed_at, s.access_type, s.free_until, s.paid_until, d.today) as status) st
    join public.plan_quotes() q on q.business_id = b.id
    left join lateral (select * from plan_events e where e.business_id = b.id and e.kind = 'request'
                         and not exists (select 1 from plan_events a where a.business_id = b.id
                                         and a.kind in ('activate', 'end') and a.created_at > e.created_at)
                       order by e.created_at desc limit 1) r on true
    where not b.is_demo
    order by (r.created_at is not null) desc, b.created_at desc;
end;
$$;
revoke execute on function public.admin_salons() from public, anon;
grant execute on function public.admin_salons() to authenticated;
