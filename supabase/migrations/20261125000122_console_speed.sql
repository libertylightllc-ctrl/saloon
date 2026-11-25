-- Platform console: the same answers, sooner (owner, 25 Nov 2026: "fix the failures"). On a busy server with thousands
-- of salons the Overview and the Salons list ran into the 8-second limit. Nothing here changes a number, a rule or who
-- may call it: only how the work is done.
--  · admin_overview worked out every salon's status once per count (eight times a salon). Now once.
--  · admin_salons, admin_salon_stats and admin_salon_duplicates asked about members, branches and the rest one salon at
--    a time. Now each table is read once.
--  · admin_revenue, admin_salon_activity and admin_coming_up looked up each salon's own day with a call per salon. Now
--    it comes with the salon.
--  · The Salons tab reads 1,000 rows at a time and each page ran the whole list again. admin_salon_list() and
--    admin_salon_stats_list() give it in one answer.

create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', now() at time zone 'Asia/Dubai')::date;
  v_groups jsonb;
  v_accounts jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- Materialized: each salon's status is worked out once, then counted.
  with signed_in as materialized (
    select distinct m.business_id from members m join auth.users u on u.id = m.user_id
    where u.last_sign_in_at > now() - interval '7 days'
  ), g as materialized (
    select public.salon_status(b.closed_at, s.access_type, s.free_until, s.paid_until,
                               (now() at time zone coalesce(b.timezone, 'Asia/Dubai'))::date) as st,
           b.created_at, si.business_id is not null as signed_in_7d
    from businesses b
    left join subscriptions s on s.business_id = b.id
    left join signed_in si on si.business_id = b.id
    where not b.is_demo and not exists (select 1 from test_salons t where t.business_id = b.id and t.test)
  )
  select jsonb_build_object(
           'salons', count(*) filter (where st <> 'closed'),
           'salons_closed', count(*) filter (where st = 'closed'),
           'salons_plan_active', count(*) filter (where st = 'paid'),
           'salons_trial', count(*) filter (where st = 'free'),
           'salons_pilot', count(*) filter (where st = 'pilot'),
           'salons_comp', count(*) filter (where st = 'comp'),
           'salons_ended', count(*) filter (where st = 'ended'),
           'new_salons_7d', count(*) filter (where created_at > now() - interval '7 days'),
           'new_salons_30d', count(*) filter (where created_at > now() - interval '30 days'),
           'salons_signed_in_7d', count(*) filter (where st <> 'closed' and signed_in_7d))
    into v_groups
    from g;

  -- Every account once (a person with two logins is one account): is it a test salon's, deleted, switched off (every
  -- login it has is off) or active (a login on, or no salon yet).
  select jsonb_build_object(
           'accounts', count(*) filter (where real_account),
           'accounts_active', count(*) filter (where real_account and not deleted and (not has_salon or any_on)),
           'accounts_off', count(*) filter (where real_account and not deleted and has_salon and not any_on),
           'accounts_deleted', count(*) filter (where real_account and deleted),
           'accounts_test', count(*) filter (where not real_account),
           'no_salon', count(*) filter (where real_account and not deleted and not has_salon),
           'signups_7d', count(*) filter (where real_account and created_at > now() - interval '7 days'),
           'signups_30d', count(*) filter (where real_account and created_at > now() - interval '30 days'),
           'signed_in_7d', count(*) filter (where real_account and not deleted and last_sign_in_at > now() - interval '7 days'))
    into v_accounts
    from (select u.created_at, u.last_sign_in_at, u.deleted_at is not null as deleted, m.user_id is not null as has_salon,
                 coalesce(m.any_on, false) as any_on, m.user_id is null or m.real_salon as real_account
          from auth.users u
          left join (select m.user_id, bool_or(coalesce(not t.test, true)) as real_salon, bool_or(m.active) as any_on
                     from members m left join test_salons t on t.business_id = m.business_id
                     group by m.user_id) m on m.user_id = u.id) a;

  return v_groups || v_accounts || jsonb_build_object(
    'salons_test', (select count(*) from businesses where not is_demo and exists (select 1 from test_salons t where t.business_id = businesses.id and t.test)),
    'billing_enabled', (select billing_enabled from platform_settings),
    'pilot_places_left', (select greatest(pilot_max_salons - public.pilot_active_count(), 0) from platform_settings),
    'pilot_applications_new', (select count(*) from pilot_applications where status = 'new'),
    'plan_requests_open', (select count(distinct e.business_id) from plan_events e where e.kind = 'request'
                             and not exists (select 1 from test_salons t where t.business_id = e.business_id and t.test)
                             and not exists (select 1 from plan_events a where a.business_id = e.business_id
                                             and a.kind in ('activate', 'end') and a.created_at > e.created_at)),
    -- Open salons only from here (A3): test and closed salons are left out.
    'branches', (select count(*) from branches br join businesses b on b.id = br.business_id
                 where not b.is_demo and b.closed_at is null
                   and not exists (select 1 from test_salons t where t.business_id = b.id and t.test)),
    'owners', (select count(*) from members m join businesses b on b.id = m.business_id
               where m.role = 'owner' and m.active and not b.is_demo and b.closed_at is null
                 and not exists (select 1 from test_salons t where t.business_id = b.id and t.test)),
    'staff_logins', (select count(*) from members m join businesses b on b.id = m.business_id
                     where m.role <> 'owner' and m.active and not b.is_demo and b.closed_at is null
                       and not exists (select 1 from test_salons t where t.business_id = b.id and t.test)),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('code', country_code, 'salons', n) order by n desc)
                           from (select country_code, count(*) as n from businesses
                                 where not is_demo and closed_at is null
                                   and not exists (select 1 from test_salons t where t.business_id = businesses.id and t.test)
                                 group by 1) c), '[]'),
    'sales_month', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'count', n, 'total_minor', total) order by total desc)
                             from (select b.currency, count(*) as n, sum(s.total_minor) as total from sales s
                                   join businesses b on b.id = s.business_id
                                   where not b.is_demo and not exists (select 1 from test_salons t where t.business_id = b.id and t.test) and s.business_date >= v_month
                                   group by 1) x), '[]'),
    -- Plan payments (A4): this month (Dubai's calendar, as the console's) and all time; payments on test salons and
    -- payments marked Test or Void are left out.
    'plan_income', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'total_minor', total) order by total desc)
                             from (select coalesce(e.currency, 'AED') as currency, sum(e.amount_minor) as total from plan_events e
                                   where e.kind = 'activate' and e.amount_minor > 0 and public.payment_counted(e.id, e.business_id)
                                   group by 1) y), '[]'),
    'plan_income_month', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'total_minor', total) order by total desc)
                                   from (select coalesce(e.currency, 'AED') as currency, sum(e.amount_minor) as total from plan_events e
                                         where e.kind = 'activate' and e.amount_minor > 0 and public.payment_counted(e.id, e.business_id)
                                           and (e.created_at at time zone 'Asia/Dubai')::date >= v_month
                                         group by 1) y), '[]')
  );
end;
$$;

create or replace function public.admin_salons()
 RETURNS TABLE(business_id uuid, name text, code text, created_at timestamp with time zone, owner_name text,
               owner_email text, branches integer, paid_until date, active boolean, requested_at timestamp with time zone,
               requested_months integer, request_note text, country_code text, timezone text, people integer,
               monthly_minor bigint, plan_currency text, trial boolean, access_type text, free_until date,
               pilot_code text, admin_note text, staff integer, last_active timestamp with time zone,
               status text, ended_on date, owner_deleted_at timestamptz, closed_at timestamptz, close_note text,
               closed_by_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    with owner_of as materialized (
      select distinct on (mm.business_id) mm.* from members mm where mm.role = 'owner' order by mm.business_id, mm.created_at
    ), branch_count as materialized (
      select br.business_id, count(*)::int as n from branches br group by 1
    ), people_of as materialized (
      select mm.business_id, (count(*) filter (where mm.active and mm.role <> 'owner'))::int as staff,
             max(au.last_sign_in_at) as last_active
      from members mm left join auth.users au on au.id = mm.user_id group by 1
    ), waiting as materialized (
      -- The latest request with no payment or ending after it.
      select distinct on (e.business_id) e.business_id, e.created_at, e.months, e.note
      from plan_events e
      where e.kind = 'request' and not exists (select 1 from plan_events a where a.business_id = e.business_id
                                                 and a.kind in ('activate', 'end') and a.created_at > e.created_at)
      order by e.business_id, e.created_at desc
    ), quotes as materialized (
      select pq.business_id, pq.people, pq.monthly_minor, pq.currency from public.plan_quotes() pq
    )
    select b.id, b.name, b.code, b.created_at,
           case when od.deleted_at is null then m.display_name end,
           case when od.deleted_at is null then u.email::text end,
           coalesce(bc.n, 0),
           s.paid_until,
           b.closed_at is null
             and (not ps.billing_enabled
                  or coalesce(s.access_type = 'comp' or s.free_until >= d.today or s.paid_until >= d.today, false)),
           r.created_at, r.months, r.note, b.country_code, b.timezone, q.people, q.monthly_minor, q.currency,
           coalesce(s.access_type = 'trial', false), s.access_type, s.free_until, s.pilot_code, s.admin_note,
           coalesce(po.staff, 0), po.last_active,
           st.status,
           case when st.status = 'ended' then greatest(s.paid_until, s.free_until) end,
           od.deleted_at, b.closed_at, b.close_note,
           (select coalesce((select mm.display_name from members mm where mm.user_id = cu.id and mm.display_name <> 'Deleted user'
                             order by mm.created_at limit 1), cu.email::text)
            from auth.users cu where cu.id = b.closed_by)
    from businesses b
    cross join platform_settings ps
    cross join lateral (select (now() at time zone coalesce(b.timezone, 'Asia/Dubai'))::date as today) d
    left join owner_of m on m.business_id = b.id
    left join auth.users u on u.id = m.user_id
    -- Deleted: the sign-in service marked the account deleted, or it is gone altogether (then the salon's closing is
    -- the nearest date there is).
    cross join lateral (select case when m.id is null then null
                                    when u.id is null then coalesce(b.closed_at, m.created_at)
                                    else u.deleted_at end as deleted_at) od
    left join subscriptions s on s.business_id = b.id
    -- offset 0: the status is worked out once a salon.
    cross join lateral (select public.salon_status(b.closed_at, s.access_type, s.free_until, s.paid_until, d.today) as status offset 0) st
    join quotes q on q.business_id = b.id
    left join branch_count bc on bc.business_id = b.id
    left join people_of po on po.business_id = b.id
    left join waiting r on r.business_id = b.id
    where not b.is_demo
    order by (r.created_at is not null) desc, b.created_at desc, b.id;
end;
$$;

create or replace function public.admin_salon_stats()
returns table (business_id uuid, currency text, mode text, staff integer, customers integer, services integer,
               sales_30d integer, sales_month_minor bigint, last_sale_at timestamptz, last_sign_in_at timestamptz,
               closed boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    with modes as materialized (
      select br.business_id, string_agg(distinct br.mode::text, ', ') as list from branches br group by 1
    ), staff_of as materialized (
      select e.business_id, count(*)::int as n from employees e where e.active group by 1
    ), customers_of as materialized (
      select c.business_id, count(*)::int as n from customers c group by 1
    ), services_of as materialized (
      select sv.business_id, count(*)::int as n from services sv where sv.status = 'active' group by 1
    ), logins as materialized (
      select m.business_id, max(u.last_sign_in_at) as last_sign_in_at,
             coalesce(bool_or(m.role = 'owner' and m.active), false) as owner_on
      from members m left join auth.users u on u.id = m.user_id group by 1
    )
    select b.id, b.currency, mo.list, coalesce(st.n, 0), coalesce(cu.n, 0), coalesce(se.n, 0),
           -- Sales stay one salon at a time: the index gives a salon's last 30 days without reading every sale.
           (select count(*)::int from sales s where s.business_id = b.id and s.created_at > now() - interval '30 days'),
           (select coalesce(sum(s.total_minor), 0)::bigint from sales s where s.business_id = b.id
              and s.business_date >= date_trunc('month', (now() at time zone coalesce(b.timezone, 'Asia/Dubai'))::date)::date),
           (select max(s.created_at) from sales s where s.business_id = b.id),
           l.last_sign_in_at,
           b.closed_at is not null or not coalesce(l.owner_on, false)
    from businesses b
    left join modes mo on mo.business_id = b.id
    left join staff_of st on st.business_id = b.id
    left join customers_of cu on cu.business_id = b.id
    left join services_of se on se.business_id = b.id
    left join logins l on l.business_id = b.id
    where not b.is_demo;
end;
$$;

create or replace function public.admin_salon_duplicates()
returns table (business_id uuid, reason text, others jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    with owner_of as materialized (
      select distinct on (mm.business_id) mm.business_id, mm.user_id, mm.display_name
      from members mm where mm.role = 'owner' order by mm.business_id, mm.created_at
    ), owners as materialized (
      select b.id, b.name, b.code,
             nullif(lower(regexp_replace(btrim(coalesce(m.display_name, '')), '\s+', ' ', 'g')), '') as owner_name,
             oc.phone
      from businesses b
      join owner_of m on m.business_id = b.id
      -- A deleted account is no one's duplicate: they are all "Deleted user" (A2).
      join auth.users u on u.id = m.user_id and u.deleted_at is null
      left join owner_contacts oc on oc.user_id = m.user_id
      where not b.is_demo
    ), keyed as materialized (
      select o.id, o.name, o.code, 'name'::text as reason, o.owner_name as key from owners o where char_length(o.owner_name) >= 2
      union all
      select o.id, o.name, o.code, 'phone'::text, o.phone from owners o where o.phone is not null
    ), numbered as materialized (
      -- Each owner name (or number) that is there more than once, with its salons in order and each one's place in it.
      select k.id, k.reason, k.key, jsonb_build_object('name', k.name, 'code', k.code) as salon,
             row_number() over w as place, count(*) over (partition by k.reason, k.key) as n
      from keyed k window w as (partition by k.reason, k.key order by k.name, k.code)
    ), groups as materialized (
      select x.reason, x.key, jsonb_agg(x.salon order by x.place) as salons from numbered x where x.n > 1 group by x.reason, x.key
    )
    -- A salon's others are its group without itself.
    select x.id, x.reason, g.salons - (x.place - 1)::int
    from numbered x join groups g on g.reason = x.reason and g.key = x.key
    where x.n > 1;
end;
$$;

-- The whole list in one answer, in the list's own order.
create function public.admin_salon_list() returns jsonb
language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(s) - 'n' order by s.n), '[]')
  from public.admin_salons() with ordinality as s (business_id, name, code, created_at, owner_name, owner_email, branches,
    paid_until, active, requested_at, requested_months, request_note, country_code, timezone, people, monthly_minor,
    plan_currency, trial, access_type, free_until, pilot_code, admin_note, staff, last_active, status, ended_on,
    owner_deleted_at, closed_at, close_note, closed_by_name, n)
$$;
revoke execute on function public.admin_salon_list() from public, anon;
grant execute on function public.admin_salon_list() to authenticated;

create function public.admin_salon_stats_list() returns jsonb
language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(s)), '[]') from public.admin_salon_stats() s
$$;
revoke execute on function public.admin_salon_stats_list() from public, anon;
grant execute on function public.admin_salon_stats_list() to authenticated;
