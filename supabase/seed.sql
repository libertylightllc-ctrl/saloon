-- Demo data for local development (`npx supabase db reset`).
-- Two separate demo businesses, built by calling the real RPCs so seeding also proves they work.
-- Sign in (password Demo1234! for owners, Staff1234! for staff):
--   Gents  owner demo-gents@example.com   · salon code albarsha · cashier faisal · staff rafiq, sameer, imran
--   Ladies owner demo-ladies@example.com  · salon code jumeirah · cashier noor   · staff aisha, priya, leila

create function pg_temp.new_user(p_id uuid, p_email text, p_password text, p_name text) returns void
language sql as $$
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at,
                          updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token,
                          email_change_token_new, email_change, email_change_token_current, reauthentication_token,
                          phone_change, phone_change_token, is_sso_user, is_anonymous)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
          crypt(p_password, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}',
          jsonb_build_object('display_name', p_name), '', '', '', '', '', '', '', '', false, false);
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text,
          jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true), 'email', now(), now(), now());
$$;

-- RPCs read the caller from the JWT claims, exactly as they do for requests from the app.
create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, false);
$$;
create function pg_temp.act_as_service() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"service_role"}', false);
$$;

create function pg_temp.svc(p_business uuid, p_name text) returns uuid language sql as $$
  select id from services where business_id = p_business and name = p_name
$$;
create function pg_temp.emp(p_business uuid, p_name text) returns uuid language sql as $$
  select id from employees where business_id = p_business and full_name = p_name
$$;

-- One sale through create_sale; p_days_ago > 0 moves it back in time for the history charts.
create function pg_temp.sell(p_branch uuid, p_cashier uuid, p_services text[], p_employee text, p_method text,
                             p_days_ago int default 0, p_discount bigint default 0, p_tip bigint default 0,
                             p_customer uuid default null)
returns uuid language plpgsql as $$
declare
  v_business uuid := (select business_id from branches where id = p_branch);
  v_due bigint;
  v_sale uuid;
  v_payments jsonb;
begin
  select sum(price_minor) - p_discount + p_tip into v_due
  from services s join unnest(p_services) n(name) on s.name = n.name and s.business_id = v_business;
  v_payments := case p_method
    when 'split' then jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_minor', v_due / 2),
                                        jsonb_build_object('method', 'card', 'amount_minor', v_due - v_due / 2))
    else jsonb_build_array(jsonb_build_object('method', p_method, 'amount_minor', v_due)) end;
  perform pg_temp.act_as(p_cashier);
  v_sale := (public.create_sale(jsonb_build_object(
    'branch_id', p_branch, 'customer_id', p_customer, 'employee_id', pg_temp.emp(v_business, p_employee),
    'lines', (select jsonb_agg(jsonb_build_object('service_id', pg_temp.svc(v_business, n))) from unnest(p_services) n),
    'discount_minor', p_discount, 'tip_minor', p_tip, 'payments', v_payments)) ->> 'sale_id')::uuid;
  if p_days_ago > 0 then
    update sales set business_date = business_date - p_days_ago,
                     created_at = created_at - make_interval(days => p_days_ago)
    where id = v_sale;
    update journal_entries set business_date = business_date - p_days_ago,
                               created_at = created_at - make_interval(days => p_days_ago)
    where source_type = 'sale' and source_id = v_sale;
    update audit_log set created_at = created_at - make_interval(days => p_days_ago)
    where entity_type = 'sale' and entity_id = v_sale;
    update stock_movements set created_at = created_at - make_interval(days => p_days_ago)
    where ref_type = 'sale' and ref_id = v_sale;
  end if;
  return v_sale;
end;
$$;

-- An expense through record_expense, then moved p_days_ago back (demo history only).
create function pg_temp.expense(p_biz uuid, p_branch uuid, p_user uuid, p_key text, p_amount bigint, p_method text,
                                p_note text, p_days_ago int) returns void
language plpgsql as $$
declare
  v uuid;
begin
  perform pg_temp.act_as(p_user);
  v := (public.record_expense(jsonb_build_object('branch_id', p_branch, 'amount_minor', p_amount, 'method', p_method,
    'note', p_note, 'category_id', (select id from expense_categories where business_id = p_biz and key = p_key)))
    ->> 'expense_id')::uuid;
  if p_days_ago > 0 then
    update expenses set business_date = business_date - p_days_ago, created_at = created_at - make_interval(days => p_days_ago)
    where id = v;
    update journal_entries set business_date = business_date - p_days_ago, created_at = created_at - make_interval(days => p_days_ago)
    where source_type = 'expense' and source_id = v;
    update audit_log set created_at = created_at - make_interval(days => p_days_ago) where entity_type = 'expense' and entity_id = v;
  end if;
end;
$$;

-- A supplier bill (stock lines by item name) through post_purchase_bill, optionally part-paid, moved back in time.
create function pg_temp.bill(p_biz uuid, p_branch uuid, p_owner uuid, p_supplier uuid, p_ref text, p_lines jsonb,
                             p_paid bigint, p_method text, p_days_ago int) returns void
language plpgsql as $$
declare
  v uuid;
  l jsonb;
  v_lines jsonb := '[]';
begin
  perform pg_temp.act_as(p_owner);
  for l in select * from jsonb_array_elements(p_lines) loop
    v_lines := v_lines || jsonb_build_object('item_id', (select id from inventory_items where business_id = p_biz and name = l ->> 0),
      'description', l ->> 0, 'qty', (l ->> 1)::numeric, 'unit_cost_minor', (l ->> 2)::bigint);
  end loop;
  v := (public.post_purchase_bill(jsonb_build_object('branch_id', p_branch, 'supplier_id', p_supplier, 'invoice_ref', p_ref,
    'lines', v_lines || jsonb_build_array(jsonb_build_object('description', 'Delivery', 'qty', 1, 'unit_cost_minor', 1500)))
    || case when p_paid > 0 then jsonb_build_object('paid_now', jsonb_build_object('method', p_method, 'amount_minor', p_paid))
            else '{}'::jsonb end) ->> 'bill_id')::uuid;
  if p_days_ago > 0 then
    update purchase_bills set bill_date = bill_date - p_days_ago, due_date = due_date - p_days_ago,
                              created_at = created_at - make_interval(days => p_days_ago) where id = v;
    update supplier_payments set business_date = business_date - p_days_ago, created_at = created_at - make_interval(days => p_days_ago)
    where bill_id = v;
    update journal_entries set business_date = business_date - p_days_ago, created_at = created_at - make_interval(days => p_days_ago)
    where (source_type = 'purchase_bill' and source_id = v)
       or (source_type = 'supplier_payment' and source_id in (select id from supplier_payments where bill_id = v));
    update stock_movements set created_at = created_at - make_interval(days => p_days_ago) where ref_type = 'purchase_bill' and ref_id = v;
  end if;
end;
$$;

-- A month of running costs and two suppliers for a demo branch.
create function pg_temp.money_out(p_biz uuid, p_branch uuid, p_owner uuid, p_cashier uuid, p_rent bigint,
                                  p_supplier_a text, p_supplier_b text, p_stock jsonb) returns void
language plpgsql as $$
declare
  sa uuid;
  sb uuid;
  d int;
begin
  perform pg_temp.act_as(p_owner);
  sa := public.save_supplier(jsonb_build_object('business_id', p_biz, 'name', p_supplier_a, 'phone', '+971 4 339 2210', 'terms_days', 30));
  sb := public.save_supplier(jsonb_build_object('business_id', p_biz, 'name', p_supplier_b, 'phone', '+971 6 543 8800', 'terms_days', 15));
  perform pg_temp.bill(p_biz, p_branch, p_owner, sa, 'AM-4410', p_stock, 10000, 'bank', 20);   -- part paid
  perform pg_temp.bill(p_biz, p_branch, p_owner, sb, 'GC-2291', p_stock, 0, 'cash', 25);       -- overdue
  perform pg_temp.bill(p_biz, p_branch, p_owner, sa, 'AM-4498', p_stock, 0, 'cash', 3);        -- due later
  -- Tea & food most days, weekly dry cleaning; monthly bills.
  foreach d in array array[1, 2, 3, 5, 6, 8, 9, 10, 12, 13, 15, 16, 17, 19, 20, 22, 23, 24, 26, 27] loop
    perform pg_temp.expense(p_biz, p_branch, p_owner, 'tea_food', 1200 + (d % 5) * 350, 'cash', 'Tea, coffee and snacks', d);
  end loop;
  foreach d in array array[4, 11, 18, 25] loop
    perform pg_temp.expense(p_biz, p_branch, p_owner, 'dry_cleaning', 8500, 'cash', 'Towels and capes', d);
  end loop;
  perform pg_temp.expense(p_biz, p_branch, p_owner, 'rent', p_rent, 'bank', 'Monthly rent', 26);
  perform pg_temp.expense(p_biz, p_branch, p_owner, 'electricity', 124000, 'bank', 'DEWA — electricity', 14);
  perform pg_temp.expense(p_biz, p_branch, p_owner, 'water', 18000, 'bank', 'DEWA — water', 14);
  perform pg_temp.expense(p_biz, p_branch, p_owner, 'internet_phone', 39900, 'card', 'du Business internet', 12);
  perform pg_temp.expense(p_biz, p_branch, p_owner, 'uniforms', 60000, 'card', '6 new uniforms', 9);
  perform pg_temp.expense(p_biz, p_branch, p_owner, 'cleaning', 6000, 'cash', 'Disinfectant and wipes', 7);
  perform pg_temp.expense(p_biz, p_branch, p_owner, 'repairs', 25000, 'card', 'Chair hydraulic repair', 16);
  -- Today, by the cashier.
  perform pg_temp.expense(p_biz, p_branch, p_cashier, 'tea_food', 1500, 'cash', 'Tea for the team', 0);
end;
$$;

-- Opening stock for every recipe item: p_qty of each at p_cost fils per unit.
create function pg_temp.stock_up(p_branch uuid, p_owner uuid, p_qty numeric, p_cost numeric) returns void
language plpgsql as $$
begin
  perform pg_temp.act_as(p_owner);
  perform public.set_opening_stock(p_branch, (
    select jsonb_agg(jsonb_build_object('item_id', i.id, 'qty',
      case i.unit when 'ml' then p_qty * 10 when 'g' then p_qty * 10 else p_qty end,
      'unit_cost_minor', case i.unit when 'ml' then p_cost / 10 when 'g' then p_cost / 10 else p_cost end))
    from inventory_items i where i.business_id = (select business_id from branches where id = p_branch)));
end;
$$;

-- ── Gents: Al Barsha Gents ──────────────────────────────────────────────────────────────
do $$
declare
  owner uuid := '11111111-0000-4000-8000-000000000001';
  cashier uuid := '11111111-0000-4000-8000-000000000002';
  biz uuid;
  br uuid;
  owner_member uuid;
  c_ahmed uuid;
  c_bilal uuid;
  c_yousef uuid;
  c_hamza uuid;
  appt uuid;
  d int;
begin
  perform pg_temp.new_user(owner, 'demo-gents@example.com', 'Demo1234!', 'Tehseem');
  perform pg_temp.act_as(owner);
  select (r ->> 'business_id')::uuid, (r ->> 'branch_id')::uuid, (r ->> 'member_id')::uuid
    into biz, br, owner_member
  from public.create_business(jsonb_build_object(
    'business_name', 'Al Barsha Gents', 'owner_name', 'Tehseem', 'mode', 'gents', 'branch_name', 'Al Barsha Gents',
    'address', 'Al Barsha 1, Dubai', 'phone', '+971 4 123 4567', 'vat_mode', 'off', 'opening_cash_minor', 50000,
    'is_demo', true)) r;
  update businesses set code = 'albarsha' where id = biz;

  perform pg_temp.new_user(cashier, 'faisal@albarsha.staff.internal', 'Staff1234!', 'Faisal');
  perform pg_temp.new_user('11111111-0000-4000-8000-000000000003', 'rafiq@albarsha.staff.internal', 'Staff1234!', 'Rafiq');
  perform pg_temp.new_user('11111111-0000-4000-8000-000000000004', 'sameer@albarsha.staff.internal', 'Staff1234!', 'Sameer');
  perform pg_temp.new_user('11111111-0000-4000-8000-000000000005', 'imran@albarsha.staff.internal', 'Staff1234!', 'Imran');
  perform pg_temp.act_as_service();
  perform public.register_staff_member(jsonb_build_object('business_id', biz, 'branch_id', br, 'user_id', cashier,
    'username', 'faisal', 'display_name', 'Faisal', 'role', 'cashier', 'actor_member_id', owner_member));
  perform public.register_staff_member(jsonb_build_object('business_id', biz, 'branch_id', br,
    'user_id', '11111111-0000-4000-8000-000000000003', 'username', 'rafiq', 'display_name', 'Rafiq', 'role', 'staff',
    'commission_bps', 1200, 'colour', '#6C45F2', 'actor_member_id', owner_member));
  perform public.register_staff_member(jsonb_build_object('business_id', biz, 'branch_id', br,
    'user_id', '11111111-0000-4000-8000-000000000004', 'username', 'sameer', 'display_name', 'Sameer', 'role', 'staff',
    'commission_bps', 1000, 'colour', '#F28A2E', 'actor_member_id', owner_member));
  perform public.register_staff_member(jsonb_build_object('business_id', biz, 'branch_id', br,
    'user_id', '11111111-0000-4000-8000-000000000005', 'username', 'imran', 'display_name', 'Imran', 'role', 'staff',
    'commission_bps', 1100, 'colour', '#1E90D6', 'actor_member_id', owner_member));

  perform pg_temp.stock_up(br, owner, 40, 150);

  insert into customers (business_id, name, phone, preferences, created_by) values
    (biz, 'Ahmed Khan', '+971 50 111 2233', 'Skin fade, beard line', owner_member),
    (biz, 'Bilal Ahmed', '+971 55 234 5678', 'Scissor cut, no clippers on top', owner_member),
    (biz, 'Yousef Ali', '+971 52 987 6543', null, owner_member),
    (biz, 'Hamza Qureshi', '+971 56 444 1212', 'Classic taper', owner_member);
  select id into c_ahmed from customers where business_id = biz and name = 'Ahmed Khan';
  select id into c_bilal from customers where business_id = biz and name = 'Bilal Ahmed';
  select id into c_yousef from customers where business_id = biz and name = 'Yousef Ali';
  select id into c_hamza from customers where business_id = biz and name = 'Hamza Qureshi';

  for d in reverse 6..1 loop
    perform pg_temp.sell(br, cashier, array['Haircut'], 'Rafiq', 'cash', d);
    perform pg_temp.sell(br, cashier, array['Haircut', 'Beard Trim'], 'Sameer', 'card', d, 0, 0, c_bilal);
    perform pg_temp.sell(br, cashier, array['Shave'], 'Imran', 'cash', d);
    perform pg_temp.sell(br, cashier, array['Hair Color'], 'Sameer', 'split', d);
    if d % 2 = 0 then
      perform pg_temp.sell(br, cashier, array['Facial', 'Head Massage'], 'Rafiq', 'wallet', d, 500, 1000);
    end if;
  end loop;

  -- Today: finished sales, then the live queue.
  perform pg_temp.sell(br, cashier, array['Haircut', 'Beard Color'], 'Rafiq', 'cash', 0, 0, 0, c_hamza);
  perform pg_temp.sell(br, cashier, array['Shave', 'Head Massage'], 'Imran', 'card', 0, 0, 500);

  perform pg_temp.act_as(cashier);
  perform public.create_appointment(jsonb_build_object('branch_id', br, 'kind', 'walk_in', 'customer_id', c_ahmed,
    'service_ids', jsonb_build_array(pg_temp.svc(biz, 'Haircut'), pg_temp.svc(biz, 'Beard Trim')),
    'employee_id', pg_temp.emp(biz, 'Rafiq')));
  perform public.create_appointment(jsonb_build_object('branch_id', br, 'kind', 'walk_in',
    'service_ids', jsonb_build_array(pg_temp.svc(biz, 'Shave'))));
  appt := public.create_appointment(jsonb_build_object('branch_id', br, 'kind', 'walk_in', 'guest_name', 'Omar Farooq',
    'service_ids', jsonb_build_array(pg_temp.svc(biz, 'Hair Color')), 'employee_id', pg_temp.emp(biz, 'Sameer')));
  perform public.start_service(appt);
  perform public.create_appointment(jsonb_build_object('branch_id', br, 'kind', 'booking', 'customer_id', c_bilal,
    'scheduled_at', now() + interval '50 minutes', 'service_ids', jsonb_build_array(pg_temp.svc(biz, 'Haircut')),
    'employee_id', pg_temp.emp(biz, 'Imran')));
  perform public.create_appointment(jsonb_build_object('branch_id', br, 'kind', 'booking', 'customer_id', c_yousef,
    'scheduled_at', now() + interval '1 day 2 hours', 'service_ids', jsonb_build_array(pg_temp.svc(biz, 'Facial')),
    'deposit_minor', 2000, 'deposit_method', 'cash'));

  perform pg_temp.money_out(biz, br, owner, cashier, 850000, 'Al Maya Barber Supplies', 'Gulf Cosmetics Trading',
    '[["Blades", 200, 35], ["Neck strips", 500, 8], ["Shaving Foam", 2000, 4]]');
end $$;

-- ── Ladies: Jumeirah Ladies Salon & Spa ────────────────────────────────────────────────
do $$
declare
  owner uuid := '22222222-0000-4000-8000-000000000001';
  cashier uuid := '22222222-0000-4000-8000-000000000002';
  biz uuid;
  br uuid;
  owner_member uuid;
  c_fatima uuid;
  c_sara uuid;
  c_hind uuid;
  c_noura uuid;
  appt uuid;
  d int;
begin
  perform pg_temp.new_user(owner, 'demo-ladies@example.com', 'Demo1234!', 'Mariam');
  perform pg_temp.act_as(owner);
  select (r ->> 'business_id')::uuid, (r ->> 'branch_id')::uuid, (r ->> 'member_id')::uuid
    into biz, br, owner_member
  from public.create_business(jsonb_build_object(
    'business_name', 'Jumeirah Ladies Salon & Spa', 'owner_name', 'Mariam', 'mode', 'ladies',
    'branch_name', 'Jumeirah Ladies Salon & Spa', 'address', 'Jumeirah Beach Road, Dubai', 'phone', '+971 4 765 4321',
    'vat_mode', 'on', 'trn', '100234567800003', 'opening_cash_minor', 80000, 'is_demo', true)) r;
  update businesses set code = 'jumeirah' where id = biz;

  perform pg_temp.new_user(cashier, 'noor@jumeirah.staff.internal', 'Staff1234!', 'Noor');
  perform pg_temp.new_user('22222222-0000-4000-8000-000000000003', 'aisha@jumeirah.staff.internal', 'Staff1234!', 'Aisha');
  perform pg_temp.new_user('22222222-0000-4000-8000-000000000004', 'priya@jumeirah.staff.internal', 'Staff1234!', 'Priya');
  perform pg_temp.new_user('22222222-0000-4000-8000-000000000005', 'leila@jumeirah.staff.internal', 'Staff1234!', 'Leila');
  perform pg_temp.act_as_service();
  perform public.register_staff_member(jsonb_build_object('business_id', biz, 'branch_id', br, 'user_id', cashier,
    'username', 'noor', 'display_name', 'Noor', 'role', 'cashier', 'actor_member_id', owner_member));
  perform public.register_staff_member(jsonb_build_object('business_id', biz, 'branch_id', br,
    'user_id', '22222222-0000-4000-8000-000000000003', 'username', 'aisha', 'display_name', 'Aisha', 'role', 'staff',
    'commission_bps', 1200, 'colour', '#F2777A', 'actor_member_id', owner_member));
  perform public.register_staff_member(jsonb_build_object('business_id', biz, 'branch_id', br,
    'user_id', '22222222-0000-4000-8000-000000000004', 'username', 'priya', 'display_name', 'Priya', 'role', 'staff',
    'commission_bps', 1000, 'colour', '#B892DB', 'actor_member_id', owner_member));
  perform public.register_staff_member(jsonb_build_object('business_id', biz, 'branch_id', br,
    'user_id', '22222222-0000-4000-8000-000000000005', 'username', 'leila', 'display_name', 'Leila', 'role', 'staff',
    'commission_bps', 1200, 'colour', '#E0A800', 'actor_member_id', owner_member));

  perform pg_temp.stock_up(br, owner, 30, 300);

  insert into customers (business_id, name, phone, preferences, risk_flags, created_by) values
    (biz, 'Fatima Al Mansoori', '+971 50 222 3344', 'Prefers Leila, warm oil', '{}', owner_member),
    (biz, 'Sara Ahmed', '+971 55 876 5432', 'Nude gel, almond shape', '{}', owner_member),
    (biz, 'Hind Rashid', '+971 52 345 6789', 'Ash brown', '{patch_test}', owner_member),
    (biz, 'Noura Saeed', '+971 56 765 4321', 'Bride — soft glam', '{}', owner_member);
  select id into c_fatima from customers where business_id = biz and name = 'Fatima Al Mansoori';
  select id into c_sara from customers where business_id = biz and name = 'Sara Ahmed';
  select id into c_hind from customers where business_id = biz and name = 'Hind Rashid';
  select id into c_noura from customers where business_id = biz and name = 'Noura Saeed';

  for d in reverse 6..1 loop
    perform pg_temp.sell(br, cashier, array['Blow-dry'], 'Aisha', 'card', d);
    perform pg_temp.sell(br, cashier, array['Gel Nails'], 'Priya', 'card', d, 0, 0, c_sara);
    perform pg_temp.sell(br, cashier, array['Manicure', 'Pedicure'], 'Priya', 'cash', d);
    perform pg_temp.sell(br, cashier, array['Hair Color'], 'Aisha', 'split', d, 2500, 1000);
    if d % 2 = 1 then
      perform pg_temp.sell(br, cashier, array['Threading', 'Facial & Eye'], 'Leila', 'wallet', d);
    end if;
  end loop;

  perform pg_temp.sell(br, cashier, array['Hair Styling'], 'Aisha', 'card', 0, 0, 0, c_fatima);
  perform pg_temp.sell(br, cashier, array['Gel Nails'], 'Priya', 'cash', 0);

  perform pg_temp.act_as(cashier);
  appt := public.create_appointment(jsonb_build_object('branch_id', br, 'kind', 'walk_in', 'customer_id', c_fatima,
    'service_ids', jsonb_build_array(pg_temp.svc(biz, 'Moroccan Bath')), 'employee_id', pg_temp.emp(biz, 'Leila'),
    'room_id', (select id from rooms where branch_id = br and name = 'Spa room 1')));
  perform public.start_service(appt);
  perform public.create_appointment(jsonb_build_object('branch_id', br, 'kind', 'walk_in',
    'service_ids', jsonb_build_array(pg_temp.svc(biz, 'Threading'))));
  perform public.create_appointment(jsonb_build_object('branch_id', br, 'kind', 'booking', 'customer_id', c_sara,
    'scheduled_at', now() + interval '40 minutes', 'service_ids', jsonb_build_array(pg_temp.svc(biz, 'Gel Nails')),
    'employee_id', pg_temp.emp(biz, 'Priya')));
  perform public.create_appointment(jsonb_build_object('branch_id', br, 'kind', 'booking', 'customer_id', c_hind,
    'scheduled_at', now() + interval '2 hours', 'service_ids', jsonb_build_array(pg_temp.svc(biz, 'Hair Color')),
    'employee_id', pg_temp.emp(biz, 'Aisha')));
  perform public.create_appointment(jsonb_build_object('branch_id', br, 'kind', 'booking', 'customer_id', c_noura,
    'scheduled_at', now() + interval '1 day 3 hours', 'service_ids', jsonb_build_array(pg_temp.svc(biz, 'Bridal Makeup')),
    'deposit_minor', 20000, 'deposit_method', 'card'));

  perform pg_temp.money_out(biz, br, owner, cashier, 1500000, 'Beauty Line Trading LLC', 'Nails & Co Wholesale',
    '[["Nail polish", 500, 12], ["Gel polish", 300, 25], ["Face masks", 60, 450]]');
end $$;

select set_config('request.jwt.claims', '', false);
