-- Owner's fix list #12: the console's Salons list worked out each salon's price and plan one salon at a time
-- (plan_quote and plan_active on every row: about 1.5 ms a salon, over a second for 700). It now works them out for
-- every salon in one pass. Nothing it returns changes; a test checks it agrees with plan_quote and plan_active.

-- plan_quote() for every salon at once: each active login counts on one branch (its own, or the first branch for
-- owners, accountants and logins with no branch of this salon); each branch costs the base plus the extra for every
-- person after the included ones.
create function public.plan_quotes()
returns table(business_id uuid, people integer, included_people integer, base_minor bigint, extra_person_minor bigint,
              monthly_minor bigint, currency text)
language sql stable security definer set search_path = public as $$
  with br as (
    select b.id, b.business_id, row_number() over (partition by b.business_id order by b.created_at, b.id) as n
    from branches b
  ),
  counted as (
    select case when m.role in ('owner', 'accountant') or own.id is null then first.id else own.id end as branch_id
    from members m
    left join br own on own.id = m.default_branch_id and own.business_id = m.business_id
    left join br first on first.business_id = m.business_id and first.n = 1
    where m.active
  ),
  heads as (select c.branch_id, count(*)::int as people from counted c where c.branch_id is not null group by 1),
  -- Per salon: its people, its branches, and the people over the included ones, branch by branch. A salon with no
  -- branch has no row here and costs nothing.
  per_salon as (
    select br.business_id, sum(coalesce(h.people, 0))::int as people, count(*) as branches,
           sum(greatest(coalesce(h.people, 0) - (select included_people from platform_settings), 0)) as over
    from br left join heads h on h.branch_id = br.id
    group by 1
  )
  select bu.id, coalesce(ps.people, 0), s.included_people, q.base, q.extra,
         coalesce(ps.branches * q.base + ps.over * q.extra, 0)::bigint, q.currency
  from platform_settings s
  cross join businesses bu
  cross join lateral (
    select case when bu.country_code = 'AE' then s.price_per_branch_minor else s.intl_price_per_branch_minor end as base,
           case when bu.country_code = 'AE' then s.extra_person_minor else s.intl_extra_person_minor end as extra,
           case when bu.country_code = 'AE' then s.currency else s.intl_currency end as currency
  ) q
  left join per_salon ps on ps.business_id = bu.id
$$;
revoke execute on function public.plan_quotes() from public, anon, authenticated;

-- The salons list, as before; the price comes from plan_quotes() and "active" is plan_active() worked out in the row.
create or replace function public.admin_salons()
 RETURNS TABLE(business_id uuid, name text, code text, created_at timestamp with time zone, owner_name text,
               owner_email text, branches integer, paid_until date, active boolean, requested_at timestamp with time zone,
               requested_months integer, request_note text, country_code text, timezone text, people integer,
               monthly_minor bigint, plan_currency text, trial boolean, access_type text, free_until date,
               pilot_code text, admin_note text, staff integer, last_active timestamp with time zone)
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
                  or coalesce(s.access_type = 'comp'
                              or s.free_until >= (now() at time zone coalesce(b.timezone, 'Asia/Dubai'))::date
                              or s.paid_until >= (now() at time zone coalesce(b.timezone, 'Asia/Dubai'))::date, false)),
           r.created_at, r.months, r.note, b.country_code, b.timezone, q.people, q.monthly_minor, q.currency,
           coalesce(s.access_type = 'trial', false), s.access_type, s.free_until, s.pilot_code, s.admin_note,
           (select count(*)::int from members mm where mm.business_id = b.id and mm.active and mm.role <> 'owner'),
           (select max(au.last_sign_in_at) from members mm join auth.users au on au.id = mm.user_id
            where mm.business_id = b.id)
    from businesses b
    cross join platform_settings ps
    left join lateral (select * from members mm where mm.business_id = b.id and mm.role = 'owner'
                       order by mm.created_at limit 1) m on true
    left join auth.users u on u.id = m.user_id
    left join subscriptions s on s.business_id = b.id
    join public.plan_quotes() q on q.business_id = b.id
    left join lateral (select * from plan_events e where e.business_id = b.id and e.kind = 'request'
                         and not exists (select 1 from plan_events a where a.business_id = b.id
                                         and a.kind in ('activate', 'end') and a.created_at > e.created_at)
                       order by e.created_at desc limit 1) r on true
    where not b.is_demo
    order by (r.created_at is not null) desc, b.created_at desc;
end;
$$;
