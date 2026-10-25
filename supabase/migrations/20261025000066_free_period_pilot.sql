-- Full update brief, Phase 6 (owner, 2026-10-25): a free period instead of the 7-day trial, a pilot with codes, billing
-- that can be switched off for everyone, and the platform console's controls for them (the console stays the admin
-- page, for platform owners: ADMIN_EMAILS was left blank). Nothing is deleted: the trial column stays, unused, and
-- every salon's current free time is kept or lengthened.

-- 1. Settings: billing on or off for everyone, the free days, the pilot's days and size. Seeded with the owner's
--    values: billing off, 30 free days, 90 pilot days, 20 pilot salons.
alter table public.platform_settings
  add column billing_enabled boolean not null default false,
  add column public_free_days int not null default 30 check (public_free_days between 0 and 365),
  add column pilot_free_days int not null default 90 check (pilot_free_days between 1 and 730),
  add column pilot_max_salons int not null default 20 check (pilot_max_salons between 0 and 10000);
grant select (billing_enabled, public_free_days, pilot_free_days, pilot_max_salons) on public.platform_settings to anon;
comment on column public.platform_settings.trial_days is 'Superseded by public_free_days (migration 66); kept, not read.';

-- 2. Each salon's access: trial (the free period), pilot, paid or comp (free for good), the last free day, the pilot
--    code used and the platform owner's note. paid_until is now only the paid time (null when never paid).
alter table public.subscriptions
  alter column paid_until drop not null,
  add column access_type text not null default 'trial' check (access_type in ('trial', 'pilot', 'paid', 'comp')),
  add column free_until date,
  add column pilot_code text,
  add column admin_note text check (char_length(admin_note) <= 500);
comment on column public.subscriptions.trial is 'Superseded by access_type (migration 66); kept, not read.';
comment on column public.subscriptions.paid_until is 'Last day paid for, in the salon''s own date; null when never paid.';
comment on column public.subscriptions.free_until is 'Last free day (free period or pilot), in the salon''s own date.';

-- Existing salons keep at least their free time: a running or ended trial becomes a free period lasting at least the
-- new free days from the salon's first day; a paid plan stays paid; a salon with no row yet gets the free period.
update public.subscriptions s set
  access_type = 'trial',
  free_until = greatest(s.paid_until, (b.created_at at time zone b.timezone)::date + ps.public_free_days),
  paid_until = null
from public.businesses b, public.platform_settings ps
where b.id = s.business_id and s.trial;
update public.subscriptions set access_type = 'paid' where not trial;
insert into public.subscriptions (business_id, paid_until, trial, access_type, free_until)
select b.id, null, false, 'trial', (b.created_at at time zone b.timezone)::date + ps.public_free_days
from public.businesses b cross join public.platform_settings ps
where not b.is_demo and b.closed_at is null and not exists (select 1 from public.subscriptions s where s.business_id = b.id);

alter table public.plan_events drop constraint plan_events_kind_check;
alter table public.plan_events add constraint plan_events_kind_check
  check (kind in ('request', 'activate', 'end', 'trial', 'pilot', 'access'));

-- 3. The one access check, used by every write (gate_plan → require_plan), the booking page and the app: an open salon
--    can work while billing is off, or it is free for good, or in its free period, or paid.
create or replace function public.plan_active(p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from businesses b where b.id = p_business and b.closed_at is null)
    and (not (select billing_enabled from platform_settings)
         or exists (select 1 from subscriptions s
                    where s.business_id = p_business
                      and (s.access_type = 'comp'
                           or s.free_until >= public.business_today(p_business)
                           or s.paid_until >= public.business_today(p_business))));
$$;

-- 4. The platform owners' record of every change they make: who, what, when, before and after.
create table public.platform_audit (
  id uuid primary key default gen_random_uuid(),
  actor uuid references auth.users (id) on delete set null,
  action text not null,
  business_id uuid references public.businesses (id) on delete set null,
  subject text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create index platform_audit_created_idx on public.platform_audit (created_at desc);
alter table public.platform_audit enable row level security;
revoke all on public.platform_audit from anon, authenticated;

create function public.platform_audit_write(p_action text, p_business uuid, p_subject text, p_before jsonb, p_after jsonb)
returns void language sql security definer set search_path = public as $$
  insert into platform_audit (actor, action, business_id, subject, before, after)
  values (auth.uid(), p_action, p_business, p_subject, p_before, p_after);
$$;

-- 5. Pilot codes (e.g. PILOT-DXB-07): days free, how many salons may use one, until when. One pilot per salon.
create table public.pilot_codes (
  code text primary key check (code ~ '^[A-Z0-9][A-Z0-9-]{2,39}$'),
  days int not null check (days between 1 and 730),
  max_uses int not null default 1 check (max_uses between 1 and 10000),
  expires_on date,
  note text check (char_length(note) <= 300),
  disabled_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.pilot_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.pilot_codes (code),
  business_id uuid not null unique references public.businesses (id) on delete cascade,
  redeemed_by uuid references auth.users (id) on delete set null,
  free_until date not null,
  created_at timestamptz not null default now()
);
create index pilot_redemptions_code_idx on public.pilot_redemptions (code);
-- Wrong or refused codes, for the rate limit (10 an hour per person).
create table public.pilot_code_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index pilot_code_attempts_idx on public.pilot_code_attempts (user_id, at desc);
alter table public.pilot_codes enable row level security;
alter table public.pilot_redemptions enable row level security;
alter table public.pilot_code_attempts enable row level security;
revoke all on public.pilot_codes, public.pilot_redemptions, public.pilot_code_attempts from anon, authenticated;

-- Pilot salons right now (open, free time left): the pilot's places are counted from these.
create function public.pilot_active_count() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from subscriptions s join businesses b on b.id = s.business_id
  where s.access_type = 'pilot' and b.closed_at is null and not b.is_demo
    and s.free_until >= public.business_today(b.id);
$$;

-- Uses a code for a salon: checked on the server, any letter case. Never raises, so a refused code is still counted
-- for the rate limit: {ok: true, free_until} or {ok: false, reason}. The free time becomes the later of the current
-- one and today + the code's days.
create function public.pilot_redeem(p_business uuid, p_code text, p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ps platform_settings;
  c pilot_codes;
  s subscriptions;
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_today date := public.business_today(p_business);
  v_until date;
  v_reason text;
begin
  select * into ps from platform_settings;
  if p_user is not null and (select count(*) from pilot_code_attempts
                             where user_id = p_user and at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'reason', 'too_many_attempts');
  end if;
  select * into c from pilot_codes where code = v_code for update;
  select * into s from subscriptions where business_id = p_business for update;
  v_reason := case
    when c.code is null or c.disabled_at is not null then 'invalid_code'
    when c.expires_on is not null and c.expires_on < v_today then 'code_expired'
    when (select count(*) from pilot_redemptions r where r.code = c.code) >= c.max_uses then 'code_used_up'
    when exists (select 1 from pilot_redemptions r where r.business_id = p_business) then 'pilot_already'
    when s.access_type = 'comp' then 'pilot_not_needed'
    when public.pilot_active_count() >= ps.pilot_max_salons then 'pilot_full'
  end;
  if v_reason is not null then
    if p_user is not null then
      insert into pilot_code_attempts (user_id) values (p_user);
    end if;
    return jsonb_build_object('ok', false, 'reason', v_reason);
  end if;
  v_until := greatest(coalesce(s.free_until, v_today), v_today + c.days);
  insert into subscriptions (business_id, paid_until, trial, access_type, free_until, pilot_code)
  values (p_business, null, false, 'pilot', v_until, c.code)
  on conflict (business_id) do update set access_type = 'pilot', free_until = v_until, pilot_code = c.code,
                                          updated_at = now();
  insert into pilot_redemptions (code, business_id, redeemed_by, free_until) values (c.code, p_business, p_user, v_until);
  insert into plan_events (business_id, kind, paid_until, note, created_by)
  values (p_business, 'pilot', v_until, 'Pilot code ' || c.code, p_user);
  return jsonb_build_object('ok', true, 'free_until', v_until, 'code', c.code);
end;
$$;

-- The owner enters a code (sign-up stores it for setup; More → Plan & billing).
create function public.redeem_pilot_code(p_business uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_member uuid;
  v_result jsonb;
begin
  select id into v_member from members where business_id = p_business and user_id = auth.uid() and active and role = 'owner';
  if v_member is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_result := public.pilot_redeem(p_business, p_code, auth.uid());
  if (v_result ->> 'ok')::boolean then
    perform public.write_audit(p_business, null, v_member, 'update', 'plan', p_business,
      'Joined the pilot with code ' || (v_result ->> 'code') || ', free until ' || (v_result ->> 'free_until'));
  end if;
  return v_result;
end;
$$;

-- 6. A new salon's free period (replaces the 7-day trial): the public free days from today, one free period per
--    owner as before; then a pilot code given at sign-up, if any.
create function public.start_free_period(p_business uuid, p_owner uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  ps platform_settings;
  b businesses;
  v_until date;
  v_code text;
begin
  select * into ps from platform_settings;
  select * into b from businesses where id = p_business;
  if b.id is null or b.is_demo or exists (select 1 from subscriptions where business_id = p_business) then
    return;
  end if;
  if ps.public_free_days > 0 and p_owner is not null
     and not exists (select 1 from plan_events where kind = 'trial' and created_by = p_owner) then
    v_until := public.business_today(p_business) + ps.public_free_days;
    insert into plan_events (business_id, kind, paid_until, note, created_by, currency)
    values (p_business, 'trial', v_until, ps.public_free_days || '-day free period', p_owner,
            (select currency from public.plan_price(p_business)));
  end if;
  insert into subscriptions (business_id, paid_until, trial, access_type, free_until)
  values (p_business, null, false, 'trial', v_until);
  select nullif(btrim(raw_user_meta_data ->> 'pilot_code'), '') into v_code from auth.users where id = p_owner;
  if v_code is not null then
    perform public.pilot_redeem(p_business, v_code, p_owner);
  end if;
end;
$$;

create or replace function public.on_business_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.start_free_period(new.id, auth.uid());
  return new;
end;
$$;

-- 7. Pilot applications from the website (name, salon, emirate and area, type, staff, WhatsApp, language, the OK to be
--    contacted on WhatsApp). A filled-in hidden field (the honeypot) is thanked and dropped; at most 3 an hour from one
--    address and 200 a day in all. The platform owners are emailed with the other alerts (plan-alert).
create table public.pilot_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  salon_name text not null check (char_length(salon_name) between 2 and 80),
  emirate text not null check (emirate in ('abu_dhabi', 'dubai', 'sharjah', 'ajman', 'umm_al_quwain', 'ras_al_khaimah', 'fujairah')),
  area text check (char_length(area) <= 80),
  salon_type text not null check (salon_type in ('barber', 'ladies', 'unisex', 'spa', 'beauty')),
  staff_count int not null check (staff_count between 1 and 500),
  whatsapp text not null check (whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  language text not null check (language in ('en', 'ar', 'hi', 'ur', 'es', 'fr', 'pt')),
  whatsapp_ok boolean not null default false,
  whatsapp_ok_at timestamptz,
  status text not null default 'new' check (status in ('new', 'approved', 'declined')),
  code text references public.pilot_codes (code),
  source_hash text,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  alerted_at timestamptz,
  created_at timestamptz not null default now()
);
create index pilot_applications_created_idx on public.pilot_applications (created_at desc);
alter table public.pilot_applications enable row level security;
revoke all on public.pilot_applications from anon, authenticated;

create function public.apply_for_pilot(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  -- The visitor's address for the rate limit: Cloudflare's (set by Supabase's edge, not by the visitor), else the
  -- proxies' (the local stack).
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
  v_ip text := coalesce(v_headers ->> 'cf-connecting-ip',
                        nullif(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1), ''),
                        v_headers ->> 'x-real-ip', '');
  v_hash text := md5('saloqo-pilot:' || btrim(v_ip));
  v_phone text := regexp_replace(coalesce(p ->> 'whatsapp', ''), '[^0-9+]', '', 'g');
begin
  if nullif(btrim(coalesce(p ->> 'website', '')), '') is not null then
    return jsonb_build_object('ok', true);
  end if;
  if (select count(*) from pilot_applications where source_hash = v_hash and created_at > now() - interval '1 hour') >= 3
     or (select count(*) from pilot_applications where created_at > now() - interval '1 day') >= 200 then
    return jsonb_build_object('ok', false, 'reason', 'too_many');
  end if;
  begin
    insert into pilot_applications (name, salon_name, emirate, area, salon_type, staff_count, whatsapp, language,
                                    whatsapp_ok, whatsapp_ok_at, source_hash)
    values (btrim(p ->> 'name'), btrim(p ->> 'salon_name'), p ->> 'emirate', nullif(btrim(coalesce(p ->> 'area', '')), ''),
            p ->> 'salon_type', (p ->> 'staff_count')::int, v_phone, coalesce(nullif(p ->> 'language', ''), 'en'),
            coalesce((p ->> 'whatsapp_ok')::boolean, false),
            case when coalesce((p ->> 'whatsapp_ok')::boolean, false) then now() end, v_hash);
  exception when check_violation or not_null_violation or invalid_text_representation or numeric_value_out_of_range then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end;
  perform public.dispatch_plan_alerts();
  return jsonb_build_object('ok', true);
end;
$$;

-- The pilot as visitors see it: open while places are left (numbers from the settings and the real count).
create function public.pilot_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('days', ps.pilot_free_days, 'max', ps.pilot_max_salons,
                            'places_left', greatest(ps.pilot_max_salons - public.pilot_active_count(), 0))
  from platform_settings ps;
$$;

-- New applications go out with the plan-request alerts (as migration 46, plus applications not yet sent).
create or replace function public.dispatch_plan_alerts() returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  v_key text := (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key');
begin
  if v_url is null or v_key is null
     or (not exists (select 1 from plan_events where kind = 'request' and alerted_at is null
                     and created_at > now() - interval '7 days')
         and not exists (select 1 from support_threads t where t.alerted_at is null and t.status = 'open'
                         and t.last_message_at > now() - interval '7 days'
                         and (t.handover or not (select support_assistant from platform_settings limit 1)
                              or (t.last_from = 'user' and t.last_message_at < now() - interval '5 minutes')))
         and not exists (select 1 from pilot_applications where alerted_at is null
                         and created_at > now() - interval '7 days')) then
    return null;
  end if;
  return net.http_post(url := v_url || '/functions/v1/plan-alert', body := '{}'::jsonb,
                       headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key));
end;
$$;

-- For plan-alert (service role): the applications not yet sent, marked as sent.
create function public.claim_pilot_alerts()
returns table (id uuid, name text, salon_name text, emirate text, area text, salon_type text, staff_count int,
               whatsapp text, language text, whatsapp_ok boolean, created_at timestamptz, admin_emails text[])
language plpgsql security definer set search_path = public as $$
begin
  return query
    with claimed as (
      update pilot_applications a set alerted_at = now()
      where a.alerted_at is null
      returning a.*
    )
    select c.id, c.name, c.salon_name, c.emirate, c.area, c.salon_type, c.staff_count, c.whatsapp, c.language,
           c.whatsapp_ok, c.created_at,
           (select array_agg(au.email::text order by au.email) from platform_admins pa join auth.users au on au.id = pa.user_id
            where au.email is not null)
    from claimed c order by c.created_at;
end;
$$;

-- 8. Payments make a salon paid (a comp salon stays comp).
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
  -- Paid time runs on from the end of a running plan or free time (no free day is lost); otherwise from today
  -- (1 month from 29 Sep runs to 28 Oct).
  select greatest(paid_until, case when access_type in ('trial', 'pilot') then free_until end) into v_current
  from subscriptions where business_id = p_business;
  v_until := (greatest(coalesce(v_current, v_today - 1), v_today - 1) + make_interval(months => p_months))::date;
  insert into subscriptions (business_id, paid_until, trial, access_type) values (p_business, v_until, false, 'paid')
  on conflict (business_id) do update set paid_until = excluded.paid_until, trial = false, updated_at = now(),
    access_type = case when subscriptions.access_type = 'comp' then 'comp' else 'paid' end;
  insert into plan_events (business_id, kind, months, amount_minor, currency, paid_until, note, created_by)
  values (p_business, 'activate', p_months, p_amount_minor, (select currency from public.plan_price(p_business)), v_until,
          nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
  return v_until;
end;
$$;

create or replace function public.card_payment_completed(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c card_payments;
  v_business uuid;
  v_months int := nullif(p ->> 'months', '')::int;
  v_today date;
  v_current date;
  v_until date;
begin
  if nullif(p ->> 'order_id', '') is not null and exists (select 1 from card_payments where order_id = p ->> 'order_id') then
    return jsonb_build_object('result', 'duplicate');
  end if;
  select * into c from card_payments
  where (nullif(p ->> 'request_id', '') is not null and id::text = p ->> 'request_id')
     or (nullif(p ->> 'checkout_id', '') is not null and checkout_id = p ->> 'checkout_id')
  order by created_at limit 1 for update;
  if c.id is not null and c.status <> 'pending' then
    return jsonb_build_object('result', 'duplicate');
  end if;
  if c.id is null then
    -- A plain payment link: the salon code typed at checkout, and the months of the product bought.
    select id into v_business from businesses where code = lower(btrim(coalesce(p ->> 'salon_code', '')));
    if v_business is null or v_months is null or v_months not in (1, 3, 6, 12) then
      insert into card_payments (business_id, mode, months, amount_minor, currency, status, checkout_id, order_id,
                                 paid_minor, paid_currency, customer_email, note, paid_at)
      values (v_business, coalesce(nullif(p ->> 'mode', ''), 'live'), coalesce(v_months, 1),
              coalesce((p ->> 'paid_minor')::bigint, 0), coalesce(nullif(p ->> 'paid_currency', ''), 'USD'), 'review',
              nullif(p ->> 'checkout_id', ''), nullif(p ->> 'order_id', ''), (p ->> 'paid_minor')::bigint,
              nullif(p ->> 'paid_currency', ''), nullif(p ->> 'email', ''),
              'No salon matched (salon code: ' || coalesce(nullif(p ->> 'salon_code', ''), 'none') || ')', now());
      return jsonb_build_object('result', 'review');
    end if;
    insert into card_payments (business_id, mode, months, amount_minor, currency, checkout_id, note)
    values (v_business, coalesce(nullif(p ->> 'mode', ''), 'live'), v_months, coalesce((p ->> 'paid_minor')::bigint, 0),
            coalesce(nullif(p ->> 'paid_currency', ''), 'USD'), nullif(p ->> 'checkout_id', ''), 'Paid from a payment link')
    returning * into c;
  end if;

  -- Extend the plan as a recorded payment does: from the end of a running plan or free time, else from today.
  v_today := public.business_today(c.business_id);
  select greatest(paid_until, case when access_type in ('trial', 'pilot') then free_until end) into v_current
  from subscriptions where business_id = c.business_id;
  v_until := (greatest(coalesce(v_current, v_today - 1), v_today - 1) + make_interval(months => c.months))::date;
  insert into subscriptions (business_id, paid_until, trial, access_type) values (c.business_id, v_until, false, 'paid')
  on conflict (business_id) do update set paid_until = excluded.paid_until, trial = false, updated_at = now(),
    access_type = case when subscriptions.access_type = 'comp' then 'comp' else 'paid' end;
  insert into plan_events (business_id, kind, months, amount_minor, currency, paid_until, note)
  values (c.business_id, 'activate', c.months, coalesce((p ->> 'paid_minor')::bigint, c.amount_minor),
          coalesce(nullif(p ->> 'paid_currency', ''), c.currency), v_until,
          'Card payment (Creem' || case when c.mode = 'test' then ', test' else '' end || ') '
            || coalesce(nullif(p ->> 'order_id', ''), coalesce(nullif(p ->> 'checkout_id', ''), '')));
  update card_payments set status = 'paid', paid_at = now(), paid_until = v_until,
    checkout_id = coalesce(checkout_id, nullif(p ->> 'checkout_id', '')), order_id = nullif(p ->> 'order_id', ''),
    paid_minor = (p ->> 'paid_minor')::bigint, paid_currency = nullif(p ->> 'paid_currency', ''),
    customer_email = nullif(p ->> 'email', '')
  where id = c.id;
  return jsonb_build_object('result', 'paid', 'business_id', c.business_id, 'paid_until', v_until);
end;
$$;

-- 9. When billing is on: the owners are told 14 days and 3 days before the free time ends (from 09:00 salon time,
--    once each), unless the salon has paid. Nothing is sent while billing is off.
create or replace function public.notify_trials_ending(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  if not (select billing_enabled from platform_settings) then
    return 0;
  end if;
  for r in
    select s.business_id, s.free_until, s.free_until - (p_now at time zone b.timezone)::date as days_left
    from subscriptions s join businesses b on b.id = s.business_id
    where s.access_type in ('trial', 'pilot') and not b.is_demo and b.closed_at is null
      and s.free_until - (p_now at time zone b.timezone)::date in (14, 3)
      and (p_now at time zone b.timezone)::time >= '09:00'
      and coalesce(s.paid_until < (p_now at time zone b.timezone)::date, true)
  loop
    n := n + public.notify(r.business_id, null, array['owner']::member_role[], 'trial_ending',
      'Your free time ends in ' || r.days_left || ' days',
      'Choose a plan in More → Plan & billing to keep saving new work. Nothing is charged unless you choose one; '
        || 'everything saved stays.',
      'plan', null, jsonb_build_object('until', r.free_until, 'days', r.days_left),
      'free:' || r.free_until || ':' || r.days_left);
  end loop;
  return n;
end;
$$;

-- 10. The console.
-- Billing and the free days (billing on asks for a confirmation in the console first).
create function public.admin_set_billing(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select jsonb_build_object('billing_enabled', billing_enabled, 'public_free_days', public_free_days,
                            'pilot_free_days', pilot_free_days, 'pilot_max_salons', pilot_max_salons)
    into v_before from platform_settings;
  begin
    update platform_settings set
      billing_enabled = coalesce((p ->> 'billing_enabled')::boolean, billing_enabled),
      public_free_days = coalesce((p ->> 'public_free_days')::int, public_free_days),
      pilot_free_days = coalesce((p ->> 'pilot_free_days')::int, pilot_free_days),
      pilot_max_salons = coalesce((p ->> 'pilot_max_salons')::int, pilot_max_salons);
  exception when check_violation or invalid_text_representation then
    raise exception 'invalid_setting' using errcode = '22023';
  end;
  select jsonb_build_object('billing_enabled', billing_enabled, 'public_free_days', public_free_days,
                            'pilot_free_days', pilot_free_days, 'pilot_max_salons', pilot_max_salons)
    into v_after from platform_settings;
  perform public.platform_audit_write('settings', null, null, v_before, v_after);
  return v_after;
end;
$$;

-- One salon's access: make pilot (days, or until a date), extend 30 days, set the end date, end now, free for good,
-- or the note. p = {action, days?, until?, note?}.
create function public.admin_set_access(p_business uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s subscriptions;
  v_today date;
  v_action text := p ->> 'action';
  v_before jsonb;
  v_after jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from businesses where id = p_business) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_today := public.business_today(p_business);
  insert into subscriptions (business_id, paid_until, trial, access_type) values (p_business, null, false, 'trial')
  on conflict (business_id) do nothing;
  select * into s from subscriptions where business_id = p_business for update;
  v_before := jsonb_build_object('access_type', s.access_type, 'free_until', s.free_until, 'admin_note', s.admin_note);
  if v_action = 'pilot' then
    if nullif(p ->> 'until', '') is not null then
      s.free_until := (p ->> 'until')::date;
    elsif coalesce((p ->> 'days')::int, 0) between 1 and 730 then
      s.free_until := greatest(coalesce(s.free_until, v_today), v_today + (p ->> 'days')::int);
    else
      raise exception 'invalid_setting' using errcode = '22023';
    end if;
    s.access_type := 'pilot';
  elsif v_action = 'extend' then
    s.free_until := greatest(coalesce(s.free_until, v_today), v_today) + 30;
    if s.access_type in ('paid', 'comp') then s.access_type := 'trial'; end if;
  elsif v_action = 'set_end' then
    s.free_until := (p ->> 'until')::date;
    if s.access_type = 'comp' then s.access_type := 'trial'; end if;
  elsif v_action = 'end_now' then
    s.free_until := v_today - 1;
    if s.access_type = 'comp' then s.access_type := 'trial'; end if;
  elsif v_action = 'comp' then
    s.access_type := 'comp';
  elsif v_action = 'note' then
    s.admin_note := nullif(btrim(coalesce(p ->> 'note', '')), '');
  else
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if s.free_until is not null and s.free_until > v_today + 3650 then
    raise exception 'invalid_setting' using errcode = '22023';
  end if;
  update subscriptions set access_type = s.access_type, free_until = s.free_until, admin_note = s.admin_note,
    updated_at = now() where business_id = p_business;
  v_after := jsonb_build_object('access_type', s.access_type, 'free_until', s.free_until, 'admin_note', s.admin_note);
  if v_action <> 'note' then
    insert into plan_events (business_id, kind, paid_until, note, created_by)
    values (p_business, 'access', s.free_until, v_action || ': ' || s.access_type
              || coalesce(', free until ' || s.free_until, ''), auth.uid());
  end if;
  perform public.platform_audit_write('access:' || v_action, p_business, null, v_before, v_after);
  return v_after;
end;
$$;

create function public.admin_pilot_codes()
returns table (code text, days int, max_uses int, uses int, expires_on date, note text, disabled boolean,
               created_at timestamptz, created_by text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select c.code, c.days, c.max_uses, (select count(*)::int from pilot_redemptions r where r.code = c.code),
           c.expires_on, c.note, c.disabled_at is not null, c.created_at, u.email::text
    from pilot_codes c left join auth.users u on u.id = c.created_by
    order by c.created_at desc;
end;
$$;

-- A new code: the one given, or PILOT-XXXXXX; the pilot's days unless given; one use unless given.
create function public.admin_create_pilot_code(p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(btrim(coalesce(p ->> 'code', '')));
  v_days int;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_code = '' then
    v_code := 'PILOT-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
  end if;
  v_days := coalesce((p ->> 'days')::int, (select pilot_free_days from platform_settings));
  begin
    insert into pilot_codes (code, days, max_uses, expires_on, note, created_by)
    values (v_code, v_days, coalesce((p ->> 'max_uses')::int, 1), nullif(p ->> 'expires_on', '')::date,
            nullif(btrim(coalesce(p ->> 'note', '')), ''), auth.uid());
  exception
    when unique_violation then raise exception 'code_taken' using errcode = '23505';
    when check_violation or invalid_text_representation or invalid_datetime_format then
      raise exception 'invalid_setting' using errcode = '22023';
  end;
  perform public.platform_audit_write('pilot_code:create', null, v_code, null,
    jsonb_build_object('days', v_days, 'max_uses', coalesce((p ->> 'max_uses')::int, 1), 'expires_on', p ->> 'expires_on'));
  return v_code;
end;
$$;

create function public.admin_disable_pilot_code(p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update pilot_codes set disabled_at = now() where code = upper(btrim(p_code)) and disabled_at is null;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform public.platform_audit_write('pilot_code:disable', null, upper(btrim(p_code)), null, null);
end;
$$;

create function public.admin_pilot_applications()
returns table (id uuid, name text, salon_name text, emirate text, area text, salon_type text, staff_count int,
               whatsapp text, language text, whatsapp_ok boolean, status text, code text, created_at timestamptz,
               decided_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select a.id, a.name, a.salon_name, a.emirate, a.area, a.salon_type, a.staff_count, a.whatsapp, a.language,
           a.whatsapp_ok, a.status, a.code, a.created_at, a.decided_at
    from pilot_applications a order by (a.status = 'new') desc, a.created_at desc;
end;
$$;

-- Approve: a one-use code for the pilot's days, valid 30 days, for the console's ready-to-send WhatsApp message.
create function public.admin_decide_pilot_application(p_id uuid, p_approve boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a pilot_applications;
  v_code text;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into a from pilot_applications where id = p_id for update;
  if a.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if a.status <> 'new' then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if p_approve then
    v_code := public.admin_create_pilot_code(jsonb_build_object('max_uses', 1,
      'expires_on', (current_date + 30)::text, 'note', a.salon_name));
  end if;
  update pilot_applications set status = case when p_approve then 'approved' else 'declined' end, code = v_code,
    decided_by = auth.uid(), decided_at = now() where id = p_id;
  perform public.platform_audit_write(case when p_approve then 'pilot_application:approve' else 'pilot_application:decline' end,
    null, a.salon_name, jsonb_build_object('status', 'new'),
    jsonb_build_object('status', case when p_approve then 'approved' else 'declined' end, 'code', v_code));
  return jsonb_build_object('code', v_code, 'name', a.name, 'whatsapp', a.whatsapp, 'language', a.language,
                            'days', (select pilot_free_days from platform_settings));
end;
$$;

create function public.admin_platform_audit(p_limit int default 200)
returns table (id uuid, actor text, action text, salon text, subject text, before jsonb, after jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select x.id, u.email::text, x.action, b.name, x.subject, x.before, x.after, x.created_at
    from platform_audit x left join auth.users u on u.id = x.actor left join businesses b on b.id = x.business_id
    order by x.created_at desc limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end;
$$;

-- The salons list: access, free time, pilot code, note, staff and when last active.
drop function public.admin_salons();
create function public.admin_salons()
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
           s.paid_until, public.plan_active(b.id),
           r.created_at, r.months, r.note, b.country_code, b.timezone, q.people, q.monthly_minor, q.currency,
           coalesce(s.access_type = 'trial', false), s.access_type, s.free_until, s.pilot_code, s.admin_note,
           (select count(*)::int from members mm where mm.business_id = b.id and mm.active and mm.role <> 'owner'),
           (select max(au.last_sign_in_at) from members mm join auth.users au on au.id = mm.user_id
            where mm.business_id = b.id)
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
                           where not b.is_demo and b.closed_at is null and s.paid_until >= public.business_today(b.id)),
    'salons_trial', (select count(*) from businesses b join subscriptions s on s.business_id = b.id
                     where not b.is_demo and b.closed_at is null and s.access_type = 'trial'
                       and s.free_until >= public.business_today(b.id)),
    'salons_pilot', public.pilot_active_count(),
    'salons_comp', (select count(*) from businesses b join subscriptions s on s.business_id = b.id
                    where not b.is_demo and b.closed_at is null and s.access_type = 'comp'),
    'billing_enabled', (select billing_enabled from platform_settings),
    'pilot_places_left', (select greatest(pilot_max_salons - public.pilot_active_count(), 0) from platform_settings),
    'pilot_applications_new', (select count(*) from pilot_applications where status = 'new'),
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

-- 11. Who may call what. Visitors: apply for the pilot and read its places. Signed in: their own code; the console's
--     functions check for a platform owner themselves. Everything else is the server's own.
revoke execute on function public.platform_audit_write(text, uuid, text, jsonb, jsonb), public.pilot_active_count(),
  public.pilot_redeem(uuid, text, uuid), public.start_free_period(uuid, uuid), public.claim_pilot_alerts(),
  public.redeem_pilot_code(uuid, text), public.admin_set_billing(jsonb), public.admin_set_access(uuid, jsonb),
  public.admin_pilot_codes(), public.admin_create_pilot_code(jsonb), public.admin_disable_pilot_code(text),
  public.admin_pilot_applications(), public.admin_decide_pilot_application(uuid, boolean),
  public.admin_platform_audit(int), public.apply_for_pilot(jsonb), public.pilot_status()
  from public, anon, authenticated;
grant execute on function public.claim_pilot_alerts() to service_role;
grant execute on function public.apply_for_pilot(jsonb), public.pilot_status() to anon, authenticated;
grant execute on function public.redeem_pilot_code(uuid, text), public.admin_set_billing(jsonb),
  public.admin_set_access(uuid, jsonb), public.admin_pilot_codes(), public.admin_create_pilot_code(jsonb),
  public.admin_disable_pilot_code(text), public.admin_pilot_applications(),
  public.admin_decide_pilot_application(uuid, boolean), public.admin_platform_audit(int) to authenticated;
revoke execute on function public.admin_salons() from public, anon;
grant execute on function public.admin_salons() to authenticated;
