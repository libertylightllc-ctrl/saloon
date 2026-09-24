-- M1 · Business setup, services, staff registration, branch settings.

-- ── Seed catalogue per mode (called by create_business) ─────────────────────────────────

create function public.seed_mode_catalogue(p_business uuid, p_branch uuid, p_mode public.salon_mode)
returns void
language plpgsql security definer set search_path = public as $$
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
  -- [service, category, price fils, minutes, requires_room, patch_test, [[item, qty], ...]]
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
    values (p_business, v_cat, s ->> 0, (s ->> 2)::bigint, (s ->> 3)::int, (s ->> 4)::boolean, (s ->> 5)::boolean)
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

create function public.seed_system_accounts(p_business uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a jsonb;
  i int := 0;
  v_account uuid;
begin
  for a in select * from jsonb_array_elements('[
    ["1000","Cash","asset","cash"],["1010","Card clearing","asset","card_clearing"],
    ["1020","Wallet clearing","asset","wallet_clearing"],["1030","Bank","asset","bank"],
    ["1200","Inventory","asset","inventory"],["1300","Staff advances","asset","staff_advances"],
    ["2000","Supplier payable","liability","supplier_payable"],["2100","Deposits held","liability","deposits_held"],
    ["2200","Tips payable","liability","tips_payable"],["2300","Salaries payable","liability","salaries_payable"],
    ["2400","VAT payable","liability","vat_payable"],
    ["3000","Owner equity","equity","owner_equity"],["3100","Owner drawings","equity","owner_drawings"],
    ["4000","Service revenue","income","service_revenue"],["4100","Product revenue","income","product_revenue"],
    ["4200","Other income","income","other_income"],
    ["5000","Consumables used","expense","consumables_used"],["5100","Cost of goods sold","expense","cost_of_goods_sold"],
    ["5200","Salaries","expense","salaries_expense"],["5300","Commission","expense","commission_expense"],
    ["5400","Cash over/short","expense","cash_over_short"],["5500","Supplies","expense","supplies_expense"]
  ]'::jsonb) loop
    insert into accounts (business_id, code, name, type, system_key)
    values (p_business, a ->> 0, a ->> 1, (a ->> 2)::account_type, a ->> 3);
  end loop;
  for a in select * from jsonb_array_elements('["Tea & Food","Dry Cleaning","Rent & Utilities","Repairs","Staff","Other"]'::jsonb) loop
    insert into accounts (business_id, code, name, type)
    values (p_business, (6000 + i * 10)::text, a #>> '{}', 'expense')
    returning id into v_account;
    insert into expense_categories (business_id, name, account_id) values (p_business, a #>> '{}', v_account);
    i := i + 1;
  end loop;
end;
$$;

create function public.unique_business_code(p_name text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  base text := left(regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]', '', 'g'), 8);
  candidate text;
begin
  if length(base) < 3 then
    base := 'salon';
  end if;
  loop
    candidate := base || lpad((floor(random() * 100))::int::text, 2, '0');
    exit when not exists (select 1 from businesses where code = candidate);
  end loop;
  return candidate;
end;
$$;

-- ── create_business: the setup wizard's single write ───────────────────────────────────
-- p: {business_name, owner_name, mode, branch_name, address, phone, opening_hours,
--     vat_mode, trn, opening_cash_minor}
create function public.create_business(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_business uuid;
  v_branch uuid;
  v_member uuid;
  v_mode salon_mode := (p ->> 'mode')::salon_mode;
  v_vat vat_mode := coalesce(nullif(p ->> 'vat_mode', ''), 'off')::vat_mode;
  v_cash bigint := coalesce((p ->> 'opening_cash_minor')::bigint, 0);
  v_code text;
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  if exists (select 1 from members where user_id = v_user) then
    raise exception 'already_has_business' using errcode = '23505';
  end if;
  if v_mode is null then
    raise exception 'mode_required' using errcode = '22023';
  end if;
  if v_cash < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if v_vat = 'on' and coalesce(btrim(p ->> 'trn'), '') !~ '^[0-9]{15}$' then
    raise exception 'trn_required' using errcode = '22023';
  end if;

  v_code := public.unique_business_code(p ->> 'business_name');
  insert into businesses (name, code, created_by, is_demo)
  values (btrim(p ->> 'business_name'), v_code, v_user, coalesce((p ->> 'is_demo')::boolean, false))
  returning id into v_business;

  insert into branches (business_id, name, mode, address, phone, opening_hours, vat_mode, trn, settings)
  values (
    v_business,
    coalesce(nullif(btrim(p ->> 'branch_name'), ''), btrim(p ->> 'business_name')),
    v_mode,
    nullif(btrim(p ->> 'address'), ''),
    nullif(btrim(p ->> 'phone'), ''),
    coalesce(p -> 'opening_hours', '{"open":"09:00","close":"22:00","days":[0,1,2,3,4,5,6]}'::jsonb),
    v_vat,
    case when v_vat = 'on' then btrim(p ->> 'trn') end,
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

-- ── Staff registration (service role only; called by the create-staff-login Edge Function) ─
-- p: {business_id, branch_id, user_id, username, display_name, role, commission_bps, actor_member_id}
create function public.register_staff_member(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_member uuid;
  v_employee uuid;
  v_role member_role := (p ->> 'role')::member_role;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_role = 'owner' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  insert into members (business_id, user_id, role, display_name, username, default_branch_id)
  values ((p ->> 'business_id')::uuid, (p ->> 'user_id')::uuid, v_role, btrim(p ->> 'display_name'),
          p ->> 'username', (p ->> 'branch_id')::uuid)
  returning id into v_member;
  insert into member_branches (member_id, branch_id) values (v_member, (p ->> 'branch_id')::uuid);
  if v_role in ('staff', 'cashier') then
    insert into employees (business_id, branch_id, member_id, full_name, role_title, commission_bps, colour)
    values ((p ->> 'business_id')::uuid, (p ->> 'branch_id')::uuid, v_member, btrim(p ->> 'display_name'),
            v_role::text, coalesce((p ->> 'commission_bps')::int, 0), p ->> 'colour')
    returning id into v_employee;
  end if;
  perform public.write_audit((p ->> 'business_id')::uuid, (p ->> 'branch_id')::uuid,
    (p ->> 'actor_member_id')::uuid, 'create', 'member', v_member,
    'Created login ' || (p ->> 'username') || ' (' || v_role::text || ')');
  return jsonb_build_object('member_id', v_member, 'employee_id', v_employee);
end;
$$;

-- ── Branch settings ─────────────────────────────────────────────────────────────────────

create function public.set_branch_mode(p_branch uuid, p_mode public.salon_mode) returns void
language plpgsql security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner']::member_role[]);
  v_old salon_mode;
begin
  select mode into v_old from branches where id = p_branch;
  update branches set mode = p_mode where id = p_branch;
  perform public.write_audit(m.business_id, p_branch, m.id, 'update', 'branch', p_branch,
    'Switched salon type to ' || p_mode::text, jsonb_build_object('mode', v_old), jsonb_build_object('mode', p_mode));
end;
$$;

-- p: {name, address, phone, vat_mode, trn, settings: {...allowed keys}}
create function public.update_branch(p_branch uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner']::member_role[]);
  v_settings jsonb := coalesce(p -> 'settings', '{}'::jsonb);
  v_allowed text[] := array['waiting_target_min', 'cancel_cutoff_hours', 'default_deposit_minor',
                            'staff_can_sell', 'block_insufficient_stock'];
  k text;
begin
  for k in select jsonb_object_keys(v_settings) loop
    if not (k = any (v_allowed)) then
      raise exception 'unknown_setting: %', k using errcode = '22023';
    end if;
  end loop;
  if p ? 'vat_mode' and p ->> 'vat_mode' = 'on'
     and coalesce(btrim(p ->> 'trn'), (select trn from branches where id = p_branch), '') !~ '^[0-9]{15}$' then
    raise exception 'trn_required' using errcode = '22023';
  end if;
  update branches set
    name = coalesce(nullif(btrim(p ->> 'name'), ''), name),
    address = case when p ? 'address' then nullif(btrim(p ->> 'address'), '') else address end,
    phone = case when p ? 'phone' then nullif(btrim(p ->> 'phone'), '') else phone end,
    vat_mode = coalesce((p ->> 'vat_mode')::vat_mode, vat_mode),
    trn = case when p ? 'trn' then nullif(btrim(p ->> 'trn'), '') else trn end,
    settings = settings || v_settings || jsonb_build_object('tax_confirmed', true)
  where id = p_branch;
  perform public.write_audit(m.business_id, p_branch, m.id, 'update', 'branch', p_branch, 'Updated branch settings');
end;
$$;

create function public.set_opening_cash(p_branch uuid, p_amount bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner']::member_role[]);
begin
  if p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if public.branch_setting(p_branch, 'opening_cash_set', 'false') = 'true'::jsonb then
    raise exception 'opening_cash_already_set' using errcode = '23505';
  end if;
  perform public.post_journal(m.business_id, p_branch, public.branch_today(p_branch), 'opening_cash', p_branch,
    'Opening cash', m.id,
    jsonb_build_array(jsonb_build_object('account', 'cash', 'debit', p_amount),
                      jsonb_build_object('account', 'owner_equity', 'credit', p_amount)));
  update branches set settings = settings || '{"opening_cash_set": true}' where id = p_branch;
  perform public.write_audit(m.business_id, p_branch, m.id, 'create', 'opening_cash', p_branch, 'Set opening cash');
end;
$$;

-- ── Services (with recipe) ──────────────────────────────────────────────────────────────
-- p: {id?, business_id, category_id, name, price_minor, duration_min, buffer_min,
--     requires_room, requires_patch_test, status, recipe: [{item_id? | item_name + unit, qty}]}
create function public.save_service(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := (p ->> 'business_id')::uuid;
  v_member uuid;
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_item uuid;
  r jsonb;
  v_branch uuid;
begin
  if not public.has_role(v_business, array['owner']::member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_member := public.current_member_id(v_business);
  if not exists (select 1 from service_categories where id = (p ->> 'category_id')::uuid and business_id = v_business) then
    raise exception 'category_required' using errcode = '22023';
  end if;
  if coalesce((p ->> 'price_minor')::bigint, -1) < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  if v_id is null then
    insert into services (business_id, category_id, name, price_minor, duration_min, buffer_min,
                          requires_room, requires_patch_test)
    values (v_business, (p ->> 'category_id')::uuid, btrim(p ->> 'name'), (p ->> 'price_minor')::bigint,
            (p ->> 'duration_min')::int, coalesce((p ->> 'buffer_min')::int, 0),
            coalesce((p ->> 'requires_room')::boolean, false), coalesce((p ->> 'requires_patch_test')::boolean, false))
    returning id into v_id;
  else
    if not exists (select 1 from services where id = v_id and business_id = v_business) then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    update services set
      category_id = (p ->> 'category_id')::uuid,
      name = btrim(p ->> 'name'),
      price_minor = (p ->> 'price_minor')::bigint,
      duration_min = (p ->> 'duration_min')::int,
      buffer_min = coalesce((p ->> 'buffer_min')::int, 0),
      requires_room = coalesce((p ->> 'requires_room')::boolean, false),
      requires_patch_test = coalesce((p ->> 'requires_patch_test')::boolean, false),
      status = coalesce(nullif(p ->> 'status', ''), status)
    where id = v_id;
  end if;

  if p ? 'recipe' then
    delete from service_recipe_items where service_id = v_id;
    for r in select * from jsonb_array_elements(p -> 'recipe') loop
      v_item := nullif(r ->> 'item_id', '')::uuid;
      if v_item is null then
        select id into v_item from inventory_items
        where business_id = v_business and lower(name) = lower(btrim(r ->> 'item_name'));
        if v_item is null then
          insert into inventory_items (business_id, name, kind, unit)
          values (v_business, btrim(r ->> 'item_name'), 'consumable', coalesce(nullif(r ->> 'unit', ''), 'pcs'))
          returning id into v_item;
          for v_branch in select id from branches where business_id = v_business loop
            insert into stock_levels (item_id, branch_id, qty) values (v_item, v_branch, 0) on conflict do nothing;
          end loop;
        end if;
      elsif not exists (select 1 from inventory_items where id = v_item and business_id = v_business) then
        raise exception 'not_found' using errcode = 'P0002';
      end if;
      insert into service_recipe_items (service_id, item_id, qty) values (v_id, v_item, (r ->> 'qty')::numeric)
      on conflict (service_id, item_id) do update set qty = service_recipe_items.qty + excluded.qty;
    end loop;
  end if;

  perform public.write_audit(v_business, null, v_member,
    case when p ? 'id' then 'update' else 'create' end, 'service', v_id, 'Saved service ' || btrim(p ->> 'name'));
  return v_id;
end;
$$;

-- ── Access history ──────────────────────────────────────────────────────────────────────
create function public.log_access(p_event text, p_device text) returns void
language plpgsql security definer set search_path = public as $$
declare
  m members;
begin
  select * into m from members where user_id = auth.uid() order by created_at limit 1;
  if m.id is null then
    return;
  end if;
  insert into access_history (business_id, member_id, event, device)
  values (m.business_id, m.id, p_event, left(p_device, 120));
end;
$$;
