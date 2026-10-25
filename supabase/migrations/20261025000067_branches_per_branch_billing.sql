-- Full update brief, Phase 6 f (owner, 2026-10-25: "Fix site, build in Phase 6"): an owner can add branches and move
-- between them, and the plan is priced per branch — each branch's price for up to the included people who sign in
-- there, plus each extra person; the owner and the accountant count once, at the first branch. Billing lengths of 1,
-- 6 (10% off) and 12 months (the price of 10), as src/config/pricing.json. A paid plan covers every branch of the
-- salon; a branch added while billing is on shows its price first and joins the next payment — nothing is charged
-- on its own.

-- Months paid, in tenths, for each billing length (src/config/pricing.json payTenths; SQL test 52 pins it).
create function public.plan_length_tenths(p_months int) returns int
language sql immutable set search_path = public as $$
  select case p_months when 1 then 10 when 6 then 54 when 12 then 100 end;
$$;

-- People who sign in, per branch: the owner and the accountant count once, at the first branch; everyone else at
-- their own branch (their default branch, else the first).
create function public.plan_branch_people(p_business uuid)
returns table (branch_id uuid, name text, people int, ord int)
language sql stable security definer set search_path = public as $$
  with br as (
    select b.id, b.name, row_number() over (order by b.created_at, b.id) as n
    from branches b where b.business_id = p_business
  ),
  counted as (
    select case when m.role in ('owner', 'accountant') or not exists (select 1 from br where br.id = m.default_branch_id)
                then (select br.id from br where br.n = 1) else m.default_branch_id end as branch_id
    from members m where m.business_id = p_business and m.active
  )
  select br.id, br.name, (select count(*)::int from counted c where c.branch_id = br.id), br.n::int
  from br order by br.n;
$$;

-- A salon's monthly price now: the sum over its branches (same columns as before, so every caller follows).
create or replace function public.plan_quote(p_business uuid, out people int, out included_people int, out base_minor bigint,
                                             out extra_person_minor bigint, out monthly_minor bigint, out currency text)
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(bp.people) from public.plan_branch_people(bu.id) bp), 0)::int, s.included_people,
         q.base, q.extra,
         coalesce((select sum(q.base + q.extra * greatest(bp.people - s.included_people, 0))
                   from public.plan_branch_people(bu.id) bp), 0)::bigint,
         q.currency
  from platform_settings s
  cross join businesses bu
  cross join lateral (
    select case when bu.country_code = 'AE' then s.price_per_branch_minor else s.intl_price_per_branch_minor end as base,
           case when bu.country_code = 'AE' then s.extra_person_minor else s.intl_extra_person_minor end as extra,
           case when bu.country_code = 'AE' then s.currency else s.intl_currency end as currency
  ) q
  where bu.id = p_business
$$;

-- Each branch's line of the bill, in the salon's currency or (p_card) in the card currency (USD, as Creem charges).
create function public.plan_branch_lines(p_business uuid, p_card boolean default false) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'branch_id', bp.branch_id, 'name', bp.name, 'people', bp.people,
           'extra_people', greatest(bp.people - s.included_people, 0),
           'monthly_minor', q.base + q.extra * greatest(bp.people - s.included_people, 0)) order by bp.ord), '[]'::jsonb)
  from platform_settings s
  cross join businesses bu
  cross join lateral (
    select case when not p_card and bu.country_code = 'AE' then s.price_per_branch_minor else s.intl_price_per_branch_minor end as base,
           case when not p_card and bu.country_code = 'AE' then s.extra_person_minor else s.intl_extra_person_minor end as extra
  ) q
  cross join lateral public.plan_branch_people(bu.id) bp
  where bu.id = p_business
$$;

-- The plan as the app shows it: access (free period, pilot, paid, free for good, billing on or off) and, per branch,
-- what each costs, with the totals for every billing length.
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
  v_today date := public.business_today(p_business);
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
    'active', public.plan_active(p_business),
    'billing_enabled', (select billing_enabled from platform_settings),
    'access_type', coalesce(s.access_type, 'trial'),
    'free_until', s.free_until,
    'free', coalesce(s.access_type = 'comp' or s.free_until >= v_today, false),
    'pilot_code', s.pilot_code,
    'paid_until', s.paid_until,
    'paid', coalesce(s.paid_until >= v_today, false),
    'trial', coalesce(s.access_type = 'trial' and s.free_until >= v_today, false),
    'today', v_today,
    'people', q.people,
    'included_people', q.included_people,
    'base_minor', q.base_minor,
    'extra_person_minor', q.extra_person_minor,
    'monthly_minor', q.monthly_minor,
    'currency', q.currency,
    'branches', public.plan_branch_lines(p_business),
    'lengths', (select jsonb_agg(jsonb_build_object('months', m, 'total_minor',
                  round(q.monthly_minor * public.plan_length_tenths(m) / 10.0)::bigint) order by m)
                from unnest(array[1, 6, 12]) m),
    'requested_at', v_request.created_at,
    'requested_months', v_request.months);
end;
$$;

-- The owner asks for the plan (bank transfer or a payment link): billing must be on; 1, 6 or 12 months; the amount
-- for every branch now is kept with the request for the console.
create or replace function public.request_plan(p_business uuid, p_months int, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  q record;
begin
  if not public.has_role(p_business, array['owner']::member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not (select billing_enabled from platform_settings) then
    raise exception 'billing_off' using errcode = '22023';
  end if;
  if p_months is null or public.plan_length_tenths(p_months) is null then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  select * into q from public.plan_quote(p_business);
  insert into plan_events (business_id, kind, months, amount_minor, currency, note, created_by)
  values (p_business, 'request', p_months, round(q.monthly_minor * public.plan_length_tenths(p_months) / 10.0)::bigint,
          q.currency, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
  perform public.write_audit(p_business, null, (select id from members where business_id = p_business and user_id = auth.uid()),
    'create', 'plan_request', null, 'Asked for the plan: ' || p_months || ' month(s)');
end;
$$;

-- A card payment, per branch in the card currency, with the length's discount. Billing must be on.
create or replace function public.card_checkout_start(p_business uuid, p_months int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s platform_settings;
  v_lines jsonb;
  v_people int;
  v_extra int;
  v_monthly bigint;
  v_amount bigint;
  v_id uuid;
begin
  select * into s from platform_settings;
  if not exists (select 1 from members where business_id = p_business and user_id = auth.uid() and active and role = 'owner') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not s.billing_enabled then
    raise exception 'billing_off' using errcode = '22023';
  end if;
  if s.card_payments = 'off' or (s.card_payments = 'test' and not public.is_platform_admin()) then
    raise exception 'card_unavailable' using errcode = '22023';
  end if;
  if p_months is null or public.plan_length_tenths(p_months) is null then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  v_lines := public.plan_branch_lines(p_business, true);
  select coalesce(sum((l ->> 'people')::int), 0), coalesce(sum((l ->> 'extra_people')::int), 0),
         coalesce(sum((l ->> 'monthly_minor')::bigint), 0)
    into v_people, v_extra, v_monthly
  from jsonb_array_elements(v_lines) l;
  v_amount := round(v_monthly * public.plan_length_tenths(p_months) / 10.0)::bigint;
  insert into card_payments (business_id, mode, months, people, extra_people, amount_minor, currency, created_by)
  values (p_business, s.card_payments, p_months, v_people, v_extra, v_amount, s.intl_currency, auth.uid())
  returning id into v_id;
  return jsonb_build_object('request_id', v_id, 'mode', s.card_payments, 'months', p_months, 'people', v_people,
    'extra_people', v_extra, 'amount_minor', v_amount, 'base_minor', s.intl_price_per_branch_minor * p_months,
    'currency', s.intl_currency, 'branches', v_lines, 'email', (select email from auth.users where id = auth.uid()),
    'salon_code', (select code from businesses where id = p_business));
end;
$$;

-- The owner adds a branch: its name, type, address and phone; the first branch's tax, receipt and opening-day
-- settings and logo; a stock line for every item; its own sale numbers; starter rooms for the types that use rooms.
-- Up to 20 branches.
create function public.create_branch(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := (p ->> 'business_id')::uuid;
  m members;
  f branches;
  v_name text := btrim(coalesce(p ->> 'name', ''));
  v_mode salon_mode;
  v_id uuid;
begin
  select * into m from members where business_id = v_business and user_id = auth.uid() and active and role = 'owner';
  if m.id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform public.require_plan(v_business);
  if char_length(v_name) not between 2 and 60 then
    raise exception 'name_required' using errcode = '22023';
  end if;
  if exists (select 1 from branches where business_id = v_business and lower(name) = lower(v_name)) then
    raise exception 'branch_name_taken' using errcode = '23505';
  end if;
  if (select count(*) from branches where business_id = v_business) >= 20 then
    raise exception 'too_many_branches' using errcode = '22023';
  end if;
  select * into f from branches where business_id = v_business order by created_at, id limit 1;
  v_mode := coalesce(nullif(p ->> 'mode', '')::salon_mode, f.mode);
  -- Its own moment (not the transaction's), so the salon's first branch is always the one it started with.
  insert into branches (business_id, name, mode, address, phone, opening_hours, vat_mode, trn, tax_name, tax_rate_bps,
                        tax_inclusive, tax_id_label, legal_name, tax2_name, tax2_rate_bps, logo_path, settings, created_at)
  values (v_business, v_name, v_mode, nullif(btrim(coalesce(p ->> 'address', '')), ''),
          nullif(btrim(coalesce(p ->> 'phone', '')), ''), f.opening_hours, f.vat_mode, f.trn, f.tax_name, f.tax_rate_bps,
          f.tax_inclusive, f.tax_id_label, f.legal_name, f.tax2_name, f.tax2_rate_bps, f.logo_path,
          coalesce(f.settings, '{}'::jsonb) - 'opening_cash_set' - 'opening_stock_set', clock_timestamp())
  returning id into v_id;
  insert into member_branches (member_id, branch_id) values (m.id, v_id);
  insert into stock_levels (item_id, branch_id, qty) select i.id, v_id, 0 from inventory_items i where i.business_id = v_business;
  insert into sale_counters (branch_id) values (v_id);
  if v_mode = 'ladies' then
    insert into rooms (business_id, branch_id, name, kind) values
      (v_business, v_id, 'Spa room 1', 'room'), (v_business, v_id, 'Spa room 2', 'room');
  elsif v_mode = 'wellness' then
    insert into rooms (business_id, branch_id, name, kind) values
      (v_business, v_id, 'Treatment room 1', 'room'), (v_business, v_id, 'Treatment room 2', 'room');
  end if;
  perform public.write_audit(v_business, v_id, m.id, 'create', 'branch', v_id, 'Added the branch ' || v_name);
  return v_id;
end;
$$;

-- Moves the person to another branch they work at: the app opens it from then on (the session's branch).
create function public.set_my_branch(p_branch uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_use_branch(p_branch) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update members set default_branch_id = p_branch
  where user_id = auth.uid() and active and business_id = (select business_id from branches where id = p_branch);
end;
$$;

revoke execute on function public.plan_length_tenths(int), public.plan_branch_people(uuid),
  public.plan_branch_lines(uuid, boolean), public.create_branch(jsonb), public.set_my_branch(uuid)
  from public, anon, authenticated;
grant execute on function public.create_branch(jsonb), public.set_my_branch(uuid) to authenticated;
