-- Part B, step 4 (owner's app check, 10 Nov 2026; brief B2 "Customers" and "Bookings and queue"): each of the five
-- login types tried on the customer book, a stylist's own clients and their phone numbers, service notes, merging
-- and deleting customers, and what a stylist sees of the others' bookings.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(46);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000072' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'customer-roles-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(),
       '{}', '{}'
from unnest(array['a0', 'b1', 'b2', 'b3', 'b4', 'b5']) n;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000072' || p)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

select pg_temp.as_user('a0');
select set_config('t.b', (create_business('{"business_name":"Customer Roles Salon","owner_name":"Owner","mode":"gents",
  "vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select set_config('t.svc', (select id::text from services where business_id = current_setting('t.b')::uuid
                            and status = 'active' order by price_minor desc limit 1), false);

-- Manager Mona (b1), front desk Dina (b2), stylists Sami (b3) and Rami (b5) in the branch; the accountant (b4).
select pg_temp.as_admin();
select set_config('t.today', branch_today(current_setting('t.br')::uuid)::text, false);
create function pg_temp.member(p_user text, p_role text, p_name text) returns void language plpgsql as $$
declare v uuid;
begin
  insert into members (business_id, user_id, role, display_name, username)
  values (current_setting('t.b')::uuid, ('00000000-0000-0000-0000-0000000072' || p_user)::uuid, p_role::member_role,
          p_name, lower(p_name) || 'seventytwo') returning id into v;
  if p_role <> 'accountant' then
    insert into member_branches (member_id, branch_id) values (v, current_setting('t.br')::uuid);
    insert into employees (business_id, branch_id, member_id, full_name, role_title)
    values (current_setting('t.b')::uuid, current_setting('t.br')::uuid, v, p_name,
            case p_role when 'cashier' then 'cashier' when 'manager' then 'manager' else 'staff' end)
    returning id into v;
  end if;
  perform set_config('t.' || p_user, v::text, false);
end $$;
select pg_temp.member('b1', 'manager', 'Mona'), pg_temp.member('b2', 'cashier', 'Dina'),
       pg_temp.member('b3', 'staff', 'Sami'), pg_temp.member('b4', 'accountant', 'Books'),
       pg_temp.member('b5', 'staff', 'Rami');

-- Customers: Omar (Sami served him), Lina (booked with Sami next week), Huda (Rami's), Omar again (a duplicate).
create function pg_temp.customer(p_key text, p_name text, p_phone text) returns void language plpgsql as $$
declare v uuid;
begin
  insert into customers (business_id, name, phone, preferences) values (current_setting('t.b')::uuid, p_name, p_phone,
    'Short on the sides') returning id into v;
  perform set_config('t.' || p_key, v::text, false);
end $$;
select pg_temp.customer('omar', 'Omar', '+971 50 111 0001'), pg_temp.customer('lina', 'Lina', '+971 50 111 0002'),
       pg_temp.customer('huda', 'Huda', '+971 50 111 0003'), pg_temp.customer('omar2', 'Omar K', '+971 50 111 0001');
create function pg_temp.sale(p_customer text, p_employee text) returns uuid language sql as $$
  select (create_sale(jsonb_build_object('branch_id', current_setting('t.br'), 'customer_id', current_setting(p_customer),
    'employee_id', current_setting(p_employee),
    'lines', '[{"kind":"custom","name":"Fade","unit_price_minor":5000}]'::jsonb,
    'payments', '[{"method":"cash","amount_minor":5000}]'::jsonb)) ->> 'sale_id')::uuid
$$;
create function pg_temp.book(p_customer text, p_employee text, p_days int) returns uuid language sql as $$
  select create_appointment(jsonb_build_object('branch_id', current_setting('t.br'), 'kind', 'booking',
    'customer_id', current_setting(p_customer), 'employee_id', current_setting(p_employee),
    'service_ids', jsonb_build_array(current_setting('t.svc')), 'scheduled_at', (current_setting('t.today')::date + p_days + time '11:00')::timestamp at time zone 'Asia/Dubai'))
$$;
select pg_temp.as_user('b2');
select set_config('t.s_omar', pg_temp.sale('t.omar', 't.b3')::text, false);
select set_config('t.s_omar2', pg_temp.sale('t.omar2', 't.b5')::text, false);
select set_config('t.a_lina', pg_temp.book('t.lina', 't.b3', 7)::text, false);
select set_config('t.a_huda', pg_temp.book('t.huda', 't.b5', 7)::text, false);
select set_config('t.a_omar2', pg_temp.book('t.omar2', 't.b5', 8)::text, false);

-- 1. The customer book.
select is((select count(*)::int from customers), 4, 'the front desk reads the customer book');
select pg_temp.as_user('b1');
select is((select count(*)::int from customers), 4, 'so does a manager');
select lives_ok($$ insert into customers (business_id, name) values (current_setting('t.b')::uuid, 'Walk-in Sara') $$,
  'and adds a customer');
select pg_temp.as_user('b4');
select is((select count(*)::int from customers), 0, 'the accountant has no customer book');
select throws_ok($$ insert into customers (business_id, name) values (current_setting('t.b')::uuid, 'Nope') $$,
  '42501', null, 'and adds none');
select throws_ok(format($$ select my_clients('%s') $$, current_setting('t.br')), '42501', 'not_allowed',
  'nor through the client list');
select pg_temp.as_user('b3');
select is((select count(*)::int from customers), 0, 'a stylist does not read the customer book directly');
select throws_ok($$ insert into customers (business_id, name) values (current_setting('t.b')::uuid, 'Nope') $$,
  '42501', null, 'nor adds to it');

-- 2. A stylist's own clients.
select is((select array_agg(name order by name) from my_clients(current_setting('t.br')::uuid)), array['Lina', 'Omar'],
  'Sami''s clients: Omar, whom he served, and Lina, booked with him');
select is((select count(*)::int from my_clients(current_setting('t.br')::uuid) where phone is not null), 0,
  'without phone numbers');
select is((select count(*)::int from my_clients(current_setting('t.br')::uuid, '111 0001')), 0,
  'and he cannot find a client by phone');
select is((client_card(current_setting('t.br')::uuid, current_setting('t.omar')::uuid) #>> '{customer,preferences}'),
  'Short on the sides', 'he opens Omar''s card, with his preferences');
select is(jsonb_array_length(client_card(current_setting('t.br')::uuid, current_setting('t.omar')::uuid) -> 'visits'), 1,
  'and his visit with Sami');
select is(client_card(current_setting('t.br')::uuid, current_setting('t.lina')::uuid) #>> '{upcoming,0,id}',
  current_setting('t.a_lina'), 'Lina''s card shows her booking with him');
select throws_ok(format($$ select client_card('%s', '%s') $$, current_setting('t.br'), current_setting('t.huda')),
  '42501', 'not_allowed', 'Rami''s client is not his to open');
select pg_temp.as_user('a0');
select lives_ok(format($$ select save_controls('%s', '{"staff_see_phones": true}') $$, current_setting('t.br')),
  'the owner lets stylists see phone numbers');
select pg_temp.as_user('b3');
select is((select phone from my_clients(current_setting('t.br')::uuid) where name = 'Omar'), '+971 50 111 0001',
  'then Sami sees his clients'' numbers');
select is((client_card(current_setting('t.br')::uuid, current_setting('t.omar')::uuid) #>> '{customer,notes}'), null,
  'never the front desk''s private notes');

-- 3. Service notes.
select lives_ok(format($$ select add_service_note('%s', '%s', 'Clipper 2 on the sides, scissors on top') $$,
  current_setting('t.br'), current_setting('t.omar')), 'Sami adds a service note for his client');
select throws_ok(format($$ select add_service_note('%s', '%s', 'Hello') $$, current_setting('t.br'), current_setting('t.huda')),
  '42501', 'not_allowed', 'not for someone else''s client');
select throws_ok(format($$ select add_service_note('%s', '%s', ' ') $$, current_setting('t.br'), current_setting('t.omar')),
  '22023', 'invalid_note', 'an empty note is refused');
select pg_temp.as_user('b2');
select lives_ok(format($$ select add_service_note('%s', '%s', 'Allergic to the blue dye') $$,
  current_setting('t.br'), current_setting('t.huda')), 'the front desk adds a note for any customer');
select is((select author_name || ': ' || note from customer_notes where customer_id = current_setting('t.omar')::uuid),
  'Sami: Clipper 2 on the sides, scissors on top', 'the front desk reads Sami''s note, with his name');
select pg_temp.as_user('b4');
select throws_ok(format($$ select add_service_note('%s', '%s', 'Hi') $$, current_setting('t.br'), current_setting('t.omar')),
  '42501', 'not_allowed', 'the accountant adds no notes');
select is((select count(*)::int from customer_notes), 0, 'nor reads them');

-- 4. Merging duplicates.
select pg_temp.as_user('b2');
select throws_ok(format($$ select merge_customers('%s', '%s', '%s') $$, current_setting('t.br'), current_setting('t.omar'),
  current_setting('t.omar2')), '42501', 'not_allowed', 'the front desk does not merge');
select pg_temp.as_user('b1');
select is((merge_customers(current_setting('t.br')::uuid, current_setting('t.omar')::uuid,
  current_setting('t.omar2')::uuid) ->> 'sales_moved')::int, 1, 'a manager merges Omar K into Omar: his sale moves over');
select is(array[(select customer_id::text from sales where id = current_setting('t.s_omar2')::uuid),
                (select customer_id::text from appointments where id = current_setting('t.a_omar2')::uuid)],
  array[current_setting('t.omar'), current_setting('t.omar')], 'so does his booking');
select is((select array_agg(name order by name) from customers where name like 'Omar%'), array['Omar'],
  'the duplicate leaves the book');
select is((select visit_count from customers where id = current_setting('t.omar')::uuid), 2,
  'and his visits add up on the one kept');
select throws_ok(format($$ select merge_customers('%s', '%s', '%s') $$, current_setting('t.br'), current_setting('t.omar'),
  current_setting('t.omar2')), 'P0002', 'not_found', 'a merged customer cannot be merged again');
-- A screen opened before the merge still names Omar K: the sale and the booking go to Omar.
select pg_temp.as_user('b2');
select set_config('t.s_stale', pg_temp.sale('t.omar2', 't.b3')::text, false);
select set_config('t.a_stale', pg_temp.book('t.omar2', 't.b3', 9)::text, false);
select is((select customer_id::text from sales where id = current_setting('t.s_stale')::uuid), current_setting('t.omar'),
  'a sale for the merged duplicate goes to the customer kept');
select is((select customer_id::text from appointments where id = current_setting('t.a_stale')::uuid),
  current_setting('t.omar'), 'so does a booking');
-- The online booking page finds Omar by his number, not the duplicate that shared it.
select pg_temp.as_user('a0');
select set_config('t.slug', set_online_booking(current_setting('t.br')::uuid, true), false);
select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('t.online', (public_book(jsonb_build_object('slug', current_setting('t.slug'),
  'service_ids', jsonb_build_array(current_setting('t.svc')),
  'starts_at', (current_setting('t.today')::date + 3 + time '12:00') at time zone 'Asia/Dubai',
  'name', 'Omar', 'phone', '+971 50 111 0001')) ->> 'token'), false);
select pg_temp.as_admin();
select is((select customer_id::text from appointments where booking_token = current_setting('t.online')),
  current_setting('t.omar'), 'an online booking from the shared number books the customer kept');

-- 5. Deleting a customer.
select pg_temp.as_user('b1');
select throws_ok(format($$ select delete_customer('%s', '%s', 'Asked to be removed') $$, current_setting('t.br'),
  current_setting('t.huda')), '42501', 'not_allowed', 'a manager does not delete customers');
select pg_temp.as_user('a0');
select throws_ok(format($$ select delete_customer('%s', '%s', '') $$, current_setting('t.br'), current_setting('t.huda')),
  '22023', 'reason_required', 'the owner gives a reason');
select lives_ok(format($$ select delete_customer('%s', '%s', 'Asked to be removed') $$, current_setting('t.br'),
  current_setting('t.huda')), 'and deletes Huda');
select pg_temp.as_admin();
select is((select name || ' ' || coalesce(phone, '-') || ' ' || (select count(*) from customer_notes n where n.customer_id = c.id)
           from customers c where id = current_setting('t.huda')::uuid), 'Deleted customer - 0',
  'her name, number and notes are gone');
select is((select customer_name from appointments where id = current_setting('t.a_huda')::uuid), 'Deleted customer',
  'her booking keeps no name');
select pg_temp.as_user('b2');
select throws_ok($$ select pg_temp.sale('t.huda', 't.b5') $$, 'P0002', 'not_found',
  'a deleted customer cannot be picked for a new sale');

-- 5b. Reports → Customers: only customers in the book; phone numbers for the owner, not the accountant.
select pg_temp.as_user('b4');
select is((select array_agg(name || ':' || coalesce(phone, '-') order by name)
           from report_customers(current_setting('t.b')::uuid, to_char(current_setting('t.today')::date, 'YYYY-MM'))),
  array['Lina:-', 'Omar:-', 'Walk-in Sara:-'], 'the accountant''s customers report: no merged or deleted customers, no phone numbers');
select pg_temp.as_user('a0');
select is((select phone from report_customers(current_setting('t.b')::uuid, to_char(current_setting('t.today')::date, 'YYYY-MM'))
           where name = 'Omar'), '+971 50 111 0001', 'the owner''s shows the number');

-- 6. The queue.
select pg_temp.as_user('b3');
-- (His booking with Lina and the one made for Omar K above; the online booking has no stylist yet.)
select is((select count(*)::int from appointments), 3, 'Sami reads only his own bookings and unassigned ones');
select is((select count(*)::int from busy_times(current_setting('t.br')::uuid, current_setting('t.today')::date + 7)), 2,
  'and sees that day''s other booking as busy time, without the client');
select pg_temp.as_user('b4');
select is((select count(*)::int from appointments), 0, 'the accountant reads no bookings');
select pg_temp.as_user('b1');
select is(array[(select count(*)::int from appointments), (select count(*)::int from sales)], array[5, 3],
  'a manager reads the branch''s bookings and sales');

select * from finish();
rollback;
