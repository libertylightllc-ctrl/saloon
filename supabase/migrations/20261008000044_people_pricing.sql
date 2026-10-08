-- The plan is priced by people, per salon (owner, 2026-10-08: "first 4 people access 50 AED, 5 people a little more
-- and it keeps adding"; chosen: everyone who signs in counts — the owner and every staff login —, AED 10 / USD 2.99 for
-- each person after the first 4, one price for the whole salon instead of one per branch).
--   monthly = base + extra × max(people − included, 0)      e.g. 6 people in the UAE: 50 + 2 × 10 = AED 70
-- The base price stays in price_per_branch_minor / intl_price_per_branch_minor (named from when it was per branch).
-- Salons already paid keep their months; the price applies from their next payment.

alter table public.platform_settings
  add column included_people int not null default 4 check (included_people between 1 and 1000),
  add column extra_person_minor bigint not null default 1000 check (extra_person_minor >= 0),
  add column intl_extra_person_minor bigint not null default 299 check (intl_extra_person_minor >= 0);
comment on column public.platform_settings.price_per_branch_minor is
  'The UAE monthly base price of a salon, covering included_people (per salon since 2026-10-08).';
comment on column public.platform_settings.intl_price_per_branch_minor is
  'The monthly base price outside the UAE, covering included_people (per salon since 2026-10-08).';
-- The website shows the whole price.
grant select (included_people, extra_person_minor, intl_extra_person_minor) on public.platform_settings to anon;

-- A salon's monthly price now: its people (active sign-ins) and what they cost.
create function public.plan_quote(p_business uuid, out people int, out included_people int, out base_minor bigint,
                                  out extra_person_minor bigint, out monthly_minor bigint, out currency text)
language sql stable security definer set search_path = public as $$
  select q.people, s.included_people, q.base, q.extra, q.base + q.extra * greatest(q.people - s.included_people, 0),
         q.currency
  from platform_settings s
  cross join businesses bu
  cross join lateral (
    select (select count(*)::int from members m where m.business_id = bu.id and m.active) as people,
           case when bu.country_code = 'AE' then s.price_per_branch_minor else s.intl_price_per_branch_minor end as base,
           case when bu.country_code = 'AE' then s.extra_person_minor else s.intl_extra_person_minor end as extra,
           case when bu.country_code = 'AE' then s.currency else s.intl_currency end as currency
  ) q
  where bu.id = p_business
$$;
revoke execute on function public.plan_quote(uuid) from public, anon, authenticated;

create or replace function public.plan_status(p_business uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  q record;
  v_until date;
  v_request plan_events;
begin
  if not exists (select 1 from members where business_id = p_business and user_id = auth.uid() and active) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into q from public.plan_quote(p_business);
  select paid_until into v_until from subscriptions where business_id = p_business;
  select * into v_request from plan_events e where e.business_id = p_business and e.kind = 'request'
    and not exists (select 1 from plan_events a where a.business_id = p_business and a.kind in ('activate', 'end')
                    and a.created_at > e.created_at)
    order by created_at desc limit 1;
  return jsonb_build_object(
    'active', v_until is not null and v_until >= public.business_today(p_business),
    'paid_until', v_until,
    'people', q.people,
    'included_people', q.included_people,
    'base_minor', q.base_minor,
    'extra_person_minor', q.extra_person_minor,
    'monthly_minor', q.monthly_minor,
    'currency', q.currency,
    'requested_at', v_request.created_at,
    'requested_months', v_request.months);
end;
$$;

-- The console: each salon's people and monthly price.
drop function public.admin_salons();
create function public.admin_salons()
 RETURNS TABLE(business_id uuid, name text, code text, created_at timestamp with time zone, owner_name text,
               owner_email text, branches integer, paid_until date, active boolean, requested_at timestamp with time zone,
               requested_months integer, request_note text, country_code text, timezone text, people integer,
               monthly_minor bigint, plan_currency text)
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
           s.paid_until, coalesce(s.paid_until >= public.business_today(b.id), false),
           r.created_at, r.months, r.note, b.country_code, b.timezone, q.people, q.monthly_minor, q.currency
    from businesses b
    left join lateral (select * from members mm where mm.business_id = b.id and mm.role = 'owner'
                       order by mm.created_at limit 1) m on true
    left join auth.users u on u.id = m.user_id
    left join subscriptions s on s.business_id = b.id
    cross join lateral public.plan_quote(b.id) q
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

-- The platform owner's email about a plan request carries the people and the monthly price.
drop function public.claim_plan_alerts();
create function public.claim_plan_alerts()
returns table (event_id uuid, salon text, code text, country_code text, owner_name text, owner_email text,
               people int, included_people int, base_minor bigint, extra_person_minor bigint, monthly_minor bigint,
               months int, note text, currency text, admin_emails text[], requested_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with claimed as (
    update plan_events e set alerted_at = clock_timestamp()
    where e.kind = 'request' and e.alerted_at is null and e.created_at > now() - interval '7 days'
    returning e.*
  )
  select c.id, b.name, b.code, b.country_code, m.display_name, u.email::text,
         q.people, q.included_people, q.base_minor, q.extra_person_minor, q.monthly_minor, c.months, c.note, q.currency,
         (select array_agg(au.email::text order by au.email) from platform_admins pa join auth.users au on au.id = pa.user_id
          where au.email is not null),
         c.created_at
  from claimed c
  join businesses b on b.id = c.business_id
  cross join lateral public.plan_quote(b.id) q
  left join lateral (select * from members mm where mm.business_id = b.id and mm.role = 'owner'
                     order by mm.created_at limit 1) m on true
  left join auth.users u on u.id = m.user_id
  order by c.created_at;
end;
$$;
revoke execute on function public.claim_plan_alerts() from public, anon, authenticated;
grant execute on function public.claim_plan_alerts() to service_role;
