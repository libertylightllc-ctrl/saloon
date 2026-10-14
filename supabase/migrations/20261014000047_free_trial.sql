-- A 7-day free trial (owner, 2026-10-14: "can we add a 7 day trail"; replaces "no trial" of 2026-09-29). A new salon
-- has every feature for `platform_settings.trial_days` days (0 switches trials off) without a card or a payment: its
-- plan simply runs until then, marked as a trial, so every check that a plan is active works unchanged. One trial per
-- owner sign-in: a second salon by the same person starts without one. When it ends the salon is locked like any
-- ended plan (nothing is deleted); a payment made during the trial starts when the trial ends, so no trial day is
-- lost. The owners are told the day before it ends. Salons that never had a plan get their trial from today.

alter table public.platform_settings
  add column trial_days int not null default 7 check (trial_days between 0 and 90);
-- The website says how long the trial is.
grant select (trial_days) on public.platform_settings to anon;

alter table public.subscriptions add column trial boolean not null default false;
comment on column public.subscriptions.trial is 'The plan running until paid_until is the free trial, not a payment.';

alter table public.plan_events drop constraint plan_events_kind_check;
alter table public.plan_events add constraint plan_events_kind_check check (kind in ('request', 'activate', 'end', 'trial'));

-- Gives a salon its trial if its owner has not had one. Run when a salon is created (by its owner, so the trial is
-- theirs); demo salons and the seed (no one signed in) get none.
create function public.start_trial(p_business uuid, p_owner uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_days int := (select trial_days from platform_settings);
  v_until date;
begin
  if p_owner is null or coalesce(v_days, 0) = 0
     or exists (select 1 from businesses where id = p_business and (is_demo or closed_at is not null))
     or exists (select 1 from subscriptions where business_id = p_business)
     or exists (select 1 from plan_events where kind = 'trial' and created_by = p_owner) then
    return false;
  end if;
  -- Runs to the same weekday next week: started on Wednesday 14, it is on through Wednesday 21.
  v_until := public.business_today(p_business) + v_days;
  insert into subscriptions (business_id, paid_until, trial) values (p_business, v_until, true);
  insert into plan_events (business_id, kind, paid_until, note, created_by, currency)
  values (p_business, 'trial', v_until, v_days || '-day free trial', p_owner, (select currency from public.plan_price(p_business)));
  return true;
end;
$$;

create function public.on_business_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.start_trial(new.id, auth.uid());
  return new;
end;
$$;
create trigger businesses_trial after insert on public.businesses
  for each row execute function public.on_business_created();

-- Salons signed up before trials (none has ever had a plan) get theirs from today.
select public.start_trial(b.id, m.user_id)
from businesses b
join lateral (select user_id from members mm where mm.business_id = b.id and mm.role = 'owner'
              order by mm.created_at limit 1) m on true
where not b.is_demo and b.closed_at is null
  and not exists (select 1 from subscriptions s where s.business_id = b.id)
  and not exists (select 1 from plan_events e where e.business_id = b.id and e.kind in ('activate', 'trial'))
order by b.created_at;

-- A payment ends the trial: the paid months run on from its end.
create or replace function public.admin_activate(p_business uuid, p_months integer, p_amount_minor bigint, p_note text)
 RETURNS date
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_today date := public.business_today(p_business);
  v_current date;
  v_until date;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_months is null or p_months not between 1 and 36 or coalesce(p_amount_minor, 0) < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  select paid_until into v_current from subscriptions where business_id = p_business;
  -- A running plan or trial is extended from its end; otherwise it starts today (1 month from 29 Sep runs to 28 Oct).
  v_until := (greatest(coalesce(v_current, v_today - 1), v_today - 1) + make_interval(months => p_months))::date;
  insert into subscriptions (business_id, paid_until, trial) values (p_business, v_until, false)
  on conflict (business_id) do update set paid_until = excluded.paid_until, trial = false, updated_at = now();
  insert into plan_events (business_id, kind, months, amount_minor, currency, paid_until, note, created_by)
  values (p_business, 'activate', p_months, p_amount_minor, (select currency from public.plan_price(p_business)), v_until,
          nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
  return v_until;
end;
$$;

-- The salon's plan says whether it is the trial (and how long trials are, for the words around it).
create or replace function public.plan_status(p_business uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  q record;
  s subscriptions;
  v_request plan_events;
begin
  if not exists (select 1 from members where business_id = p_business and user_id = auth.uid() and active) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into q from public.plan_quote(p_business);
  select * into s from subscriptions where business_id = p_business;
  select * into v_request from plan_events e where e.business_id = p_business and e.kind = 'request'
    and not exists (select 1 from plan_events a where a.business_id = p_business and a.kind in ('activate', 'end')
                    and a.created_at > e.created_at)
    order by created_at desc limit 1;
  return jsonb_build_object(
    'active', s.paid_until is not null and s.paid_until >= public.business_today(p_business),
    'paid_until', s.paid_until,
    'trial', coalesce(s.trial, false),
    'today', public.business_today(p_business),
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

-- The console: which salons are on their trial.
drop function public.admin_salons();
create function public.admin_salons()
 RETURNS TABLE(business_id uuid, name text, code text, created_at timestamp with time zone, owner_name text,
               owner_email text, branches integer, paid_until date, active boolean, requested_at timestamp with time zone,
               requested_months integer, request_note text, country_code text, timezone text, people integer,
               monthly_minor bigint, plan_currency text, trial boolean)
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
           r.created_at, r.months, r.note, b.country_code, b.timezone, q.people, q.monthly_minor, q.currency, coalesce(s.trial, false)
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

create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', now() at time zone 'Asia/Dubai')::date;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'salons', (select count(*) from businesses where not is_demo and closed_at is null),
    'salons_closed', (select count(*) from businesses where not is_demo and closed_at is not null),
    'salons_plan_active', (select count(*) from businesses b join subscriptions s on s.business_id = b.id
                           where not b.is_demo and b.closed_at is null and not s.trial
                             and s.paid_until >= public.business_today(b.id)),
    'salons_trial', (select count(*) from businesses b join subscriptions s on s.business_id = b.id
                     where not b.is_demo and b.closed_at is null and s.trial
                       and s.paid_until >= public.business_today(b.id)),
    'plan_requests_open', (select count(distinct e.business_id) from plan_events e where e.kind = 'request'
                             and not exists (select 1 from plan_events a where a.business_id = e.business_id
                                             and a.kind in ('activate', 'end') and a.created_at > e.created_at)),
    'branches', (select count(*) from branches br join businesses b on b.id = br.business_id where not b.is_demo),
    'accounts', (select count(*) from auth.users),
    'owners', (select count(*) from members m join businesses b on b.id = m.business_id where m.role = 'owner' and not b.is_demo),
    'staff_logins', (select count(*) from members m join businesses b on b.id = m.business_id where m.role <> 'owner' and not b.is_demo),
    'no_salon', (select count(*) from auth.users u where not exists (select 1 from members m where m.user_id = u.id)),
    'signups_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'signups_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'signed_in_7d', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('code', country_code, 'salons', n) order by n desc)
                           from (select country_code, count(*) as n from businesses where not is_demo group by 1) c), '[]'),
    'sales_month', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'count', n, 'total_minor', total) order by total desc)
                             from (select b.currency, count(*) as n, sum(s.total_minor) as total from sales s
                                   join businesses b on b.id = s.business_id
                                   where not b.is_demo and s.business_date >= v_month group by 1) x), '[]'),
    'plan_income', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'total_minor', total) order by total desc)
                             from (select coalesce(e.currency, 'AED') as currency, sum(e.amount_minor) as total from plan_events e
                                   where e.kind = 'activate' and e.amount_minor > 0 group by 1) y), '[]')
  );
end;
$$;

-- The day before a trial ends (from 09:00 salon time, once), the owners are told, on the bell and by push.
create function public.notify_trials_ending(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select s.business_id, s.paid_until from subscriptions s join businesses b on b.id = s.business_id
    where s.trial and not b.is_demo and b.closed_at is null
      and s.paid_until = (p_now at time zone b.timezone)::date + 1
      and (p_now at time zone b.timezone)::time >= '09:00'
  loop
    n := n + public.notify(r.business_id, null, array['owner']::member_role[], 'trial_ending',
      'Your free trial ends tomorrow',
      'Tomorrow is the last day. After that nothing new can be saved until the plan is on; everything saved stays.',
      'plan', null, jsonb_build_object('until', r.paid_until), 'trial:' || r.paid_until);
  end loop;
  return n;
end;
$$;
select cron.schedule('trial-ending', '25 * * * *', $$select public.notify_trials_ending()$$);

revoke execute on function public.start_trial(uuid, uuid), public.on_business_created(),
  public.notify_trials_ending(timestamptz) from public, anon, authenticated;
