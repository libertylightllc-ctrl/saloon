-- Paid plans (docs/06-BILLING-AND-SIGN-IN-PLAN.md; owner's decisions 2026-09-29): anyone can sign up and set up a
-- salon (business, branches, services, team logins, items, suppliers, opening cash and stock), but the day-to-day
-- features need an active plan: AED 99 per branch per month, no trial. Until a card provider is chosen, the
-- platform owner marks salons as paid (admin functions below). Without a plan people still sign in, see everything
-- and export; only new activity is refused (`plan_required`, HTTP 402). Nothing is deleted when a plan ends.

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;

create table public.platform_settings (
  id boolean primary key default true check (id),
  price_per_branch_minor bigint not null default 9900 check (price_per_branch_minor >= 0),
  currency text not null default 'AED'
);
insert into public.platform_settings default values;
alter table public.platform_settings enable row level security;
create policy "everyone signed in reads the price" on public.platform_settings for select to authenticated using (true);

create table public.subscriptions (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  paid_until date not null,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "members read their salon's plan" on public.subscriptions for select to authenticated
  using (business_id in (select public.my_business_ids(null::member_role[])));

-- Requests from owners and payments recorded by the platform owner: the plan's history.
create table public.plan_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null check (kind in ('request', 'activate', 'end')),
  months int check (months between 1 and 36),
  amount_minor bigint check (amount_minor >= 0),
  paid_until date,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  -- The moment it was written (not the transaction start): a payment settles every request made before it.
  created_at timestamptz not null default clock_timestamp()
);
create index plan_events_business_idx on public.plan_events (business_id, created_at desc);
alter table public.plan_events enable row level security;
create policy "owner and accountant read the plan history" on public.plan_events for select to authenticated
  using (business_id in (select public.my_business_ids(array['owner', 'accountant']::member_role[])));

create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid())
$$;

create function public.business_today(p_business uuid) returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select timezone from businesses where id = p_business), 'Asia/Dubai'))::date
$$;

create function public.plan_active(p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from subscriptions where business_id = p_business
                 and paid_until >= public.business_today(p_business))
$$;

-- Refuses new activity for a salon without an active plan. SQL tests and the demo seed switch the check off for
-- their session with `set salon.plan_check = off` (API requests cannot set it).
create function public.require_plan(p_business uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(current_setting('salon.plan_check', true), '') = 'off' then
    return;
  end if;
  if not public.plan_active(p_business) then
    raise exception 'plan_required' using errcode = 'PT402';
  end if;
end;
$$;

create function public.gate_plan() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Scheduled jobs and the service role are never blocked; people are.
  if auth.uid() is null then
    return new;
  end if;
  -- Opening stock is part of setting up.
  if tg_table_name = 'stock_movements' and to_jsonb(new) ->> 'reason' = 'opening' then
    return new;
  end if;
  perform public.require_plan(new.business_id);
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['appointments', 'customers', 'sales', 'refunds', 'refund_requests', 'expenses', 'purchase_bills',
    'supplier_payments', 'stock_movements', 'stock_counts', 'cash_closings', 'tip_payouts', 'attendance', 'payroll_runs',
    'payroll_adjustments', 'compliance_documents', 'hygiene_logs']
  loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.gate_plan()',
                   t || '_plan', t);
  end loop;
end $$;

-- ── For the salon ──────────────────────────────────────────────────────────────────────

-- The plan as the app shows it (any member: staff need to know why things are refused).
create function public.plan_status(p_business uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_branches int;
  v_price bigint;
  v_currency text;
  v_until date;
  v_request plan_events;
begin
  if not exists (select 1 from members where business_id = p_business and user_id = auth.uid() and active) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select count(*) into v_branches from branches where business_id = p_business;
  select price_per_branch_minor, currency into v_price, v_currency from platform_settings;
  select paid_until into v_until from subscriptions where business_id = p_business;
  select * into v_request from plan_events e where e.business_id = p_business and e.kind = 'request'
    and not exists (select 1 from plan_events a where a.business_id = p_business and a.kind in ('activate', 'end')
                    and a.created_at > e.created_at)
    order by created_at desc limit 1;
  return jsonb_build_object(
    'active', v_until is not null and v_until >= public.business_today(p_business),
    'paid_until', v_until,
    'branches', v_branches,
    'price_per_branch_minor', v_price,
    'monthly_minor', v_price * greatest(v_branches, 1),
    'currency', v_currency,
    'requested_at', v_request.created_at,
    'requested_months', v_request.months);
end;
$$;

-- The owner asks for the plan to be switched on (paid by transfer or card link until card payments are built in).
create function public.request_plan(p_business uuid, p_months int, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(p_business, array['owner']::member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_months is null or p_months not in (1, 3, 6, 12) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  insert into plan_events (business_id, kind, months, note, created_by)
  values (p_business, 'request', p_months, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
  perform public.write_audit(p_business, null, (select id from members where business_id = p_business and user_id = auth.uid()),
    'create', 'plan_request', null, 'Asked for the plan: ' || p_months || ' month(s)');
end;
$$;

-- ── For the platform owner ─────────────────────────────────────────────────────────────

create function public.admin_salons()
returns table (business_id uuid, name text, code text, created_at timestamptz, owner_name text, owner_email text,
               branches int, paid_until date, active boolean, requested_at timestamptz, requested_months int,
               request_note text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select b.id, b.name, b.code, b.created_at, m.display_name, u.email::text,
           (select count(*)::int from branches br where br.business_id = b.id),
           s.paid_until, coalesce(s.paid_until >= public.business_today(b.id), false),
           r.created_at, r.months, r.note
    from businesses b
    left join lateral (select * from members mm where mm.business_id = b.id and mm.role = 'owner'
                       order by mm.created_at limit 1) m on true
    left join auth.users u on u.id = m.user_id
    left join subscriptions s on s.business_id = b.id
    left join lateral (select * from plan_events e where e.business_id = b.id and e.kind = 'request'
                         and not exists (select 1 from plan_events a where a.business_id = b.id
                                         and a.kind in ('activate', 'end') and a.created_at > e.created_at)
                       order by e.created_at desc limit 1) r on true
    where not b.is_demo
    order by (r.created_at is not null) desc, b.created_at desc;
end;
$$;

-- Records a payment: the plan runs `p_months` from today, or from its current end if still running.
create function public.admin_activate(p_business uuid, p_months int, p_amount_minor bigint, p_note text) returns date
language plpgsql security definer set search_path = public as $$
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
  -- A running plan is extended from its end; otherwise it starts today (1 month from 29 Sep runs to 28 Oct).
  v_until := (greatest(coalesce(v_current, v_today - 1), v_today - 1) + make_interval(months => p_months))::date;
  insert into subscriptions (business_id, paid_until) values (p_business, v_until)
  on conflict (business_id) do update set paid_until = excluded.paid_until, updated_at = now();
  insert into plan_events (business_id, kind, months, amount_minor, paid_until, note, created_by)
  values (p_business, 'activate', p_months, p_amount_minor, v_until, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
  return v_until;
end;
$$;

create function public.admin_end_plan(p_business uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  update subscriptions set paid_until = public.business_today(p_business) - 1, updated_at = now()
  where business_id = p_business;
  insert into plan_events (business_id, kind, paid_until, note, created_by)
  values (p_business, 'end', public.business_today(p_business) - 1, btrim(p_note), auth.uid());
end;
$$;

-- The app hears at once when its plan starts or ends.
create trigger subscriptions_broadcast after insert or update or delete on public.subscriptions
  for each row execute function public.broadcast_change('business');

revoke all on table public.platform_admins, public.platform_settings, public.subscriptions, public.plan_events from anon;
revoke insert, update, delete on table public.platform_settings, public.subscriptions, public.plan_events from authenticated;
revoke all on table public.platform_admins from authenticated;
revoke execute on function public.is_platform_admin(), public.business_today(uuid), public.plan_active(uuid),
  public.require_plan(uuid), public.gate_plan(), public.plan_status(uuid), public.request_plan(uuid, int, text),
  public.admin_salons(), public.admin_activate(uuid, int, bigint, text), public.admin_end_plan(uuid, text) from public, anon;
revoke execute on function public.gate_plan(), public.require_plan(uuid) from authenticated;
grant execute on function public.is_platform_admin(), public.business_today(uuid), public.plan_active(uuid),
  public.plan_status(uuid), public.request_plan(uuid, int, text), public.admin_salons(),
  public.admin_activate(uuid, int, bigint, text), public.admin_end_plan(uuid, text) to authenticated;
