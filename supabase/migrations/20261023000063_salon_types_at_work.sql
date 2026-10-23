-- The two new salon types at work (website brief 5.4; docs/SALON-TYPES-PLAN.md): each gets its own starter services,
-- and the room rule — massage and facials need a free room — applies to every type that has rooms (ladies salons and
-- beauty & wellness studios), not to "ladies" alone. Before this, any type other than gents got the ladies list.

-- Which salon types work with rooms.
create function public.mode_uses_rooms(p_mode public.salon_mode) returns boolean
language sql immutable set search_path = public as $$
  select p_mode in ('ladies', 'wellness')
$$;

-- Starter categories, consumables and services per type (prices in AED fils, converted for other countries).
CREATE OR REPLACE FUNCTION public.seed_mode_catalogue(p_business uuid, p_branch uuid, p_mode salon_mode)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  -- [category, icon]
  cats jsonb := case p_mode
    when 'gents' then '[["Hair","scissors"],["Beard","brush"],["Colour","palette"],["Face","face"],["Massage","massage"]]'
    when 'unisex' then '[["Hair","scissors"],["Colour","palette"],["Beard","brush"],["Nails","hand"],["Treatments","sparkles"]]'
    when 'wellness' then '[["Nails","hand"],["Lashes & brows","sparkles"],["Skincare & facials","face"],["Massage","massage"],["Waxing","feather"]]'
    else '[["Hair","scissors"],["Colour","palette"],["Nails","hand"],["Facial","sparkles"],["Makeup","brush"],["Waxing & threading","feather"],["Spa & massage","flower"],["Bridal","gem"]]'
  end;
  -- [item, unit]
  items jsonb := case p_mode
    when 'gents' then '[["Blades","pcs"],["Shaving Foam","ml"],["Hair Oil","ml"],["Developer 20 Vol","ml"],["Beard Color","ml"],["Hair Color","ml"],["Gloves","pairs"],["Neck strips","pcs"],["Tissues","pcs"]]'
    when 'unisex' then '[["Neck strips","pcs"],["Styling cream","ml"],["Heat spray","ml"],["Hair Color","ml"],["Developer 20 Vol","ml"],["Gloves","pairs"],["Nail polish","ml"],["Face masks","pcs"]]'
    when 'wellness' then '[["Nail polish","ml"],["Gel polish","ml"],["Lash lift kit","pcs"],["Brow tint","ml"],["Face masks","pcs"],["Cleanser","ml"],["Massage oil","ml"],["Wax","g"],["Gloves","pairs"]]'
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
    when 'unisex' then '[
      ["Men''s Haircut","Hair",3500,30,false,false,[["Neck strips",1]]],
      ["Women''s Haircut","Hair",8000,45,false,false,[["Styling cream",5]]],
      ["Blow-dry","Hair",6000,40,false,false,[["Heat spray",5]]],
      ["Hair Color","Colour",15000,75,false,true,[["Hair Color",50],["Developer 20 Vol",50],["Gloves",1]]],
      ["Beard Trim","Beard",2000,15,false,false,[["Neck strips",1]]],
      ["Manicure","Nails",6000,40,false,false,[["Nail polish",2]]],
      ["Facial","Treatments",12000,45,false,false,[["Face masks",1]]]]'
    when 'wellness' then '[
      ["Manicure","Nails",7000,40,false,false,[["Nail polish",2]]],
      ["Pedicure","Nails",9000,50,false,false,[["Nail polish",2]]],
      ["Gel Nails","Nails",12000,60,false,false,[["Gel polish",3]]],
      ["Lash Lift","Lashes & brows",15000,60,false,true,[["Lash lift kit",1]]],
      ["Brow Shaping & Tint","Lashes & brows",8000,30,false,true,[["Brow tint",2]]],
      ["Classic Facial","Skincare & facials",20000,60,true,false,[["Cleanser",10],["Face masks",1]]],
      ["Swedish Massage","Massage",30000,60,true,false,[["Massage oil",20]]],
      ["Deep Tissue Massage","Massage",35000,60,true,false,[["Massage oil",20]]],
      ["Waxing","Waxing",6000,30,false,false,[["Wax",30],["Gloves",1]]]]'
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
  elsif p_mode = 'wellness' then
    insert into rooms (business_id, branch_id, name, kind) values
      (p_business, p_branch, 'Treatment room 1', 'room'), (p_business, p_branch, 'Treatment room 2', 'room');
  end if;
end;
$function$;

-- Bookings need a free room for room services wherever the type has rooms.
CREATE OR REPLACE FUNCTION public.create_appointment(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_member(v_branch, array['owner', 'cashier', 'staff']::member_role[]);
  b branches;
  v_kind text := coalesce(p ->> 'kind', 'walk_in');
  v_id uuid;
  v_customer customers;
  v_name text;
  v_at timestamptz;
  v_duration int := 0;
  v_employee uuid := nullif(p ->> 'employee_id', '')::uuid;
  v_room uuid := nullif(p ->> 'room_id', '')::uuid;
  v_deposit bigint := coalesce((p ->> 'deposit_minor')::bigint, 0);
  v_method payment_method := nullif(p ->> 'deposit_method', '')::payment_method;
  v_needs_room boolean := false;
  s record;
  v_service_ids uuid[] := coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'service_ids', '[]'))::uuid), '{}');
begin
  select * into b from branches where id = v_branch;
  if v_kind not in ('walk_in', 'booking') then
    raise exception 'invalid_kind' using errcode = '22023';
  end if;
  if m.role = 'staff' and v_kind <> 'walk_in' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  if nullif(p ->> 'customer_id', '') is not null then
    select * into v_customer from customers
    where id = (p ->> 'customer_id')::uuid and business_id = b.business_id;
    if v_customer.id is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    v_name := v_customer.name;
  else
    v_name := nullif(btrim(p ->> 'guest_name'), '');
  end if;

  for s in
    select * from services where id = any (v_service_ids) and business_id = b.business_id and status = 'active'
  loop
    v_duration := v_duration + coalesce(s.duration_min, 0) + s.buffer_min;
    v_needs_room := v_needs_room or s.requires_room;
  end loop;
  if (select count(*) from services where id = any (v_service_ids) and business_id = b.business_id and status = 'active')
     <> coalesce(array_length(v_service_ids, 1), 0) then
    raise exception 'service_unavailable' using errcode = '22023';
  end if;
  if v_kind = 'booking' and coalesce(array_length(v_service_ids, 1), 0) = 0 then
    raise exception 'services_required' using errcode = '22023';
  end if;
  if v_duration = 0 then
    v_duration := 30;
  end if;

  if v_employee is not null
     and not exists (select 1 from employees where id = v_employee and branch_id = v_branch and active) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_room is not null and not exists (select 1 from rooms where id = v_room and branch_id = v_branch and active) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if public.mode_uses_rooms(b.mode) and v_needs_room and v_room is null then
    raise exception 'room_required' using errcode = '22023';
  end if;

  if v_kind = 'booking' then
    v_at := (p ->> 'scheduled_at')::timestamptz;
    if v_at is null then
      raise exception 'time_required' using errcode = '22023';
    end if;
    if exists (
      select 1 from appointments a
      where a.branch_id = v_branch and a.status in ('booked', 'waiting', 'in_progress')
        and ((v_employee is not null and a.employee_id = v_employee) or (v_room is not null and a.room_id = v_room))
        and tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => a.duration_min))
            && tstzrange(v_at, v_at + make_interval(mins => v_duration))
    ) then
      raise exception 'slot_taken' using errcode = '23P01';
    end if;
  else
    v_at := now();
    v_deposit := 0;
  end if;

  if v_deposit < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if v_deposit > 0 and (v_method is null or v_method = 'bank') then
    raise exception 'deposit_method_required' using errcode = '22023';
  end if;

  insert into appointments (business_id, branch_id, customer_id, customer_name, source, status, scheduled_at,
                            business_date, duration_min, checked_in_at, employee_id, room_id, notes,
                            deposit_minor, deposit_status, deposit_method, created_by)
  values (b.business_id, v_branch, v_customer.id, v_name,
          case when v_kind = 'walk_in' then 'walk_in' else coalesce(nullif(p ->> 'source', ''), 'staff') end::appointment_source,
          case when v_kind = 'walk_in' then 'waiting' else 'booked' end::appointment_status,
          v_at, (v_at at time zone public.branch_tz(v_branch))::date, v_duration,
          case when v_kind = 'walk_in' then now() end, v_employee, v_room, nullif(btrim(p ->> 'notes'), ''),
          v_deposit, case when v_deposit > 0 then 'held' else 'none' end::deposit_status,
          case when v_deposit > 0 then v_method end, m.id)
  returning id into v_id;

  insert into appointment_services (appointment_id, service_id, name_snapshot, employee_id, duration_min, price_minor)
  select v_id, s2.id, s2.name, v_employee, coalesce(s2.duration_min, 0), s2.price_minor
  from services s2 where s2.id = any (v_service_ids);

  if v_deposit > 0 then
    perform public.post_journal(b.business_id, v_branch, public.branch_today(v_branch), 'deposit', v_id,
      'Deposit taken', m.id,
      jsonb_build_array(jsonb_build_object('account', public.method_account(v_method), 'debit', v_deposit),
                        jsonb_build_object('account', 'deposits_held', 'credit', v_deposit)));
  end if;

  perform public.write_audit(b.business_id, v_branch, m.id, 'create', 'appointment', v_id,
    case when v_kind = 'walk_in' then 'Added walk-in ' else 'Booked ' end || coalesce(v_name, 'guest'));
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.public_booking_slots(p_slug text, p_date date, p_services uuid[], p_employee uuid DEFAULT NULL::uuid)
 RETURNS TABLE(slot text, starts_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  b branches := public.booking_branch(p_slug);
  v_len int;
  v_room boolean;
  v_rostered boolean;
begin
  if b.id is null or p_date is null or p_date < public.branch_today(b.id) or p_date > public.branch_today(b.id) + 30 then
    return;
  end if;
  select l.minutes, l.needs_room into v_len, v_room from public.booking_length(b.business_id, p_services) l;
  if v_len is null then
    return;
  end if;
  if p_employee is not null and not exists (select 1 from employees e where e.id = p_employee and e.branch_id = b.id
                                              and e.active and e.role_title <> 'cashier') then
    return;
  end if;
  v_rostered := exists (select 1 from rosters r join employees e on e.id = r.employee_id where e.branch_id = b.id and e.active);
  return query
    select s.slot, s.starts_at from public.book_slots(b.id, p_date, v_len, p_employee) s
    where s.available and s.starts_at >= now() + interval '30 minutes'
      and (v_rostered or s.slot between '09:00' and '23:30')
      and (not (v_room and public.mode_uses_rooms(b.mode)) or public.free_room(b.id, s.starts_at, v_len) is not null)
    order by s.starts_at;
end;
$function$;

CREATE OR REPLACE FUNCTION public.public_book(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  b branches := public.booking_branch(p ->> 'slug');
  v_services uuid[] := coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'service_ids', '[]'))::uuid), '{}');
  v_employee uuid := nullif(p ->> 'employee_id', '')::uuid;
  v_at timestamptz := nullif(p ->> 'starts_at', '')::timestamptz;
  v_name text := btrim(coalesce(p ->> 'name', ''));
  v_phone text := btrim(coalesce(p ->> 'phone', ''));
  v_digits text := regexp_replace(coalesce(p ->> 'phone', ''), '\D', '', 'g');
  v_notes text := nullif(btrim(coalesce(p ->> 'notes', '')), '');
  v_len int;
  v_room boolean;
  v_room_id uuid;
  c customers;
  v_id uuid;
  v_token text := translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_');
begin
  if b.id is null then
    raise exception 'booking_unavailable' using errcode = 'P0002';
  end if;
  -- One booking at a time per branch, so two people cannot take the last free time together.
  perform 1 from branches where id = b.id for update;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'name_required' using errcode = '22023';
  end if;
  if v_phone !~ '^\+?[0-9 ()-]{7,24}$' or char_length(v_digits) not between 7 and 15 then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if char_length(coalesce(v_notes, '')) > 300 then
    raise exception 'too_long' using errcode = '22023';
  end if;
  select l.minutes, l.needs_room into v_len, v_room from public.booking_length(b.business_id, v_services) l;
  if cardinality(v_services) = 0 then
    raise exception 'services_required' using errcode = '22023';
  end if;
  if v_len is null then
    raise exception 'service_unavailable' using errcode = '22023';
  end if;
  if v_at is null or not exists (
    select 1 from public.public_booking_slots(p ->> 'slug', (v_at at time zone public.branch_tz(b.id))::date, v_services, v_employee) s
    where s.starts_at = v_at) then
    raise exception 'slot_taken' using errcode = '23P01';
  end if;
  -- Against floods: a few upcoming online bookings per phone number, and a cap per hour per branch.
  if (select count(*) from appointments a join customers cu on cu.id = a.customer_id
      where a.business_id = b.business_id and a.source = 'app' and a.status = 'booked' and a.scheduled_at > now()
        and right(regexp_replace(coalesce(cu.phone, ''), '\D', '', 'g'), 9) = right(v_digits, 9)) >= 3 then
    raise exception 'too_many_bookings' using errcode = '22023';
  end if;
  if (select count(*) from appointments a where a.branch_id = b.id and a.source = 'app'
      and a.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  if v_room and public.mode_uses_rooms(b.mode) then
    v_room_id := public.free_room(b.id, v_at, v_len);
  end if;

  select * into c from customers
  where business_id = b.business_id and right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 9) = right(v_digits, 9)
  order by last_visit_at desc nulls last, created_at desc limit 1;
  if c.id is null then
    insert into customers (business_id, name, phone) values (b.business_id, v_name, v_phone) returning * into c;
  end if;

  insert into appointments (business_id, branch_id, customer_id, customer_name, source, status, scheduled_at,
                            business_date, duration_min, employee_id, room_id, notes, booking_token)
  values (b.business_id, b.id, c.id, c.name, 'app', 'booked', v_at, (v_at at time zone public.branch_tz(b.id))::date,
          v_len, v_employee, v_room_id, v_notes, v_token)
  returning id into v_id;
  insert into appointment_services (appointment_id, service_id, name_snapshot, employee_id, duration_min, price_minor)
  select v_id, s.id, s.name, v_employee, coalesce(s.duration_min, 0), s.price_minor
  from services s where s.id = any (v_services);
  perform public.write_audit(b.business_id, b.id, null, 'create', 'appointment', v_id, 'Booked online: ' || c.name);
  return jsonb_build_object('token', v_token, 'scheduled_at', v_at);
end;
$function$;
