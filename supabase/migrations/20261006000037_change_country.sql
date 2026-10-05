-- Change the salon's country after setup (owner, 2026-10-06: "add it"), while no money has been recorded yet: no sale,
-- expense, purchase, opening cash or stock, deposit or payroll — anything that posts to the books. The country brings
-- its currency, time zone and sales tax (every branch). Amounts already typed in — service and product prices,
-- salaries, renewal costs, upcoming bookings, the default deposit — are converted roughly into the new currency (AED 25
-- becomes about KZT 3,500, not KZT 25), and the owner checks them.

-- Units of a currency per AED (rough, 2026); null for a currency not on the list.
create function public.aed_rate(p_currency text) returns numeric
language sql immutable set search_path = public as $$
  select case p_currency
    when 'AED' then 1
    when 'SAR' then 1.02 when 'QAR' then 0.99 when 'KWD' then 0.083 when 'BHD' then 0.102 when 'OMR' then 0.105
    when 'EGP' then 13.5 when 'JOD' then 0.193 when 'MAD' then 2.5 when 'TND' then 0.83 when 'TRY' then 11
    when 'ZAR' then 4.8 when 'NGN' then 420 when 'KES' then 35 when 'GHS' then 3.3 when 'INR' then 23.5
    when 'PKR' then 77 when 'BDT' then 33 when 'LKR' then 81 when 'NPR' then 37 when 'SGD' then 0.35
    when 'MYR' then 1.17 when 'PHP' then 15.5 when 'IDR' then 4400 when 'THB' then 8.9 when 'VND' then 7000
    when 'JPY' then 40 when 'AUD' then 0.42 when 'NZD' then 0.46 when 'GBP' then 0.2 when 'EUR' then 0.235
    when 'CHF' then 0.22 when 'SEK' then 2.6 when 'NOK' then 2.75 when 'DKK' then 1.75 when 'PLN' then 1.0
    when 'USD' then 0.272 when 'CAD' then 0.375 when 'MXN' then 5.1 when 'BRL' then 1.5 when 'COP' then 1100
    when 'CLP' then 260
    when 'CZK' then 6.1 when 'HUF' then 98 when 'RON' then 1.22 when 'ISK' then 37 when 'UAH' then 11.2
    when 'RSD' then 28.6 when 'ALL' then 25 when 'MKD' then 15.2 when 'BAM' then 0.49 when 'MDL' then 4.8
    when 'GEL' then 0.73 when 'AMD' then 106 when 'AZN' then 0.46 when 'KZT' then 141 when 'UZS' then 3400
    when 'KGS' then 23.7 when 'TJS' then 2.86 when 'TMT' then 0.95 when 'MNT' then 938
    when 'IQD' then 356 when 'LBP' then 24300 when 'ILS' then 0.98 when 'DZD' then 36 when 'LYD' then 1.5
    when 'ARS' then 326 when 'PEN' then 0.98 when 'UYU' then 10.9 when 'PYG' then 2120 when 'BOB' then 1.88
    when 'CRC' then 137 when 'GTQ' then 2.1 when 'HNL' then 7.1 when 'NIO' then 10 when 'DOP' then 16.9
    when 'JMD' then 43 when 'TTD' then 1.85 when 'BSD' then 0.272 when 'BBD' then 0.544 when 'BZD' then 0.544
  end
$$;

-- An amount in one currency, roughly in another, rounded to two significant figures (25 → 3,500, 80 → 11,000).
create function public.convert_rough(p_minor bigint, p_from text, p_to text) returns bigint
language plpgsql immutable set search_path = public as $$
declare
  v_major numeric;
  v_step numeric;
begin
  if p_minor is null or p_minor <= 0 or p_from = p_to then
    return p_minor;
  end if;
  v_major := p_minor / 10.0 ^ public.currency_decimals(p_from) / coalesce(public.aed_rate(p_from), 1)
             * coalesce(public.aed_rate(p_to), 1);
  v_step := 10 ^ (floor(log(v_major)) - 1);
  return greatest(1, round(round(v_major / v_step) * v_step * 10 ^ public.currency_decimals(p_to)))::bigint;
end;
$$;

-- Starter prices read the same table.
create or replace function public.starter_price(p_aed_fils bigint, p_currency text) returns bigint
language sql immutable set search_path = public as $$
  select public.convert_rough(p_aed_fils, 'AED', coalesce(p_currency, 'AED'))
$$;

revoke execute on function public.aed_rate(text), public.convert_rough(bigint, text, text) from public, anon, authenticated;

-- Whether the country can still change: nothing posted to the books yet. Owner.
create function public.country_change_allowed(p_business uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(p_business, array['owner']::member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return not exists (select 1 from journal_entries where business_id = p_business);
end;
$$;

create function public.change_country(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  b businesses;
  m members;
  v_country text := upper(nullif(btrim(p ->> 'country_code'), ''));
  v_currency text := upper(nullif(btrim(p ->> 'currency'), ''));
  v_timezone text := nullif(btrim(p ->> 'timezone'), '');
  v_tax_rate numeric := coalesce((p ->> 'tax_rate_bps')::numeric, 0);
  v_from text;
begin
  select * into b from businesses where id = (p ->> 'business_id')::uuid for update;
  if b.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into m from members where business_id = b.id and user_id = auth.uid() and active and role = 'owner';
  if m.id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if coalesce(v_country, '') !~ '^[A-Z]{2}$' or coalesce(v_currency, '') !~ '^[A-Z]{3}$'
     or not exists (select 1 from pg_timezone_names where name = v_timezone) then
    raise exception 'invalid_country' using errcode = '22023';
  end if;
  if v_tax_rate not between 0 and 3000 or v_tax_rate <> round(v_tax_rate, 1) then
    raise exception 'invalid_tax_rate' using errcode = '22023';
  end if;
  if exists (select 1 from journal_entries where business_id = b.id) then
    raise exception 'country_locked' using errcode = '22023';
  end if;
  -- Setting up is free: these corrections go through even before the plan is switched on (this transaction only).
  perform set_config('salon.plan_check', 'off', true);

  v_from := b.currency;
  if v_from <> v_currency then
    update services set price_minor = public.convert_rough(price_minor, v_from, v_currency) where business_id = b.id;
    -- Selling prices; stock costs only exist once stock has been costed, which posts to the books (locked above).
    update inventory_items set sell_price_minor = public.convert_rough(sell_price_minor, v_from, v_currency)
    where business_id = b.id and sell_price_minor is not null;
    update employees set base_salary_minor = public.convert_rough(base_salary_minor, v_from, v_currency)
    where business_id = b.id;
    update compliance_documents set renewal_cost_minor = public.convert_rough(renewal_cost_minor, v_from, v_currency)
    where business_id = b.id and renewal_cost_minor is not null;
    update appointment_services s set price_minor = public.convert_rough(s.price_minor, v_from, v_currency)
    from appointments a where a.id = s.appointment_id and a.business_id = b.id;
    update branches
    set settings = settings || jsonb_build_object('default_deposit_minor',
      public.convert_rough(coalesce((settings ->> 'default_deposit_minor')::bigint, 0), v_from, v_currency))
    where business_id = b.id;
  end if;

  update businesses set country_code = v_country, currency = v_currency, timezone = v_timezone where id = b.id;
  update branches
  set tax_name = coalesce(nullif(btrim(p ->> 'tax_name'), ''), 'VAT'),
      tax_rate_bps = v_tax_rate,
      tax_inclusive = coalesce((p ->> 'tax_inclusive')::boolean, true),
      tax_id_label = coalesce(nullif(btrim(p ->> 'tax_id_label'), ''), case when v_country = 'AE' then 'TRN' else 'Tax ID' end),
      -- No tax in the new country, or a UAE salon without a valid 15-digit TRN: tax off until the owner sets it.
      vat_mode = case when v_tax_rate = 0 or (v_country = 'AE' and coalesce(trn, '') !~ '^[0-9]{15}$') then 'off' else vat_mode end
  where business_id = b.id;

  perform public.write_audit(b.id, null, m.id, 'edit', 'business', b.id,
    'Changed the country from ' || b.country_code || ' (' || v_from || ', ' || b.timezone || ') to ' || v_country
    || ' (' || v_currency || ', ' || v_timezone || ')');
end;
$$;

revoke execute on function public.change_country(jsonb), public.country_change_allowed(uuid) from public, anon;
