-- M1 core: tenancy, setup, queue, sales, refunds, deposits, ledger guarantees.
begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

-- ── Test users ──────────────────────────────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'owner-a@test.local', crypt('pw-a-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'owner-b@test.local', crypt('pw-b-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'cashier@test.local', crypt('pw-c-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'staff@test.local', crypt('pw-d-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.balanced() returns boolean language sql as $$
  select coalesce(bool_and(d = c), true) from (
    select sum(debit_minor) d, sum(credit_minor) c from journal_lines group by entry_id) x
$$;

-- ── Setup ───────────────────────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select set_config('t.a', (create_business('{"business_name":"Al Barsha Gents","owner_name":"Tehseem","mode":"gents",
  "branch_name":"Al Barsha","vat_mode":"off","opening_cash_minor":10000}') ->> 'business_id'), false);
select set_config('t.a_branch', (select id::text from branches where business_id = current_setting('t.a')::uuid), false);

select is((select count(*)::int from services where business_id = current_setting('t.a')::uuid), 7,
  'gents setup seeds 7 services');
select is((select count(*)::int from service_categories where business_id = current_setting('t.a')::uuid), 5,
  'gents setup seeds 5 categories');
select is((select count(*)::int from rooms where business_id = current_setting('t.a')::uuid), 0, 'gents has no rooms');
select is(expected_cash(current_setting('t.a_branch')::uuid), 10000::bigint, 'opening cash is expected cash');
select throws_ok($$ select create_business('{"business_name":"Second","mode":"gents"}') $$, '23505', null,
  'one business per owner');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select set_config('t.b', (create_business('{"business_name":"Jumeirah Ladies","owner_name":"Mariam","mode":"ladies",
  "vat_mode":"on","trn":"100000000000003"}') ->> 'business_id'), false);
select set_config('t.b_branch', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select is((select count(*)::int from services where business_id = current_setting('t.b')::uuid), 12,
  'ladies setup seeds 12 services');
select is((select count(*)::int from rooms where business_id = current_setting('t.b')::uuid), 2, 'ladies has 2 rooms');
select throws_ok($$ select create_business('{"business_name":"No TRN","mode":"ladies","vat_mode":"on"}') $$,
  '23505', null, 'still one business per owner');

-- Staff for A (as the Edge Function would)
select pg_temp.as_service();
select set_config('t.cashier_emp', (register_staff_member(jsonb_build_object(
  'business_id', current_setting('t.a'), 'branch_id', current_setting('t.a_branch'),
  'user_id', '00000000-0000-0000-0000-0000000000c1', 'username', 'faisal', 'display_name', 'Faisal',
  'role', 'cashier')) ->> 'employee_id'), false);
select set_config('t.staff_emp', (register_staff_member(jsonb_build_object(
  'business_id', current_setting('t.a'), 'branch_id', current_setting('t.a_branch'),
  'user_id', '00000000-0000-0000-0000-0000000000d1', 'username', 'rafiq', 'display_name', 'Rafiq',
  'role', 'staff', 'commission_bps', 1200)) ->> 'employee_id'), false);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select register_staff_member('{"role":"cashier"}') $$, '42501', null,
  'only the service role registers staff');

-- ── Tenancy ─────────────────────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from services where business_id = current_setting('t.b')::uuid), 0,
  'owner A sees no services of B');
select is((select count(*)::int from branches where business_id = current_setting('t.b')::uuid), 0,
  'owner A sees no branch of B');
select is((select count(*)::int from accounts where business_id = current_setting('t.b')::uuid), 0,
  'owner A sees no accounts of B');
select throws_ok(format($$ select dashboard_today(%L) $$, current_setting('t.b_branch')), '42501', null,
  'owner A cannot read B''s dashboard');
select throws_ok(format($$ select create_appointment('{"branch_id":"%s","kind":"walk_in"}') $$,
  current_setting('t.b_branch')), '42501', null, 'owner A cannot add to B''s queue');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from accounts), 0, 'cashier cannot read the chart of accounts');
select is((select count(*)::int from journal_entries), 0, 'cashier cannot read the journal');
select throws_ok(format($$ select set_branch_mode(%L, 'ladies') $$, current_setting('t.a_branch')), '42501', null,
  'cashier cannot switch the salon type');
select throws_ok($$ insert into services (business_id, category_id, name, price_minor, duration_min)
  select business_id, id, 'Free', 0, 10 from service_categories limit 1 $$, '42501', null,
  'services cannot be inserted directly');

-- ── Walk-in → sale (cashier), VAT off ───────────────────────────────────────────────────
select set_config('t.walkin', create_appointment(jsonb_build_object('branch_id', current_setting('t.a_branch'),
  'kind', 'walk_in', 'guest_name', 'Ahmed', 'employee_id', current_setting('t.staff_emp')))::text, false);
select is((select status::text from appointments where id = current_setting('t.walkin')::uuid), 'waiting',
  'walk-in goes straight to waiting');
select lives_ok(format($$ select start_service(%L) $$, current_setting('t.walkin')), 'cashier starts the service');
select set_config('t.sale1', (create_sale(jsonb_build_object(
  'branch_id', current_setting('t.a_branch'), 'appointment_id', current_setting('t.walkin'), 'client_ref', 'ref-1',
  'lines', jsonb_build_array(
    jsonb_build_object('service_id', (select id from services where name = 'Haircut' and business_id = current_setting('t.a')::uuid)),
    jsonb_build_object('service_id', (select id from services where name = 'Beard Color' and business_id = current_setting('t.a')::uuid))),
  'payments', '[{"method":"cash","amount_minor":7000}]'::jsonb)) ->> 'sale_id'), false);
select is((select total_minor from sales where id = current_setting('t.sale1')::uuid), 7000::bigint,
  'Haircut + Beard Color = AED 70.00');
select is((select number from sales where id = current_setting('t.sale1')::uuid), 1001, 'first sale is #1001');
select is((select status::text from appointments where id = current_setting('t.walkin')::uuid), 'completed',
  'sale completes the appointment');
select is((select qty from stock_levels sl join inventory_items i on i.id = sl.item_id
           where i.name = 'Beard Color' and i.business_id = current_setting('t.a')::uuid), -20.000,
  'Beard Color stock down 20 ml');
select is((select commission_minor from sale_lines where sale_id = current_setting('t.sale1')::uuid and name_snapshot = 'Haircut'),
  300::bigint, '12% commission on AED 25.00 = AED 3.00');
select is(expected_cash(current_setting('t.a_branch')::uuid), 17000::bigint, 'cash sale raises expected cash');
select is((create_sale(jsonb_build_object('branch_id', current_setting('t.a_branch'), 'client_ref', 'ref-1',
  'lines', '[]', 'payments', '[]'::jsonb)) ->> 'sale_id'), current_setting('t.sale1'), 'same client_ref returns the same sale');
select pg_temp.as_admin();
select is((select next_number from sale_counters where branch_id = current_setting('t.a_branch')::uuid), 1002,
  'a repeated tap does not use a sale number');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select throws_ok(format($$ select create_sale('{"branch_id":"%s","lines":[{"kind":"custom","name":"X","unit_price_minor":1000}],
  "payments":[{"method":"cash","amount_minor":900}]}') $$, current_setting('t.a_branch')), '22023', null,
  'payments must equal the amount due');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select throws_ok(format($$ select create_sale('{"branch_id":"%s","lines":[{"kind":"custom","name":"X","unit_price_minor":1000}],
  "payments":[{"method":"cash","amount_minor":1000}]}') $$, current_setting('t.a_branch')), '42501', null,
  'staff cannot sell while the setting is off');
select ok(not (dashboard_today(current_setting('t.a_branch')::uuid) ? 'expected_cash'), 'staff Home has no cash figures');
select is((dashboard_today(current_setting('t.a_branch')::uuid) -> 'me' ->> 'services_today')::numeric, 2::numeric,
  'staff Home counts my services');

-- ── Refunds: owner only ────────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select throws_ok(format($$ select refund_sale('{"sale_id":"%s","amount_minor":1000,"method":"cash","reason":"Unhappy"}') $$,
  current_setting('t.sale1')), '42501', null, 'cashier cannot refund');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select throws_ok(format($$ select refund_sale('{"sale_id":"%s","amount_minor":1000,"method":"cash","reason":""}') $$,
  current_setting('t.sale1')), '22023', null, 'a refund needs a reason');
select is((refund_sale(jsonb_build_object('sale_id', current_setting('t.sale1'), 'amount_minor', 2000, 'method', 'cash',
  'reason', 'Customer unhappy', 'idempotency_key', 'rf-1')) ->> 'status'), 'partially_refunded', 'owner refunds part');
select is((refund_sale(jsonb_build_object('sale_id', current_setting('t.sale1'), 'amount_minor', 2000, 'method', 'cash',
  'reason', 'Customer unhappy', 'idempotency_key', 'rf-1')) ->> 'refunded_minor')::bigint, 2000::bigint,
  'a repeated refund tap refunds once');
select is(expected_cash(current_setting('t.a_branch')::uuid), 15000::bigint, 'cash refund lowers expected cash');
select throws_ok(format($$ select refund_sale('{"sale_id":"%s","amount_minor":6000,"method":"cash","reason":"Too much"}') $$,
  current_setting('t.sale1')), '22023', null, 'cannot refund more than was paid');

-- ── Discount + tip + split, VAT on (B) ─────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select set_config('t.sale2', (create_sale(jsonb_build_object('branch_id', current_setting('t.b_branch'),
  'lines', jsonb_build_array(
    jsonb_build_object('service_id', (select id from services where name = 'Hair Styling' and business_id = current_setting('t.b')::uuid)),
    jsonb_build_object('service_id', (select id from services where name = 'Manicure' and business_id = current_setting('t.b')::uuid))),
  'discount_minor', 2000, 'tip_minor', 1000,
  'payments', '[{"method":"cash","amount_minor":10000},{"method":"card","amount_minor":11000}]'::jsonb)) ->> 'sale_id'), false);
select results_eq(format($$ select subtotal_minor, discount_minor, vat_minor, tip_minor, total_minor from sales where id = %L $$,
  current_setting('t.sale2')), $$ values (22000::bigint, 2000::bigint, 952::bigint, 1000::bigint, 21000::bigint) $$,
  '220 − 20 discount = 200 incl. 9.52 VAT, + 10 tip = 210');
select is((select sum(vat_minor) from sale_lines where sale_id = current_setting('t.sale2')::uuid), 952::numeric,
  'line VAT adds up to the sale VAT');
select is((select sum(discount_minor) from sale_lines where sale_id = current_setting('t.sale2')::uuid), 2000::numeric,
  'line discounts add up to the sale discount');

-- ── Deposits ───────────────────────────────────────────────────────────────────────────
select set_config('t.cust', (select c.id::text from customers c limit 0), false);
insert into customers (business_id, name, phone) values (current_setting('t.b')::uuid, 'Sara Ahmed', '+971501234567');
select set_config('t.cust', (select id::text from customers where name = 'Sara Ahmed'), false);
select set_config('t.book1', create_appointment(jsonb_build_object('branch_id', current_setting('t.b_branch'),
  'kind', 'booking', 'customer_id', current_setting('t.cust'), 'scheduled_at', now() + interval '1 day',
  'service_ids', jsonb_build_array((select id from services where name = 'Gel Nails' and business_id = current_setting('t.b')::uuid)),
  'deposit_minor', 5000, 'deposit_method', 'cash'))::text, false);
select is((select deposit_status::text from appointments where id = current_setting('t.book1')::uuid), 'held',
  'deposit is held');
select lives_ok(format($$ select mark_no_show(%L) $$, current_setting('t.book1')), 'mark no-show');
select is((select deposit_status::text from appointments where id = current_setting('t.book1')::uuid), 'forfeited',
  'no-show forfeits the deposit');
select is((select no_show_count from customers where id = current_setting('t.cust')::uuid), 1, 'no-show count +1');
select throws_ok(format($$ select create_appointment('{"branch_id":"%s","kind":"booking","scheduled_at":"%s",
  "service_ids":["%s"]}') $$, current_setting('t.b_branch'), (now() + interval '2 days')::text,
  (select id from services where name = 'Moroccan Bath' and business_id = current_setting('t.b')::uuid)), '22023', null,
  'spa services need a room in ladies mode');

select set_config('t.book2', create_appointment(jsonb_build_object('branch_id', current_setting('t.b_branch'),
  'kind', 'booking', 'customer_id', current_setting('t.cust'), 'scheduled_at', now() + interval '3 days',
  'service_ids', jsonb_build_array((select id from services where name = 'Manicure' and business_id = current_setting('t.b')::uuid)),
  'deposit_minor', 3000, 'deposit_method', 'card'))::text, false);
select is(cancel_appointment(current_setting('t.book2')::uuid, 'Customer called'), 'refund',
  'cancel before the cut-off refunds the deposit');
select set_config('t.book3', create_appointment(jsonb_build_object('branch_id', current_setting('t.b_branch'),
  'kind', 'booking', 'guest_name', 'Late', 'scheduled_at', now() + interval '2 hours',
  'service_ids', jsonb_build_array((select id from services where name = 'Threading' and business_id = current_setting('t.b')::uuid)),
  'deposit_minor', 1000, 'deposit_method', 'cash'))::text, false);
select is(cancel_appointment(current_setting('t.book3')::uuid, 'Too late'), 'forfeit',
  'cancel after the cut-off forfeits the deposit');

-- ── Ledger guarantees ──────────────────────────────────────────────────────────────────
select pg_temp.as_admin();
select ok(pg_temp.balanced(), 'every journal entry balances');
set constraints all immediate;
select throws_ok($$
  with e as (insert into journal_entries (business_id, business_date, source_type)
             values (current_setting('t.a')::uuid, current_date, 'test') returning id)
  insert into journal_lines (entry_id, account_id, debit_minor)
  select e.id, (select id from accounts where business_id = current_setting('t.a')::uuid and system_key = 'cash'), 100 from e
$$, '23514', null, 'an unbalanced entry is rejected');
set constraints all deferred;
update periods set status = 'closed' where business_id = current_setting('t.a')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select throws_ok(format($$ select create_sale('{"branch_id":"%s","lines":[{"kind":"custom","name":"X","unit_price_minor":1000}],
  "payments":[{"method":"cash","amount_minor":1000}]}') $$, current_setting('t.a_branch')), '23514', null,
  'posting into a closed period is rejected');

-- ── Blocking stock setting ─────────────────────────────────────────────────────────────
select pg_temp.as_admin();
update periods set status = 'open' where business_id = current_setting('t.a')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select lives_ok(format($$ select update_branch(%L, '{"settings":{"block_insufficient_stock":true}}') $$,
  current_setting('t.a_branch')), 'owner turns on stock blocking');
select throws_ok(format($$ select create_sale('{"branch_id":"%s","lines":[{"service_id":"%s"}],
  "payments":[{"method":"cash","amount_minor":1500}]}') $$, current_setting('t.a_branch'),
  (select id from services where name = 'Shave' and business_id = current_setting('t.a')::uuid)), '22023', null,
  'blocked when recipe stock is short');

-- ── Booking slots: late closing and past-midnight hours ──────────────────────────────────
select pg_temp.as_admin();
update branches set opening_hours = '{"open":"00:00","close":"23:59","days":[0,1,2,3,4,5,6]}'
where id = current_setting('t.a_branch')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from available_slots(current_setting('t.a_branch')::uuid, current_date + 1, 30)), 47,
  'open until 23:59: 30-minute slots stop at 23:00 (no wrap past midnight)');
select pg_temp.as_admin();
update branches set opening_hours = '{"open":"18:00","close":"02:00","days":[0,1,2,3,4,5,6]}'
where id = current_setting('t.a_branch')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select is((select max(slot) filter (where slot < '12:00')
           from available_slots(current_setting('t.a_branch')::uuid, current_date + 1, 30)), '01:30',
  'open 18:00 to 02:00: the last slot is 01:30');
select is((select starts_at from available_slots(current_setting('t.a_branch')::uuid, current_date + 1, 30)
           where slot = '01:30'),
          ((current_date + 2)::timestamp + time '01:30') at time zone 'Asia/Dubai',
  'a slot after midnight starts on the next calendar day');
select is((select count(*)::int from available_slots(current_setting('t.a_branch')::uuid, current_date + 1, 30)), 16,
  'open 18:00 to 02:00: 16 half-hour slots (18:00 to 01:30)');

select * from finish();
rollback;
