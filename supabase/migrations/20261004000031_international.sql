-- Salons in any country (owner, 2026-10-04). The owner picks the country at setup; it brings the currency, time zone
-- and sales tax (all editable). Tax is per branch: its name (VAT, GST, Sales tax), rate, whether prices include it,
-- and the label of the tax number. Tax rates are basis points with one decimal, for rates like 8.875% (887.5). UAE rules (15-digit TRN, WPS, the UAE document checklist) apply only to UAE
-- salons. The plan costs AED 99 per branch in the UAE and USD 29 elsewhere.

alter table public.branches
  add column tax_name text not null default 'VAT' check (length(btrim(tax_name)) between 1 and 20),
  add column tax_rate_bps numeric(6, 1) not null default 500 check (tax_rate_bps between 0 and 3000),
  add column tax_inclusive boolean not null default true,
  add column tax_id_label text not null default 'TRN' check (length(btrim(tax_id_label)) between 1 and 20);

-- Each sale keeps the rate and the kind of tax it was charged with (every sale so far: 5% included).
alter table public.sales
  add column tax_rate_bps numeric(6, 1) not null default 500,
  add column tax_inclusive boolean not null default true;

alter table public.businesses
  add constraint businesses_country_code check (country_code ~ '^[A-Z]{2}$'),
  add constraint businesses_currency check (currency ~ '^[A-Z]{3}$');

-- A supplier's tax number is 15 digits in the UAE (checked in the app) and other shapes elsewhere.
alter table public.suppliers drop constraint suppliers_trn_check;
alter table public.suppliers add constraint suppliers_trn_check
  check (trn is null or trn ~ '^[A-Za-z0-9][A-Za-z0-9 ./-]{1,28}[A-Za-z0-9]$');

alter table public.platform_settings
  add column intl_price_per_branch_minor bigint not null default 2900 check (intl_price_per_branch_minor >= 0),
  add column intl_currency text not null default 'USD';
alter table public.plan_events add column currency text;
update public.plan_events set currency = 'AED' where amount_minor is not null;

-- Minor-unit decimals (ISO 4217) of the currencies the app offers; same list as src/lib/currencies.ts.
create function public.currency_decimals(p_currency text) returns int
language sql immutable set search_path = public as $$
  select case when p_currency in ('KWD', 'BHD', 'OMR', 'JOD', 'TND') then 3
              when p_currency in ('JPY', 'VND', 'CLP') then 0
              else 2 end
$$;

-- Money in words for audit lines and notifications: "AED 1,250.00", "KWD 3.500", "JPY 4,000". Without a currency,
-- the signed-in person's salon currency.
create or replace function public.fmt_money(p_minor bigint, p_currency text default null) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_currency text := coalesce(p_currency,
    (select b.currency from members m join businesses b on b.id = m.business_id
     where m.user_id = auth.uid() and m.active order by m.created_at limit 1), 'AED');
  v_decimals int := public.currency_decimals(v_currency);
begin
  return case when p_minor < 0 then '-' else '' end || v_currency || ' ' ||
    case v_decimals
      when 0 then to_char(abs(p_minor), 'FM999,999,999,999,990')
      when 3 then to_char(abs(p_minor) / 1000.0, 'FM999,999,999,990.000')
      else to_char(abs(p_minor) / 100.0, 'FM999,999,999,990.00') end;
end;
$$;

-- Starter service prices are written in AED. Elsewhere they are converted at a rough rate (units per AED, 2026) and
-- rounded to two significant figures, so a new salon in Mumbai starts with a INR 570 haircut, not INR 25. The owner
-- sets real prices in Services.
create function public.starter_price(p_aed_fils bigint, p_currency text) returns bigint
language plpgsql immutable set search_path = public as $$
declare
  v_rate numeric := case p_currency
    when 'SAR' then 1.02 when 'QAR' then 0.99 when 'KWD' then 0.083 when 'BHD' then 0.102 when 'OMR' then 0.105
    when 'EGP' then 13.5 when 'JOD' then 0.193 when 'MAD' then 2.5 when 'TND' then 0.83 when 'TRY' then 11
    when 'ZAR' then 4.8 when 'NGN' then 420 when 'KES' then 35 when 'GHS' then 3.3 when 'INR' then 23.5
    when 'PKR' then 77 when 'BDT' then 33 when 'LKR' then 81 when 'NPR' then 37 when 'SGD' then 0.35
    when 'MYR' then 1.17 when 'PHP' then 15.5 when 'IDR' then 4400 when 'THB' then 8.9 when 'VND' then 7000
    when 'JPY' then 40 when 'AUD' then 0.42 when 'NZD' then 0.46 when 'GBP' then 0.2 when 'EUR' then 0.235
    when 'CHF' then 0.22 when 'SEK' then 2.6 when 'NOK' then 2.75 when 'DKK' then 1.75 when 'PLN' then 1.0
    when 'USD' then 0.272 when 'CAD' then 0.375 when 'MXN' then 5.1 when 'BRL' then 1.5 when 'COP' then 1100
    when 'CLP' then 260 else 1 end;
  v_major numeric := p_aed_fils / 100.0 * v_rate;
  v_step numeric;
begin
  if coalesce(p_currency, 'AED') = 'AED' or v_major <= 0 then
    return p_aed_fils;
  end if;
  v_step := 10 ^ (floor(log(v_major)) - 1);
  return round(round(v_major / v_step) * v_step * 10 ^ public.currency_decimals(p_currency))::bigint;
end;
$$;

-- The plan price for one salon: AED in the UAE, the international price elsewhere.
create function public.plan_price(p_business uuid, out price_minor bigint, out currency text)
language sql stable security definer set search_path = public as $$
  select case when bu.country_code = 'AE' then s.price_per_branch_minor else s.intl_price_per_branch_minor end,
         case when bu.country_code = 'AE' then s.currency else s.intl_currency end
  from platform_settings s cross join businesses bu
  where bu.id = p_business
$$;

drop function public.admin_salons();

create or replace function public.create_business(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_user uuid := auth.uid();
  v_business uuid;
  v_branch uuid;
  v_member uuid;
  v_mode salon_mode := (p ->> 'mode')::salon_mode;
  v_vat vat_mode := coalesce(nullif(p ->> 'vat_mode', ''), 'off')::vat_mode;
  v_cash bigint := coalesce((p ->> 'opening_cash_minor')::bigint, 0);
  v_code text;
  v_country text := upper(coalesce(nullif(btrim(p ->> 'country_code'), ''), 'AE'));
  v_currency text := upper(coalesce(nullif(btrim(p ->> 'currency'), ''), case when v_country = 'AE' then 'AED' end));
  v_timezone text := coalesce(nullif(btrim(p ->> 'timezone'), ''), case when v_country = 'AE' then 'Asia/Dubai' end);
  v_tax_rate numeric := coalesce((p ->> 'tax_rate_bps')::numeric, case when v_country = 'AE' then 500 else 0 end);
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  -- One setup at a time per owner: a double tap or a retry after a timeout must not create two
  -- salons (both requests would pass the check below before either had committed).
  perform pg_advisory_xact_lock(hashtextextended('create_business:' || v_user::text, 0));
  if exists (select 1 from members where user_id = v_user) then
    raise exception 'already_has_business' using errcode = '23505';
  end if;
  if v_mode is null then
    raise exception 'mode_required' using errcode = '22023';
  end if;
  if v_cash < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  -- Any country: its currency, time zone and sales tax (rate, name, included in prices or added on top). The UAE
  -- tax number (TRN) is 15 digits; elsewhere a tax number is optional and free-form.
  if v_country !~ '^[A-Z]{2}$' or coalesce(v_currency, '') !~ '^[A-Z]{3}$'
     or not exists (select 1 from pg_timezone_names where name = v_timezone) then
    raise exception 'invalid_country' using errcode = '22023';
  end if;
  if v_tax_rate not between 0 and 3000 or v_tax_rate <> round(v_tax_rate, 1) then
    raise exception 'invalid_tax_rate' using errcode = '22023';
  end if;
  if v_vat = 'on' and v_country = 'AE' and coalesce(btrim(p ->> 'trn'), '') !~ '^[0-9]{15}$' then
    raise exception 'trn_required' using errcode = '22023';
  end if;

  -- Two salons signing up at the same moment can draw the same free code; the second draws again.
  for attempt in 1..5 loop
    v_code := public.unique_business_code(p ->> 'business_name');
    begin
      insert into businesses (name, code, created_by, is_demo, country_code, currency, timezone)
      values (btrim(p ->> 'business_name'), v_code, v_user, coalesce((p ->> 'is_demo')::boolean, false),
              v_country, v_currency, v_timezone)
      returning id into v_business;
      exit;
    exception when unique_violation then
      if attempt = 5 then
        raise;
      end if;
    end;
  end loop;

  insert into branches (business_id, name, mode, address, phone, opening_hours, vat_mode, trn, tax_name, tax_rate_bps,
                        tax_inclusive, tax_id_label, settings)
  values (
    v_business,
    coalesce(nullif(btrim(p ->> 'branch_name'), ''), btrim(p ->> 'business_name')),
    v_mode,
    nullif(btrim(p ->> 'address'), ''),
    nullif(btrim(p ->> 'phone'), ''),
    coalesce(p -> 'opening_hours', '{"open":"09:00","close":"22:00","days":[0,1,2,3,4,5,6]}'::jsonb),
    v_vat,
    case when v_vat = 'on' then nullif(btrim(p ->> 'trn'), '') end,
    coalesce(nullif(btrim(p ->> 'tax_name'), ''), 'VAT'),
    v_tax_rate,
    coalesce((p ->> 'tax_inclusive')::boolean, true),
    coalesce(nullif(btrim(p ->> 'tax_id_label'), ''), case when v_country = 'AE' then 'TRN' else 'Tax ID' end),
    jsonb_build_object(
      'waiting_target_min', 10, 'cancel_cutoff_hours', 12, 'default_deposit_minor', 0,
      'staff_can_sell', false, 'block_insufficient_stock', false,
      'tax_confirmed', true, 'opening_cash_set', v_cash > 0
    )
  )
  returning id into v_branch;

  insert into members (business_id, user_id, role, display_name, default_branch_id)
  values (v_business, v_user, 'owner', coalesce(nullif(btrim(p ->> 'owner_name'), ''), 'Owner'), v_branch)
  returning id into v_member;
  insert into member_branches (member_id, branch_id) values (v_member, v_branch);

  perform public.seed_system_accounts(v_business);
  insert into periods (business_id, month) values (v_business, to_char(public.branch_today(v_branch), 'YYYY-MM'));
  perform public.seed_mode_catalogue(v_business, v_branch, v_mode);
  insert into sale_counters (branch_id) values (v_branch);

  if v_cash > 0 then
    perform public.post_journal(v_business, v_branch, public.branch_today(v_branch), 'opening_cash', v_branch,
      'Opening cash', v_member,
      jsonb_build_array(jsonb_build_object('account', 'cash', 'debit', v_cash),
                        jsonb_build_object('account', 'owner_equity', 'credit', v_cash)));
  end if;

  perform public.write_audit(v_business, v_branch, v_member, 'create', 'business', v_business,
    'Set up ' || btrim(p ->> 'business_name'));

  return jsonb_build_object('business_id', v_business, 'branch_id', v_branch, 'member_id', v_member, 'code', v_code);
end;
$$;

create or replace function public.update_branch(p_branch uuid, p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  m members := public.require_member(p_branch, array['owner']::member_role[]);
  v_settings jsonb := coalesce(p -> 'settings', '{}'::jsonb);
  v_allowed text[] := array['waiting_target_min', 'cancel_cutoff_hours', 'default_deposit_minor',
                            'staff_can_sell', 'block_insufficient_stock', 'late_grace_min', 'require_hygiene_evidence',
                            'receipt_mode'];
  k text;
begin
  for k in select jsonb_object_keys(v_settings) loop
    if not (k = any (v_allowed)) then
      raise exception 'unknown_setting: %', k using errcode = '22023';
    end if;
  end loop;
  -- Customer receipt after a sale: none, a simple printed/shared receipt, or sent on WhatsApp.
  if v_settings ? 'receipt_mode' and not (v_settings ->> 'receipt_mode' = any (array['off', 'simple', 'whatsapp'])) then
    raise exception 'unknown_setting: receipt_mode' using errcode = '22023';
  end if;
  if p ? 'vat_mode' and p ->> 'vat_mode' = 'on'
     and (select country_code from businesses where id = m.business_id) = 'AE'
     and coalesce(btrim(p ->> 'trn'), (select trn from branches where id = p_branch), '') !~ '^[0-9]{15}$' then
    raise exception 'trn_required' using errcode = '22023';
  end if;
  if p ? 'tax_rate_bps' and (coalesce((p ->> 'tax_rate_bps')::numeric, -1) not between 0 and 3000
                             or (p ->> 'tax_rate_bps')::numeric <> round((p ->> 'tax_rate_bps')::numeric, 1)) then
    raise exception 'invalid_tax_rate' using errcode = '22023';
  end if;
  update branches set
    name = coalesce(nullif(btrim(p ->> 'name'), ''), name),
    address = case when p ? 'address' then nullif(btrim(p ->> 'address'), '') else address end,
    phone = case when p ? 'phone' then nullif(btrim(p ->> 'phone'), '') else phone end,
    vat_mode = coalesce((p ->> 'vat_mode')::vat_mode, vat_mode),
    trn = case when p ? 'trn' then nullif(btrim(p ->> 'trn'), '') else trn end,
    tax_name = coalesce(nullif(btrim(p ->> 'tax_name'), ''), tax_name),
    tax_rate_bps = coalesce((p ->> 'tax_rate_bps')::numeric, tax_rate_bps),
    tax_inclusive = coalesce((p ->> 'tax_inclusive')::boolean, tax_inclusive),
    tax_id_label = coalesce(nullif(btrim(p ->> 'tax_id_label'), ''), tax_id_label),
    settings = settings || v_settings || jsonb_build_object('tax_confirmed', true)
  where id = p_branch;
  perform public.write_audit(m.business_id, p_branch, m.id, 'update', 'branch', p_branch, 'Updated branch settings');
end;
$$;

create or replace function public.create_sale(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_member(v_branch, array['owner', 'cashier', 'staff']::member_role[]);
  b branches;
  bu businesses;
  v_ref text := nullif(p ->> 'client_ref', '');
  v_existing sales;
  a appointments;
  v_customer customers;
  v_default_employee uuid;
  l jsonb;
  v_idx int := 0;
  v_kind text;
  v_qty numeric;
  v_name text;
  v_price bigint;
  v_service services;
  v_item inventory_items;
  v_subtotal bigint;
  v_discount bigint;
  v_net bigint;
  v_vat bigint;
  v_tip bigint := coalesce((p ->> 'tip_minor')::bigint, 0);
  v_total bigint;
  v_deposit bigint := 0;
  v_deposit_left bigint := 0;
  v_due bigint;
  v_paid bigint := 0;
  pay jsonb;
  v_sale uuid;
  v_number int;
  v_today date;
  v_weights bigint[];
  v_parts bigint[];
  r record;
  v_used numeric;
  v_level numeric;
  v_cost bigint := 0;
  v_cogs bigint := 0;
  v_product bigint;
  v_warnings text[] := '{}';
  v_shortages text[] := '{}';
  v_block boolean;
  v_journal jsonb := '[]';
begin
  if v_ref is not null then
    select * into v_existing from sales where client_ref = v_ref;
    if v_existing.id is not null then
      return jsonb_build_object('sale_id', v_existing.id, 'number', v_existing.number,
        'total_minor', v_existing.total_minor, 'vat_minor', v_existing.vat_minor,
        'deposit_applied_minor', v_existing.deposit_applied_minor, 'warnings', '[]'::jsonb, 'repeated', true);
    end if;
  end if;

  select * into b from branches where id = v_branch;
  select * into bu from businesses where id = b.business_id;
  v_today := public.branch_today(v_branch);
  if m.role = 'staff' and not coalesce((b.settings ->> 'staff_can_sell')::boolean, false) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  if nullif(p ->> 'appointment_id', '') is not null then
    select * into a from appointments where id = (p ->> 'appointment_id')::uuid and branch_id = v_branch for update;
    if a.id is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    if a.status not in ('booked', 'waiting', 'in_progress') then
      raise exception 'invalid_status' using errcode = '22023';
    end if;
  end if;

  if nullif(p ->> 'customer_id', '') is not null or a.customer_id is not null then
    select * into v_customer from customers
    where id = coalesce(nullif(p ->> 'customer_id', '')::uuid, a.customer_id) and business_id = b.business_id;
    if v_customer.id is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  end if;

  v_default_employee := coalesce(nullif(p ->> 'employee_id', '')::uuid, a.employee_id,
    (select id from employees where member_id = m.id and active));
  if v_default_employee is not null
     and not exists (select 1 from employees where id = v_default_employee and branch_id = v_branch) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  drop table if exists _sale_lines;
  create temp table _sale_lines (
    idx int, kind sale_line_kind, service_id uuid, item_id uuid, name text, qty numeric, unit_price bigint, gross bigint,
    discount bigint default 0, net bigint default 0, vat bigint default 0, employee_id uuid,
    commission_bps int default 0, commission bigint default 0
  ) on commit drop;

  for l in select * from jsonb_array_elements(coalesce(p -> 'lines', '[]')) loop
    v_idx := v_idx + 1;
    v_kind := coalesce(nullif(l ->> 'kind', ''), 'service');
    v_qty := coalesce((l ->> 'qty')::numeric, 1);
    if v_qty <= 0 then
      raise exception 'invalid_qty' using errcode = '22023';
    end if;
    if v_kind = 'service' then
      select * into v_service from services
      where id = (l ->> 'service_id')::uuid and business_id = b.business_id and status = 'active';
      if v_service.id is null then
        raise exception 'service_unavailable' using errcode = '22023';
      end if;
      v_name := v_service.name;
      v_price := v_service.price_minor;
      v_item := null;
    elsif v_kind = 'retail' then
      select * into v_item from inventory_items
      where id = (l ->> 'item_id')::uuid and business_id = b.business_id and kind = 'retail' and active
        and sell_price_minor is not null;
      if v_item.id is null then
        raise exception 'item_unavailable' using errcode = '22023';
      end if;
      v_name := v_item.name;
      v_price := v_item.sell_price_minor;
      v_service := null;
    elsif v_kind = 'custom' then
      v_name := nullif(btrim(l ->> 'name'), '');
      v_price := (l ->> 'unit_price_minor')::bigint;
      if v_name is null or v_price is null or v_price < 0 then
        raise exception 'invalid_line' using errcode = '22023';
      end if;
      v_service := null;
      v_item := null;
    else
      raise exception 'invalid_line' using errcode = '22023';
    end if;
    insert into _sale_lines (idx, kind, service_id, item_id, name, qty, unit_price, gross, employee_id)
    values (v_idx, v_kind::sale_line_kind, v_service.id, v_item.id, v_name, v_qty, v_price, round(v_price * v_qty)::bigint,
            coalesce(nullif(l ->> 'employee_id', '')::uuid, v_default_employee));
  end loop;
  if v_idx = 0 then
    raise exception 'lines_required' using errcode = '22023';
  end if;

  select sum(gross) into v_subtotal from _sale_lines;
  if p ? 'discount_bps' and (p ->> 'discount_bps') is not null then
    if (p ->> 'discount_bps')::int not between 0 and 10000 then
      raise exception 'invalid_discount' using errcode = '22023';
    end if;
    v_discount := round(v_subtotal * (p ->> 'discount_bps')::numeric / 10000)::bigint;
  else
    v_discount := coalesce((p ->> 'discount_minor')::bigint, 0);
  end if;
  if v_discount < 0 or v_discount > v_subtotal then
    raise exception 'invalid_discount' using errcode = '22023';
  end if;
  if v_tip < 0 then
    raise exception 'invalid_tip' using errcode = '22023';
  end if;

  -- Spread the discount over the lines, then the tax over the nets: at the branch's rate, either contained in the
  -- prices (5% VAT: 5/105 of the net) or added on top (8% sales tax: 8% of the net). Added tax then becomes part of
  -- each line's net, exactly like included tax, so totals, the journal, commission (on net less tax) and refunds
  -- work the same way for both.
  select array_agg(gross order by idx) into v_weights from _sale_lines;
  v_parts := public.allocate_minor(v_discount, v_weights);
  update _sale_lines set discount = v_parts[idx], net = gross - v_parts[idx] where true;
  v_net := v_subtotal - v_discount;
  v_vat := case when b.vat_mode <> 'on' or b.tax_rate_bps = 0 then 0
                when b.tax_inclusive then round(v_net * b.tax_rate_bps::numeric / (10000 + b.tax_rate_bps))::bigint
                else round(v_net * b.tax_rate_bps::numeric / 10000)::bigint end;
  select array_agg(net order by idx) into v_weights from _sale_lines;
  v_parts := public.allocate_minor(v_vat, v_weights);
  update _sale_lines set vat = v_parts[idx] where true;
  if b.vat_mode = 'on' and not b.tax_inclusive then
    update _sale_lines set net = net + vat where true;
    v_net := v_net + v_vat;
  end if;
  update _sale_lines sl set
    commission_bps = coalesce(e.commission_bps, 0),
    commission = round((sl.net - sl.vat) * coalesce(e.commission_bps, 0)::numeric / 10000)::bigint
  from employees e where e.id = sl.employee_id and sl.kind <> 'retail';   -- commission is on services only

  v_total := v_net + v_tip;
  if a.id is not null and a.deposit_status = 'held' and coalesce((p ->> 'use_deposit')::boolean, true) then
    v_deposit := least(a.deposit_minor, v_total);
    v_deposit_left := a.deposit_minor - v_deposit;
  end if;
  v_due := v_total - v_deposit;

  for pay in select * from jsonb_array_elements(coalesce(p -> 'payments', '[]')) loop
    if (pay ->> 'method') not in ('cash', 'card', 'wallet') or coalesce((pay ->> 'amount_minor')::bigint, 0) <= 0 then
      raise exception 'invalid_payment' using errcode = '22023';
    end if;
    v_paid := v_paid + (pay ->> 'amount_minor')::bigint;
  end loop;
  if v_paid <> v_due then
    raise exception 'payment_mismatch: due % paid %', v_due, v_paid using errcode = '22023';
  end if;

  update sale_counters set next_number = next_number + 1 where branch_id = v_branch
  returning next_number - 1 into v_number;

  insert into sales (business_id, branch_id, number, business_date, customer_id, customer_name, appointment_id,
                     employee_id, subtotal_minor, discount_minor, vat_minor, tip_minor, tip_employee_id,
                     total_minor, deposit_applied_minor, vat_mode, tax_rate_bps, tax_inclusive, note, client_ref,
                     created_by)
  values (b.business_id, v_branch, v_number, v_today, v_customer.id,
          coalesce(v_customer.name, a.customer_name), a.id, v_default_employee, v_subtotal, v_discount, v_vat, v_tip,
          case when v_tip > 0 then coalesce(nullif(p ->> 'tip_employee_id', '')::uuid, v_default_employee) end,
          v_total, v_deposit, b.vat_mode, b.tax_rate_bps, b.tax_inclusive, nullif(btrim(p ->> 'note'), ''), v_ref, m.id)
  returning id into v_sale;

  insert into sale_lines (sale_id, kind, service_id, item_id, name_snapshot, qty, unit_price_minor, discount_minor,
                          net_minor, vat_minor, employee_id, commission_bps, commission_minor)
  select v_sale, kind, service_id, item_id, name, qty, unit_price, discount, net, vat, employee_id, commission_bps, commission
  from _sale_lines order by idx;

  insert into sale_payments (sale_id, method, amount_minor)
  select v_sale, (x ->> 'method')::payment_method, (x ->> 'amount_minor')::bigint
  from jsonb_array_elements(coalesce(p -> 'payments', '[]')) x;

  -- Stock: recipe use for services, the item itself for retail. Shortage warns, or blocks when the branch
  -- setting says so.
  v_block := coalesce((b.settings ->> 'block_insufficient_stock')::boolean, false);
  for r in
    select x.item_id, i.name, i.avg_unit_cost_minor, x.reason, sum(x.used) as used
    from (select ri.item_id, 'service_use'::stock_reason as reason, ri.qty * sl.qty as used
          from _sale_lines sl join service_recipe_items ri on ri.service_id = sl.service_id
          union all
          select sl.item_id, 'retail_sale'::stock_reason, sl.qty from _sale_lines sl where sl.kind = 'retail') x
    join inventory_items i on i.id = x.item_id
    group by x.item_id, i.name, i.avg_unit_cost_minor, x.reason
  loop
    insert into stock_levels (item_id, branch_id, qty) values (r.item_id, v_branch, 0) on conflict do nothing;
    select qty into v_level from stock_levels where item_id = r.item_id and branch_id = v_branch for update;
    if v_level < r.used then
      v_shortages := v_shortages || r.name;
    end if;
    update stock_levels set qty = qty - r.used where item_id = r.item_id and branch_id = v_branch;
    insert into stock_movements (business_id, branch_id, item_id, qty_delta, reason, unit_cost_minor, ref_type, ref_id,
                                 created_by)
    values (b.business_id, v_branch, r.item_id, -r.used, r.reason, r.avg_unit_cost_minor, 'sale', v_sale, m.id);
    if r.reason = 'retail_sale' then
      v_cogs := v_cogs + round(r.used * r.avg_unit_cost_minor)::bigint;
    else
      v_cost := v_cost + round(r.used * r.avg_unit_cost_minor)::bigint;
    end if;
  end loop;
  if array_length(v_shortages, 1) > 0 then
    if v_block then
      raise exception 'insufficient_stock: %', array_to_string(v_shortages, ', ') using errcode = '22023';
    end if;
    v_warnings := v_warnings || ('low_stock: ' || array_to_string(v_shortages, ', '));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('account', public.method_account((x ->> 'method')::payment_method),
                                               'debit', (x ->> 'amount_minor')::bigint)), '[]')
    into v_journal
  from jsonb_array_elements(coalesce(p -> 'payments', '[]')) x;
  select coalesce(sum(net - vat) filter (where kind = 'retail'), 0) into v_product from _sale_lines;
  v_journal := v_journal
    || jsonb_build_array(
         jsonb_build_object('account', 'deposits_held', 'debit', v_deposit),
         jsonb_build_object('account', 'service_revenue', 'credit', v_net - v_vat - v_product),
         jsonb_build_object('account', 'product_revenue', 'credit', v_product),
         jsonb_build_object('account', 'vat_payable', 'credit', v_vat),
         jsonb_build_object('account', 'tips_payable', 'credit', v_tip),
         jsonb_build_object('account', 'consumables_used', 'debit', v_cost),
         jsonb_build_object('account', 'inventory', 'credit', v_cost),
         jsonb_build_object('account', 'cost_of_goods_sold', 'debit', v_cogs),
         jsonb_build_object('account', 'inventory', 'credit', v_cogs));
  perform public.post_journal(b.business_id, v_branch, v_today, 'sale', v_sale, 'Sale #' || v_number, m.id, v_journal);

  if v_deposit_left > 0 then
    -- Deposit larger than the bill: the rest goes back the way it came.
    perform public.post_journal(b.business_id, v_branch, v_today, 'deposit_refund', a.id, 'Deposit above bill', m.id,
      jsonb_build_array(jsonb_build_object('account', 'deposits_held', 'debit', v_deposit_left),
                        jsonb_build_object('account', public.method_account(a.deposit_method), 'credit', v_deposit_left)));
  end if;

  if v_customer.id is not null then
    update customers set visit_count = visit_count + 1, last_visit_at = now() where id = v_customer.id;
  end if;
  if a.id is not null then
    update appointments set status = 'completed', completed_at = now(), sale_id = v_sale, updated_at = now(),
      started_at = coalesce(started_at, now()),
      deposit_status = case when v_deposit > 0 then 'applied' else deposit_status end
    where id = a.id;
  end if;

  perform public.write_audit(b.business_id, v_branch, m.id, 'create', 'sale', v_sale,
    'Saved sale #' || v_number || ' · ' || public.fmt_money(v_total, bu.currency));

  return jsonb_build_object('sale_id', v_sale, 'number', v_number, 'total_minor', v_total, 'vat_minor', v_vat,
    'deposit_applied_minor', v_deposit, 'due_minor', v_due, 'warnings', to_jsonb(v_warnings), 'repeated', false);
end;
$$;

create or replace function public.seed_mode_catalogue(p_business uuid, p_branch uuid, p_mode salon_mode)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  -- [category, icon]
  cats jsonb := case p_mode
    when 'gents' then '[["Hair","scissors"],["Beard","brush"],["Colour","palette"],["Face","face"],["Massage","massage"]]'
    else '[["Hair","scissors"],["Colour","palette"],["Nails","hand"],["Facial","sparkles"],["Makeup","brush"],["Waxing & threading","feather"],["Spa & massage","flower"],["Bridal","gem"]]'
  end;
  -- [item, unit]
  items jsonb := case p_mode
    when 'gents' then '[["Blades","pcs"],["Shaving Foam","ml"],["Hair Oil","ml"],["Developer 20 Vol","ml"],["Beard Color","ml"],["Hair Color","ml"],["Gloves","pairs"],["Neck strips","pcs"],["Tissues","pcs"]]'
    else '[["Styling cream","ml"],["Heat spray","ml"],["Hair Color","ml"],["Developer 20 Vol","ml"],["Gloves","pairs"],["Nail polish","ml"],["Gel polish","ml"],["Face masks","pcs"],["Thread","pcs"],["Wax","g"],["Black soap","g"],["Massage oil","ml"]]'
  end;
  -- [service, category, price in AED fils (converted to the salon's currency), minutes, requires_room, patch_test, [[item, qty], ...]]
  svcs jsonb := case p_mode
    when 'gents' then '[
      ["Haircut","Hair",2500,30,false,false,[["Neck strips",1]]],
      ["Shave","Beard",1500,15,false,false,[["Blades",1],["Shaving Foam",10]]],
      ["Beard Trim","Beard",1000,15,false,false,[["Neck strips",1]]],
      ["Beard Color","Colour",4500,30,false,false,[["Beard Color",20],["Developer 20 Vol",20],["Gloves",1]]],
      ["Hair Color","Colour",8000,45,false,true,[["Hair Color",40],["Developer 20 Vol",40],["Gloves",1]]],
      ["Facial","Face",6000,40,false,false,[["Tissues",4]]],
      ["Head Massage","Massage",3500,20,false,false,[["Hair Oil",15]]]]'
    else '[
      ["Hair Styling","Hair",15000,60,false,false,[["Styling cream",10]]],
      ["Blow-dry","Hair",8000,45,false,false,[["Heat spray",5]]],
      ["Hair Color","Colour",25000,90,false,true,[["Hair Color",60],["Developer 20 Vol",60],["Gloves",1]]],
      ["Manicure","Nails",7000,40,false,false,[["Nail polish",2]]],
      ["Pedicure","Nails",9000,50,false,false,[["Nail polish",2]]],
      ["Gel Nails","Nails",12000,60,false,false,[["Gel polish",3]]],
      ["Facial & Eye","Facial",18000,60,false,false,[["Face masks",1]]],
      ["Threading","Waxing & threading",2500,15,false,false,[["Thread",1]]],
      ["Waxing","Waxing & threading",6000,30,false,false,[["Wax",30]]],
      ["Bridal Makeup","Bridal",95000,120,false,false,[]],
      ["Moroccan Bath","Spa & massage",22000,60,true,false,[["Black soap",30]]],
      ["Swedish Massage","Spa & massage",30000,60,true,false,[["Massage oil",20]]]]'
  end;
  c jsonb;
  s jsonb;
  r jsonb;
  i int := 0;
  v_cat uuid;
  v_item uuid;
  v_service uuid;
  v_currency text := (select currency from businesses where id = p_business);
begin
  for c in select * from jsonb_array_elements(cats) loop
    insert into service_categories (business_id, name, icon, sort) values (p_business, c ->> 0, c ->> 1, i);
    i := i + 1;
  end loop;
  for c in select * from jsonb_array_elements(items) loop
    insert into inventory_items (business_id, name, kind, unit, reorder_level)
    values (p_business, c ->> 0, 'consumable', c ->> 1, 0)
    returning id into v_item;
    insert into stock_levels (item_id, branch_id, qty) values (v_item, p_branch, 0);
  end loop;
  for s in select * from jsonb_array_elements(svcs) loop
    select id into v_cat from service_categories where business_id = p_business and name = s ->> 1;
    insert into services (business_id, category_id, name, price_minor, duration_min, requires_room, requires_patch_test)
    values (p_business, v_cat, s ->> 0, public.starter_price((s ->> 2)::bigint, v_currency), (s ->> 3)::int, (s ->> 4)::boolean, (s ->> 5)::boolean)
    returning id into v_service;
    for r in select * from jsonb_array_elements(s -> 6) loop
      select id into v_item from inventory_items where business_id = p_business and name = r ->> 0;
      insert into service_recipe_items (service_id, item_id, qty) values (v_service, v_item, (r ->> 1)::numeric);
    end loop;
  end loop;
  if p_mode = 'ladies' then
    insert into rooms (business_id, branch_id, name, kind) values
      (p_business, p_branch, 'Spa room 1', 'room'), (p_business, p_branch, 'Spa room 2', 'room');
  end if;
end;
$$;

create or replace function public.compliance_status(p_business uuid)
 RETURNS TABLE(slot_key text, doc_type text, holder_type text, branch_id uuid, employee_id uuid, holder_name text, required boolean, document_id uuid, number text, issued_on date, expires_on date, renewal_cost_minor bigint, reminder_days integer, evidence_path text, version integer, status text, days_left integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_today date := (now() at time zone (select timezone from businesses where id = p_business))::date;
  v_uae boolean := coalesce((select country_code from businesses where id = p_business), 'AE') = 'AE';
begin
  if not public.has_role(p_business, array['owner']::member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  -- The checklist: UAE salons get the UAE documents; elsewhere a business licence and the lease, and the owner adds
  -- whatever else their country asks for.
  with branch_tmpl as (
    select t.doc_type, t.holder_type from (values
      ('trade_licence', 'company', true), ('ejari', 'premises', true), ('pest_control', 'premises', true),
      ('civil_defence', 'premises', true), ('business_licence', 'company', false), ('lease', 'premises', false)
    ) t(doc_type, holder_type, uae) where t.uae = v_uae
  ), employee_tmpl as (
    select t.doc_type from (values ('health_card'), ('visa'), ('vaccination')) t(doc_type) where v_uae
  ), slots as (
    select t.doc_type, t.holder_type, b.id as branch_id, null::uuid as employee_id, b.name as holder_name, true as required
    from branches b
    cross join branch_tmpl t
    where b.business_id = p_business
    union all
    select t.doc_type, 'employee', e.branch_id, e.id, e.full_name, true
    from employees e
    cross join employee_tmpl t
    where e.business_id = p_business and e.active
    union all
    -- The owner's own documents beyond the template.
    select d.doc_type, d.holder_type, d.branch_id, d.employee_id,
           coalesce((select full_name from employees where id = d.employee_id), (select name from branches where id = d.branch_id)),
           false
    from compliance_documents d
    where d.business_id = p_business and d.active
      and d.doc_type not in (select bt.doc_type from branch_tmpl bt union all select et.doc_type from employee_tmpl et)
  )
  select s.doc_type || ':' || coalesce(s.employee_id, s.branch_id)::text, s.doc_type, s.holder_type, s.branch_id, s.employee_id,
         s.holder_name, s.required, d.id, d.number, d.issued_on, d.expires_on, d.renewal_cost_minor, d.reminder_days,
         d.evidence_path, d.version,
         case when d.id is null then 'missing'
              when d.expires_on is null then 'missing_date'
              when d.expires_on < v_today then 'expired'
              when d.evidence_path is null then 'evidence_missing'
              when d.expires_on <= v_today + d.reminder_days then 'due_soon'
              else 'valid' end,
         (d.expires_on - v_today)::int
  from slots s
  left join compliance_documents d on d.business_id = p_business and d.active and d.doc_type = s.doc_type
    and d.employee_id is not distinct from s.employee_id
    and (s.holder_type = 'employee' or d.branch_id is not distinct from s.branch_id)
  order by s.holder_type = 'employee', s.holder_name, s.doc_type;
end;
$$;

create or replace function public.plan_status(p_business uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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
  select price_minor, currency into v_price, v_currency from public.plan_price(p_business);
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
  -- A running plan is extended from its end; otherwise it starts today (1 month from 29 Sep runs to 28 Oct).
  v_until := (greatest(coalesce(v_current, v_today - 1), v_today - 1) + make_interval(months => p_months))::date;
  insert into subscriptions (business_id, paid_until) values (p_business, v_until)
  on conflict (business_id) do update set paid_until = excluded.paid_until, updated_at = now();
  insert into plan_events (business_id, kind, months, amount_minor, currency, paid_until, note, created_by)
  values (p_business, 'activate', p_months, p_amount_minor, (select currency from public.plan_price(p_business)), v_until,
          nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
  return v_until;
end;
$$;

create function public.admin_salons()
 RETURNS TABLE(business_id uuid, name text, code text, created_at timestamp with time zone, owner_name text, owner_email text, branches integer, paid_until date, active boolean, requested_at timestamp with time zone, requested_months integer, request_note text, country_code text, timezone text, price_per_branch_minor bigint, plan_currency text)
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
           r.created_at, r.months, r.note, b.country_code, b.timezone, pp.price_minor, pp.currency
    from businesses b
    left join lateral (select * from members mm where mm.business_id = b.id and mm.role = 'owner'
                       order by mm.created_at limit 1) m on true
    left join auth.users u on u.id = m.user_id
    left join subscriptions s on s.business_id = b.id
    cross join lateral public.plan_price(b.id) pp
    left join lateral (select * from plan_events e where e.business_id = b.id and e.kind = 'request'
                         and not exists (select 1 from plan_events a where a.business_id = b.id
                                         and a.kind in ('activate', 'end') and a.created_at > e.created_at)
                       order by e.created_at desc limit 1) r on true
    where not b.is_demo
    order by (r.created_at is not null) desc, b.created_at desc;
end;
$$;

create or replace function public.send_daily_digests(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare
  b record;
  v_local timestamp;
  v_yesterday date;
  v_sales bigint;
  v_count int;
  v_pending int;
  v_low int;
  n int := 0;
begin
  for b in select br.*, bu.timezone, bu.currency from branches br join businesses bu on bu.id = br.business_id loop
    v_local := p_now at time zone b.timezone;
    continue when extract(hour from v_local) <> 8;
    v_yesterday := v_local::date - 1;
    select coalesce(sum(total_minor), 0), count(*) into v_sales, v_count from sales
    where branch_id = b.id and business_date = v_yesterday;
    select count(*) into v_pending from cash_closings where branch_id = b.id and status = 'pending_approval';
    select count(*) into v_low from inventory_items i left join stock_levels s on s.item_id = i.id and s.branch_id = b.id
    where i.business_id = b.business_id and i.active and i.kind <> 'tool' and i.reorder_level > 0
      and coalesce(s.qty, 0) <= i.reorder_level;
    n := n + public.notify(b.business_id, b.id, array['owner']::member_role[], 'daily_digest',
      'Good morning — ' || b.name,
      'Yesterday: ' || public.fmt_money(v_sales, b.currency) || ' from ' || v_count || ' sales'
      || case when v_pending > 0 then ' · ' || v_pending || ' close(s) to approve' else '' end
      || case when v_low > 0 then ' · ' || v_low || ' item(s) low on stock' else '' end,
      null, null,
      jsonb_build_object('branch', b.name, 'sales_minor', v_sales, 'sales', v_count, 'pending_closes', v_pending, 'low_stock', v_low,
                         'date', v_yesterday),
      'digest:' || b.id || ':' || v_local::date);
  end loop;
  return n;
end;
$$;


revoke execute on function public.currency_decimals(text), public.starter_price(bigint, text),
  public.plan_price(uuid), public.admin_salons() from public, anon;
revoke execute on function public.starter_price(bigint, text), public.plan_price(uuid) from authenticated;
revoke execute on function public.fmt_money(bigint, text) from public, anon;
grant execute on function public.fmt_money(bigint, text) to authenticated;
grant execute on function public.currency_decimals(text), public.admin_salons() to authenticated;
