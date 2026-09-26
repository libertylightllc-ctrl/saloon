-- Money out: expenses (tea & food, electricity, water, internet, uniforms, dry cleaning…),
-- suppliers, purchase bills, supplier payments — roles, books, cash and stock.
begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000010a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'mo-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000010c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'mo-cashier@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000010d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'mo-staff@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

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
create function pg_temp.cat(p_key text) returns text language sql as $$
  select id::text from expense_categories where business_id = current_setting('t.b')::uuid and key = p_key
$$;
create function pg_temp.account_balance(p_key text) returns bigint language sql as $$
  select coalesce(sum(l.debit_minor - l.credit_minor), 0)::bigint from journal_lines l
  join accounts a on a.id = l.account_id where a.business_id = current_setting('t.b')::uuid and a.system_key = p_key
$$;

-- ── Setup: an owner with 100.00 opening cash, a cashier and a staff member ────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000010a');
select set_config('t.b', (create_business('{"business_name":"Money Out Salon","owner_name":"Owner","mode":"gents",
  "vat_mode":"off","opening_cash_minor":10000}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-00000000010c', 'username', 'mocash', 'display_name', 'Cashier', 'role', 'cashier'));
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-00000000010d', 'username', 'mostaff', 'display_name', 'Staff', 'role', 'staff'));

-- ── Expense categories ─────────────────────────────────────────────────────────────────────
select pg_temp.as_admin();
select is((select count(*)::int from expense_categories where business_id = current_setting('t.b')::uuid), 16,
  'setup seeds 16 expense categories');
select set_eq(format('select key from expense_categories where business_id = %L', current_setting('t.b')),
  array['tea_food','electricity','water','internet_phone','rent','uniforms','dry_cleaning','cleaning','repairs',
        'transport','marketing','licences','bank_fees','staff_accommodation','staff_welfare','other'],
  'categories include tea & food, electricity, water, internet, rent, uniforms, dry cleaning');
select is((select count(*)::int from expense_categories e join accounts a on a.id = e.account_id
           where e.business_id = current_setting('t.b')::uuid and a.type = 'expense' and a.system_key like 'exp\_%'), 16,
  'each category has its own expense account');

-- ── Owner records expenses ─────────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000010a');
select lives_ok(format($$ select record_expense('{"branch_id":"%s","category_id":"%s","amount_minor":1500,
  "method":"cash","note":"Tea and biscuits","client_ref":"exp-1"}') $$, current_setting('t.br'), pg_temp.cat('tea_food')),
  'owner records a cash tea & food expense');
select is(expected_cash(current_setting('t.br')::uuid), 8500::bigint, 'a cash expense lowers expected cash');
select is((select amount_minor from cash_breakdown(current_setting('t.br')::uuid) where kind = 'expense'), -1500::bigint,
  'the cash calculation shows the expense');
select is((record_expense(format('{"branch_id":"%s","category_id":"%s","amount_minor":1500,"method":"cash","client_ref":"exp-1"}',
  current_setting('t.br'), pg_temp.cat('tea_food'))::jsonb) ->> 'repeated')::boolean, true,
  'the same expense sent twice is recorded once');
select lives_ok(format($$ select record_expense('{"branch_id":"%s","category_id":"%s","amount_minor":45000,
  "method":"bank","note":"DEWA bill"}') $$, current_setting('t.br'), pg_temp.cat('electricity')),
  'owner records the electricity bill paid from the bank');
select is(expected_cash(current_setting('t.br')::uuid), 8500::bigint, 'a bank payment does not touch the drawer');
select is(pg_temp.account_balance('exp_electricity'), 45000::bigint, 'electricity account shows the bill');
select is(pg_temp.account_balance('bank'), -45000::bigint, 'bank is credited');
select lives_ok(format($$ select record_expense('{"branch_id":"%s","category_id":"%s","amount_minor":29900,"method":"card"}'),
  record_expense('{"branch_id":"%s","category_id":"%s","amount_minor":8000,"method":"bank"}'),
  record_expense('{"branch_id":"%s","category_id":"%s","amount_minor":60000,"method":"card"}'),
  record_expense('{"branch_id":"%s","category_id":"%s","amount_minor":3500,"method":"cash"}') $$,
  current_setting('t.br'), pg_temp.cat('internet_phone'), current_setting('t.br'), pg_temp.cat('water'),
  current_setting('t.br'), pg_temp.cat('uniforms'), current_setting('t.br'), pg_temp.cat('dry_cleaning')),
  'internet, water, uniforms and dry cleaning are recorded');
select throws_ok(format($$ select record_expense('{"branch_id":"%s","category_id":"%s","amount_minor":100,"method":"wallet"}') $$,
  current_setting('t.br'), pg_temp.cat('other')), '22023', null, 'wallet is not a way to pay an expense');
select throws_ok(format($$ select record_expense('{"branch_id":"%s","category_id":"%s","amount_minor":0,"method":"cash"}') $$,
  current_setting('t.br'), pg_temp.cat('other')), '22023', null, 'amount must be above zero');
select throws_ok(format($$ select record_expense('{"branch_id":"%s","category_id":"%s","amount_minor":100,"method":"cash",
  "business_date":"%s"}') $$, current_setting('t.br'), pg_temp.cat('other'), branch_today(current_setting('t.br')::uuid) + 1),
  '22023', null, 'no expenses dated in the future');

-- ── Cashier: cash expenses today only; no reversals ───────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000010c');
select lives_ok(format($$ select record_expense('{"branch_id":"%s","category_id":"%s","amount_minor":700,"method":"cash"}') $$,
  current_setting('t.br'), pg_temp.cat('tea_food')), 'cashier records a cash expense');
select throws_ok(format($$ select record_expense('{"branch_id":"%s","category_id":"%s","amount_minor":700,"method":"card"}') $$,
  current_setting('t.br'), pg_temp.cat('tea_food')), '42501', null, 'cashier cannot record a card expense');
select throws_ok(format($$ select record_expense('{"branch_id":"%s","category_id":"%s","amount_minor":700,"method":"cash",
  "business_date":"%s"}') $$, current_setting('t.br'), pg_temp.cat('tea_food'), branch_today(current_setting('t.br')::uuid) - 1),
  '42501', null, 'cashier cannot backdate an expense');
select is((select count(*)::int from expenses), 1, 'cashier sees only the expenses they recorded');
select throws_ok(format('select reverse_expense(%L, %L)', (select id from expenses limit 1), 'Wrong amount'),
  '42501', null, 'cashier cannot reverse an expense');
select pg_temp.as_user('00000000-0000-0000-0000-00000000010d');
select is((select count(*)::int from expenses), 0, 'staff cannot see expenses');

-- ── Owner reverses with a reason ───────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000010a');
select set_config('t.tea', (select id::text from expenses where client_ref = 'exp-1'), false);
select throws_ok(format('select reverse_expense(%L, %L)', current_setting('t.tea'), ''), '22023', null, 'a reason is required');
select lives_ok(format('select reverse_expense(%L, %L)', current_setting('t.tea'), 'Recorded twice'), 'owner reverses an expense');
select is((select status from expenses where id = current_setting('t.tea')::uuid), 'reversed', 'the expense stays, marked reversed');
select is(expected_cash(current_setting('t.br')::uuid), 10000 - 3500 - 700::bigint, 'reversing puts the cash back');
select throws_ok(format('select reverse_expense(%L, %L)', current_setting('t.tea'), 'Again'), '22023', null,
  'an expense cannot be reversed twice');

-- ── Owner's own category ───────────────────────────────────────────────────────────────────
select set_config('t.pest', save_expense_category(jsonb_build_object('business_id', current_setting('t.b'),
  'name', 'Pest Control'))::text, false);
select is((select a.code from expense_categories e join accounts a on a.id = e.account_id
           where e.id = current_setting('t.pest')::uuid), '6160', 'a new category gets the next expense account');
select throws_ok(format($$ select save_expense_category('{"business_id":"%s","name":"electricity"}') $$, current_setting('t.b')),
  '23505', null, 'category names are unique');

-- ── Suppliers and bills ────────────────────────────────────────────────────────────────────
select set_config('t.sup', save_supplier(jsonb_build_object('business_id', current_setting('t.b'),
  'name', 'Gulf Barber Wholesale', 'phone', '+971 4 123 4567', 'terms_days', 30))::text, false);
select throws_ok(format($$ select save_supplier('{"business_id":"%s","name":"gulf barber wholesale"}') $$, current_setting('t.b')),
  '23505', null, 'supplier names are unique');
select set_config('t.item', (select id::text from inventory_items where business_id = current_setting('t.b')::uuid
  and name = 'Blades'), false);
select set_config('t.bill', (post_purchase_bill(jsonb_build_object('branch_id', current_setting('t.br'),
  'supplier_id', current_setting('t.sup'), 'invoice_ref', 'INV-881',
  'lines', jsonb_build_array(
     jsonb_build_object('item_id', current_setting('t.item'), 'qty', 50, 'unit_cost_minor', 30),
     jsonb_build_object('description', 'Delivery', 'qty', 1, 'unit_cost_minor', 1000)))) ->> 'bill_id'), false);
select is((select total_minor from purchase_bills where id = current_setting('t.bill')::uuid), 2500::bigint,
  'bill total = 50 × 0.30 + 10.00 delivery');
select is((select due_date - bill_date from purchase_bills where id = current_setting('t.bill')::uuid), 30,
  'due date follows the supplier''s payment terms');
select is((select qty from stock_levels where item_id = current_setting('t.item')::uuid), 50::numeric,
  'the stock line adds 50 blades to stock');
select is(pg_temp.account_balance('supplier_payable'), -2500::bigint, 'the supplier is owed the full bill');

-- Payments: owner only, never more than is owed
select pg_temp.as_user('00000000-0000-0000-0000-00000000010c');
select throws_ok(format($$ select pay_supplier('{"branch_id":"%s","supplier_id":"%s","bill_id":"%s","method":"cash",
  "amount_minor":1000}') $$, current_setting('t.br'), current_setting('t.sup'), current_setting('t.bill')),
  '42501', null, 'cashier cannot pay a supplier');
select pg_temp.as_user('00000000-0000-0000-0000-00000000010a');
select lives_ok(format($$ select pay_supplier('{"branch_id":"%s","supplier_id":"%s","bill_id":"%s","method":"cash",
  "amount_minor":1000}') $$, current_setting('t.br'), current_setting('t.sup'), current_setting('t.bill')),
  'owner pays 10.00 cash against the bill');
select is((select status || ' ' || paid_minor from purchase_bills where id = current_setting('t.bill')::uuid), 'partial 1000',
  'the bill is part paid');
select throws_ok(format($$ select pay_supplier('{"branch_id":"%s","supplier_id":"%s","bill_id":"%s","method":"bank",
  "amount_minor":1501}') $$, current_setting('t.br'), current_setting('t.sup'), current_setting('t.bill')),
  '22023', null, 'cannot pay more than is left on the bill');
select is((select balance_minor from supplier_balances(current_setting('t.b')::uuid)), 1500::bigint,
  'supplier balance = bill − payment');
select throws_ok(format('select reverse_purchase_bill(%L, %L)', current_setting('t.bill'), 'Wrong supplier'), '22023', null,
  'a bill with payments cannot be reversed');
select is(expected_cash(current_setting('t.br')::uuid), 10000 - 3500 - 700 - 1000::bigint,
  'a cash supplier payment lowers expected cash');
-- Cashier adds a bill (no payment); owner reverses it: stock goes back out, nothing is owed for it.
select pg_temp.as_user('00000000-0000-0000-0000-00000000010c');
select throws_ok(format($$ select post_purchase_bill('{"branch_id":"%s","supplier_id":"%s","lines":[{"description":"Towels",
  "qty":2,"unit_cost_minor":500}],"paid_now":{"method":"cash","amount_minor":1000}}') $$,
  current_setting('t.br'), current_setting('t.sup')), '42501', null, 'cashier cannot pay while adding a bill');
select set_config('t.bill2', (post_purchase_bill(jsonb_build_object('branch_id', current_setting('t.br'),
  'supplier_id', current_setting('t.sup'),
  'lines', jsonb_build_array(jsonb_build_object('item_id', current_setting('t.item'), 'qty', 20, 'unit_cost_minor', 40))))
  ->> 'bill_id'), false);
select pg_temp.as_user('00000000-0000-0000-0000-00000000010a');
select lives_ok(format('select reverse_purchase_bill(%L, %L)', current_setting('t.bill2'), 'Goods returned'),
  'owner reverses an unpaid bill with a reason');
select is((select qty from stock_levels where item_id = current_setting('t.item')::uuid), 50::numeric,
  'the reversed bill''s stock goes back out');
select is((select balance_minor from supplier_balances(current_setting('t.b')::uuid)), 1500::bigint,
  'a reversed bill is not owed');
select ok(pg_temp.balanced(), 'every journal entry balances');

select * from finish();
rollback;
