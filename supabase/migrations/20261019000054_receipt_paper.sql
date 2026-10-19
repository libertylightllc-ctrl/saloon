-- The paper receipts print on (owner, 2026-10-19: "A4 printers are too big for salons; they use compact receipt
-- printers"): Branch settings → Receipt paper, an 80 mm or 58 mm roll or A4, kept in the branch's settings. Without
-- one the app prints for the 80 mm roll most salons use.
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
                            'receipt_mode', 'tax_region', 'receipt_paper'];
  k text;
  v_days jsonb;
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
  -- The licence / commercial registration number on receipts: letters, digits and . / - (as on the certificate).
  if p ? 'licence_number' and nullif(btrim(p ->> 'licence_number'), '') is not null
     and btrim(p ->> 'licence_number') !~ '^[A-Za-z0-9]([A-Za-z0-9 ./-]{0,38}[A-Za-z0-9])?$' then
    raise exception 'invalid_licence' using errcode = '22023';
  end if;
  if (p ? 'legal_name' and char_length(btrim(p ->> 'legal_name')) > 120)
     or (p ? 'licence_label' and char_length(btrim(p ->> 'licence_label')) > 30) then
    raise exception 'too_long' using errcode = '22023';
  end if;
  -- The paper receipts print on: an 80 mm or 58 mm receipt roll, or A4.
  if v_settings ? 'receipt_paper' and not (v_settings ->> 'receipt_paper' = any (array['80mm', '58mm', 'a4'])) then
    raise exception 'unknown_setting: receipt_paper' using errcode = '22023';
  end if;
  -- The province whose tax the owner picked (Canada: ON, BC…), so Branch settings shows it again; '' for none.
  if v_settings ? 'tax_region' and coalesce(v_settings ->> 'tax_region', '-') !~ '^([A-Z]{2})?$' then
    raise exception 'unknown_setting: tax_region' using errcode = '22023';
  end if;
  -- A second tax (Canada's PST, RST or QST beside the GST): a name and a rate, or none (rate 0).
  if p ? 'tax2_rate_bps' and (coalesce((p ->> 'tax2_rate_bps')::numeric, -1) not between 0 and 3000
                              or (p ->> 'tax2_rate_bps')::numeric <> round((p ->> 'tax2_rate_bps')::numeric, 1)) then
    raise exception 'invalid_tax_rate' using errcode = '22023';
  end if;
  if coalesce((p ->> 'tax2_rate_bps')::numeric, 0) > 0 and nullif(btrim(p ->> 'tax2_name'), '') is null then
    raise exception 'tax2_name_required' using errcode = '22023';
  end if;
  -- Open days: weekday numbers, 0 = Sunday; at least one.
  if p ? 'open_days' then
    if jsonb_typeof(p -> 'open_days') <> 'array' or jsonb_array_length(p -> 'open_days') = 0
       or exists (select 1 from jsonb_array_elements(p -> 'open_days') d
                  where jsonb_typeof(d) <> 'number' or d::text !~ '^[0-6]$') then
      raise exception 'days_required' using errcode = '22023';
    end if;
    select jsonb_agg(distinct d::int order by d::int) into v_days from jsonb_array_elements_text(p -> 'open_days') d;
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
    tax2_rate_bps = coalesce((p ->> 'tax2_rate_bps')::numeric, tax2_rate_bps),
    tax2_name = case when p ? 'tax2_rate_bps' and coalesce((p ->> 'tax2_rate_bps')::numeric, 0) = 0 then null
                     when p ? 'tax2_name' then left(nullif(btrim(p ->> 'tax2_name'), ''), 20) else tax2_name end,
    legal_name = case when p ? 'legal_name' then nullif(btrim(p ->> 'legal_name'), '') else legal_name end,
    licence_label = case when p ? 'licence_label' then nullif(btrim(p ->> 'licence_label'), '') else licence_label end,
    licence_number = case when p ? 'licence_number' then nullif(btrim(p ->> 'licence_number'), '') else licence_number end,
    opening_hours = case when v_days is null then opening_hours else jsonb_set(opening_hours, '{days}', v_days) end,
    settings = settings || v_settings || jsonb_build_object('tax_confirmed', true)
  where id = p_branch;
  perform public.write_audit(m.business_id, p_branch, m.id, 'update', 'branch', p_branch, 'Updated branch settings');
end;
$$;
