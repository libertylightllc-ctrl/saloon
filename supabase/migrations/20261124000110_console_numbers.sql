-- Platform console, Part A (owner's brief, 24 Nov 2026).
--
-- A3. The Overview's numbers follow one rule: test and closed salons are left out. "Salons by country", branches,
-- owners and staff logins counted closed salons too (Salons 8, but the countries added up to 10). Accounts are counted
-- once a person, with the split "active · switched off · deleted" (the Overview said 32, Accounts 43: test salons'
-- accounts and people with two logins). Sign-ups count new salons (this week, 30 days); signing in gets its own number.
--
-- A4. Plan payments: a platform owner can mark a recorded payment "Test" or "Void" with a reason (or count it again).
-- The payment itself is never changed: the mark is kept beside it (payment_marks), written to Changes, and the totals
-- leave marked payments out. Card payments made in Creem's test mode are marked "Test" when they arrive, and the ones
-- already recorded are marked now. The Overview gives the total this month and all time, and lists the payments.

create table public.payment_marks (
  event_id uuid primary key references public.plan_events (id) on delete cascade,
  -- Null: counted again (the history of marks is in Changes).
  mark text check (mark in ('test', 'void')),
  reason text not null,
  marked_by uuid references auth.users (id) on delete set null,
  marked_at timestamptz not null default now()
);
alter table public.payment_marks enable row level security;
revoke all on public.payment_marks from anon, authenticated;

-- Card payments in Creem's test mode are tests: marked so when they are recorded (card_payment_completed writes the
-- payment with the note "Card payment (Creem, test) …").
create function public.mark_test_card_payment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into payment_marks (event_id, mark, reason, marked_at) values (new.id, 'test', 'Creem test mode', new.created_at)
  on conflict (event_id) do nothing;
  return new;
end;
$$;
revoke execute on function public.mark_test_card_payment() from public, anon, authenticated;
create trigger plan_events_test_card after insert on public.plan_events
for each row when (new.kind = 'activate' and new.note like 'Card payment (Creem, test)%')
execute function public.mark_test_card_payment();

insert into public.payment_marks (event_id, mark, reason, marked_at)
select id, 'test', 'Creem test mode', created_at from public.plan_events
where kind = 'activate' and note like 'Card payment (Creem, test)%'
on conflict (event_id) do nothing;

-- Is a recorded payment counted in the totals: not on a test salon, not marked Test or Void.
create function public.payment_counted(p_event uuid, p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from test_salons t where t.business_id = p_business and t.test)
     and not exists (select 1 from payment_marks pm where pm.event_id = p_event and pm.mark is not null)
$$;
revoke execute on function public.payment_counted(uuid, uuid) from public, anon, authenticated;

-- Mark a payment Test or Void, or count it again (p_mark null), with a reason. Platform owners only; logged in Changes.
create function public.admin_mark_payment(p_event uuid, p_mark text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  e plan_events;
  v_before payment_marks;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_mark is not null and p_mark not in ('test', 'void') then
    raise exception 'invalid_mark' using errcode = '22023';
  end if;
  if v_reason is null or length(v_reason) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  select * into e from plan_events where id = p_event and kind = 'activate';
  if e.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into v_before from payment_marks where event_id = e.id for update;
  if v_before.mark is not distinct from p_mark then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  insert into payment_marks (event_id, mark, reason, marked_by, marked_at)
  values (e.id, p_mark, left(v_reason, 200), auth.uid(), now())
  on conflict (event_id) do update set mark = excluded.mark, reason = excluded.reason, marked_by = excluded.marked_by,
    marked_at = excluded.marked_at;
  perform public.platform_audit_write('payment:mark', e.business_id, (select name from businesses where id = e.business_id),
    jsonb_build_object('mark', v_before.mark),
    jsonb_build_object('mark', p_mark, 'reason', left(v_reason, 200), 'amount_minor', e.amount_minor, 'currency', e.currency,
                       'months', e.months, 'paid_on', (e.created_at at time zone 'Asia/Dubai')::date));
end;
$$;
revoke execute on function public.admin_mark_payment(uuid, text, text) from public, anon;
grant execute on function public.admin_mark_payment(uuid, text, text) to authenticated;

-- Every recorded payment, newest first, with its salon, whether it is counted and why not.
create function public.admin_payments()
returns table (id uuid, business_id uuid, salon text, code text, closed boolean, test_salon boolean, months integer,
               amount_minor bigint, currency text, paid_until date, note text, by_name text, created_at timestamptz,
               mark text, mark_reason text, marked_at timestamptz, marked_by_name text, counted boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select e.id, e.business_id, b.name, b.code, b.closed_at is not null,
           exists (select 1 from test_salons t where t.business_id = b.id and t.test),
           e.months, e.amount_minor, e.currency, e.paid_until, e.note,
           coalesce((select m.display_name from members m where m.user_id = e.created_by and m.business_id = e.business_id limit 1),
                    (select u.email::text from auth.users u where u.id = e.created_by)),
           e.created_at, pm.mark, pm.reason, pm.marked_at,
           (select coalesce((select m.display_name from members m where m.user_id = mu.id and m.display_name <> 'Deleted user'
                             order by m.created_at limit 1), mu.email::text)
            from auth.users mu where mu.id = pm.marked_by),
           public.payment_counted(e.id, e.business_id)
    from plan_events e
    join businesses b on b.id = e.business_id
    left join payment_marks pm on pm.event_id = e.id
    where e.kind = 'activate' and not b.is_demo
    order by e.created_at desc;
end;
$$;
revoke execute on function public.admin_payments() from public, anon;
grant execute on function public.admin_payments() to authenticated;

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
    from (select public.salon_status(b.closed_at, s.access_type, s.free_until, s.paid_until, public.business_today(b.id)) as st,
                 b.created_at,
                 exists (select 1 from members m join auth.users u on u.id = m.user_id
                         where m.business_id = b.id and u.last_sign_in_at > now() - interval '7 days') as signed_in_7d
          from businesses b left join subscriptions s on s.business_id = b.id
          where not b.is_demo and not exists (select 1 from test_salons t where t.business_id = b.id and t.test)) g;

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
