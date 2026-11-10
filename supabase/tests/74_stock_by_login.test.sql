-- Part B, step 6 (owner's app check, 10 Nov 2026; brief B2 "Stock and suppliers", owner's answer 2 A): each of the
-- five login types tried on stock, stock counts, deliveries (received by the front desk, priced into a supplier bill by
-- others), supplier bills and payments, suppliers and expenses.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(56);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000074' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'stock-roles-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(),
       '{}', '{}'
from unnest(array['a0', 'b1', 'b2', 'b3', 'b4']) n;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000074' || p)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.upload() returns text language sql as $$
  insert into storage.objects (bucket_id, name, owner, metadata)
  values ('receipts', current_setting('t.b') || '/deliveries/' || gen_random_uuid() || '.jpg', auth.uid(),
          '{"mimetype":"image/jpeg","size":1200}')
  returning name
$$;
create function pg_temp.level(p_item text) returns numeric language sql as $$
  select coalesce((select qty from stock_levels where item_id = current_setting(p_item)::uuid
                   and branch_id = current_setting('t.br')::uuid), 0)
$$;
create function pg_temp.receive(p_extra jsonb default '{}') returns jsonb language sql as $$
  select receive_delivery(jsonb_build_object('branch_id', current_setting('t.br'), 'supplier_id', current_setting('t.sup'),
    'lines', jsonb_build_array(jsonb_build_object('item_id', current_setting('t.wax'), 'packs', 2, 'pack_size', 12),
                               jsonb_build_object('item_id', current_setting('t.oil'), 'packs', 5))) || p_extra)
$$;
create function pg_temp.expense(p_branch text, p_amount bigint) returns jsonb language sql as $$
  select record_expense(jsonb_build_object('branch_id', current_setting(p_branch), 'amount_minor', p_amount,
    'method', 'bank', 'category_id', (select id from expense_categories
                                      where business_id = current_setting('t.b')::uuid and key = 'electricity')))
$$;

select pg_temp.as_user('a0');
select set_config('t.b', (create_business('{"business_name":"Stock Roles Salon","owner_name":"Owner","mode":"gents",
  "vat_mode":"off","opening_cash_minor":10000}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select set_config('t.wax', save_item(jsonb_build_object('business_id', current_setting('t.b'), 'name', 'Hair Wax',
  'kind', 'retail', 'unit', 'pcs', 'reorder_level', 3, 'sell_price_minor', 3500))::text, false);
select set_config('t.oil', save_item(jsonb_build_object('business_id', current_setting('t.b'), 'name', 'Argan Oil',
  'kind', 'retail', 'unit', 'pcs', 'reorder_level', 2, 'sell_price_minor', 9000))::text, false);
select set_config('t.sup', save_supplier(jsonb_build_object('business_id', current_setting('t.b'),
  'name', 'Gulf Barber Wholesale', 'terms_days', 30))::text, false);

-- Manager Mona (b1), front desk Dina (b2) and stylist Sami (b3) in the branch; the accountant (b4); a second branch.
select pg_temp.as_admin();
with b as (insert into branches (business_id, name, mode, created_at)
           values (current_setting('t.b')::uuid, 'Second branch', 'gents', clock_timestamp()) returning id)
select set_config('t.br2', id::text, false) from b;
create function pg_temp.member(p_user text, p_role text, p_name text) returns void language plpgsql as $$
declare v uuid;
begin
  insert into members (business_id, user_id, role, display_name, username)
  values (current_setting('t.b')::uuid, ('00000000-0000-0000-0000-0000000074' || p_user)::uuid, p_role::member_role,
          p_name, lower(p_name) || 'seventyfour') returning id into v;
  perform set_config('t.m' || p_user, v::text, false);
  if p_role <> 'accountant' then
    insert into member_branches (member_id, branch_id) values (v, current_setting('t.br')::uuid);
  end if;
end $$;
select pg_temp.member('b1', 'manager', 'Mona'), pg_temp.member('b2', 'cashier', 'Dina'),
       pg_temp.member('b3', 'staff', 'Sami'), pg_temp.member('b4', 'accountant', 'Books');

-- 1. Seeing stock: everyone; stylists without what it cost.
select pg_temp.as_user('b1');
select is((select count(*)::int from inventory_levels(current_setting('t.br')::uuid)
           where item_id in (current_setting('t.wax')::uuid, current_setting('t.oil')::uuid) and avg_unit_cost_minor is not null),
  2, 'a manager sees the stock, with costs');
select pg_temp.as_user('b3');
select is((select count(*)::int from inventory_levels(current_setting('t.br')::uuid) where avg_unit_cost_minor is not null),
  0, 'a stylist sees it without costs');

-- 2. Counting and adjusting: owner and manager, with a reason.
select pg_temp.as_user('b1');
select throws_ok(format($$ select adjust_stock('{"branch_id":"%s","item_id":"%s","qty_delta":5}') $$,
  current_setting('t.br'), current_setting('t.wax')), '22023', 'reason_required', 'an adjustment needs a reason');
select lives_ok(format($$ select adjust_stock('{"branch_id":"%s","item_id":"%s","qty_delta":5,"reason":"Found a box"}') $$,
  current_setting('t.br'), current_setting('t.wax')), 'a manager adjusts stock with a reason');
select lives_ok(format($$ select record_stock_count('{"branch_id":"%s","counts":[{"item_id":"%s","counted_qty":4}]}') $$,
  current_setting('t.br'), current_setting('t.wax')), 'and counts it');
select pg_temp.as_user('b2');
select throws_ok(format($$ select adjust_stock('{"branch_id":"%s","item_id":"%s","qty_delta":1,"reason":"Extra"}') $$,
  current_setting('t.br'), current_setting('t.wax')), '42501', null, 'the front desk does not adjust stock');
select throws_ok(format($$ select record_stock_count('{"branch_id":"%s","counts":[{"item_id":"%s","counted_qty":1}]}') $$,
  current_setting('t.br'), current_setting('t.wax')), '42501', null, 'nor count it');
select pg_temp.as_user('b4');
select throws_ok(format($$ select adjust_stock('{"branch_id":"%s","item_id":"%s","qty_delta":1,"reason":"Extra"}') $$,
  current_setting('t.br'), current_setting('t.wax')), '42501', null, 'nor does the accountant');
select pg_temp.as_user('b3');
select throws_ok(format($$ select adjust_stock('{"branch_id":"%s","item_id":"%s","qty_delta":1,"reason":"Extra"}') $$,
  current_setting('t.br'), current_setting('t.wax')), '42501', null, 'nor a stylist');

-- 3. A delivery: the front desk records what arrived; stock waits for the prices.
select throws_ok($$ select pg_temp.receive() $$, '42501', null, 'a stylist does not receive deliveries');
select pg_temp.as_user('b4');
select throws_ok($$ select pg_temp.receive() $$, '42501', null, 'nor does the accountant');
select pg_temp.as_user('b2');
select throws_ok($$ select pg_temp.receive() $$, '22023', 'receipt_required', 'the front desk adds a photo of the note');
select set_config('t.photo', pg_temp.upload(), false);
select set_config('t.d1', (pg_temp.receive(jsonb_build_object('note_path', current_setting('t.photo'), 'client_ref', 'del-1'))
  ->> 'delivery_id'), false);
select is((pg_temp.receive(jsonb_build_object('note_path', current_setting('t.photo'), 'client_ref', 'del-1'))
  ->> 'delivery_id'), current_setting('t.d1'), 'sending it twice records it once');
select is(pg_temp.level('t.wax'), 4::numeric, 'nothing goes into stock before it is priced');
select is((select status from deliveries where id = current_setting('t.d1')::uuid), 'waiting', 'it waits for prices');
select is((select count(*)::int from delivery_lines), 2, 'the front desk sees what they recorded');
select throws_ok(format($$ select price_delivery('{"delivery_id":"%s"}') $$, current_setting('t.d1')), '42501', null,
  'but does not price it');
select pg_temp.as_user('b3');
select is((select count(*)::int from deliveries), 0, 'a stylist sees no deliveries');

-- Priced by the accountant: it becomes the supplier bill and the stock goes up.
select pg_temp.as_user('b4');
select set_config('t.l_wax', (select id::text from delivery_lines where item_id = current_setting('t.wax')::uuid), false);
select set_config('t.l_oil', (select id::text from delivery_lines where item_id = current_setting('t.oil')::uuid), false);
select throws_ok(format($$ select price_delivery('{"delivery_id":"%s","lines":[{"line_id":"%s","unit_price_minor":6000}]}') $$,
  current_setting('t.d1'), current_setting('t.l_wax')), '22023', 'price_required', 'every line needs a price');
select set_config('t.bill1', (price_delivery(jsonb_build_object('delivery_id', current_setting('t.d1'), 'invoice_ref', 'INV-77',
  'lines', jsonb_build_array(jsonb_build_object('line_id', current_setting('t.l_wax'), 'unit_price_minor', 6000),
                             jsonb_build_object('line_id', current_setting('t.l_oil'), 'unit_price_minor', 4000))))
  ->> 'bill_id'), false);
select is((select total_minor from purchase_bills where id = current_setting('t.bill1')::uuid), 32000::bigint,
  'the bill is 2 boxes × 60.00 + 5 × 40.00');
select is(pg_temp.level('t.wax'), 28::numeric, 'and the wax goes up by 2 boxes of 12');
select is(pg_temp.level('t.oil'), 5::numeric, 'and the oil by 5');
select is((select status || ' ' || (bill_id::text = current_setting('t.bill1')) from deliveries
           where id = current_setting('t.d1')::uuid), 'priced true', 'the delivery points at its bill');
select is((select receipt_path from purchase_bills where id = current_setting('t.bill1')::uuid), current_setting('t.photo'),
  'the bill keeps the photo of the delivery note');
select throws_ok(format($$ select price_delivery('{"delivery_id":"%s","lines":[]}') $$, current_setting('t.d1')),
  '22023', 'invalid_status', 'a delivery is priced once');

-- Cancelling a waiting delivery: whoever recorded it, or someone who prices; always with a reason.
select pg_temp.as_user('b2');
select set_config('t.d2', (pg_temp.receive(jsonb_build_object('note_path', pg_temp.upload(), 'supplier_id', null,
  'supplier_name', 'Van at the door')) ->> 'delivery_id'), false);
select throws_ok(format($$ select cancel_delivery('%s', '') $$, current_setting('t.d2')), '22023', 'reason_required',
  'cancelling needs a reason');
select lives_ok(format($$ select cancel_delivery('%s', 'Wrong salon, sent back') $$, current_setting('t.d2')),
  'the front desk cancels their own delivery');
select pg_temp.as_user('a0');
select set_config('t.d3', (pg_temp.receive() ->> 'delivery_id'), false);
select pg_temp.as_user('b2');
select throws_ok(format($$ select cancel_delivery('%s', 'Not mine') $$, current_setting('t.d3')), '42501', null,
  'but not one the owner recorded');
select pg_temp.as_user('b1');
select lives_ok(format($$ select cancel_delivery('%s', 'Entered twice') $$, current_setting('t.d3')),
  'a manager can');
select pg_temp.as_user('a0');
select set_config('t.d4', (pg_temp.receive() ->> 'delivery_id'), false);
select pg_temp.as_user('b4');
select lives_ok(format($$ select cancel_delivery('%s', 'Supplier sent it back') $$, current_setting('t.d4')),
  'so can the accountant, who prices deliveries');
select pg_temp.as_user('b1');
select throws_ok(format($$ select cancel_delivery('%s', 'Too late') $$, current_setting('t.d1')), '22023', 'invalid_status',
  'a priced delivery is not cancelled (its bill is reversed instead)');

-- 4. Supplier bills and payments.
select pg_temp.as_user('b2');
select throws_ok(format($$ select post_purchase_bill('{"branch_id":"%s","supplier_id":"%s","lines":[{"description":"Towels",
  "qty":2,"unit_cost_minor":500}]}') $$, current_setting('t.br'), current_setting('t.sup')), '42501', null,
  'the front desk records no bills');
select throws_ok(format($$ select pay_supplier('{"branch_id":"%s","supplier_id":"%s","method":"cash","amount_minor":100}') $$,
  current_setting('t.br'), current_setting('t.sup')), '42501', null, 'nor pays suppliers');
select pg_temp.as_user('b1');
select set_config('t.bill2', (post_purchase_bill(jsonb_build_object('branch_id', current_setting('t.br'),
  'supplier_id', current_setting('t.sup'), 'lines', '[{"description":"Towels","qty":2,"unit_cost_minor":500}]'::jsonb))
  ->> 'bill_id'), false);
select ok(current_setting('t.bill2') <> '', 'a manager records a bill');
select throws_ok(format($$ select post_purchase_bill('{"branch_id":"%s","supplier_id":"%s","lines":[{"description":"Towels",
  "qty":2,"unit_cost_minor":500}],"paid_now":{"method":"bank","amount_minor":1000}}') $$, current_setting('t.br'),
  current_setting('t.sup')), '42501', null, 'but does not pay it on the spot');
select throws_ok(format($$ select pay_supplier('{"branch_id":"%s","supplier_id":"%s","bill_id":"%s","method":"bank","amount_minor":1000}') $$,
  current_setting('t.br'), current_setting('t.sup'), current_setting('t.bill2')), '42501', null, 'nor later');
select lives_ok(format($$ select attach_receipt('bill', '%s', '%s') $$, current_setting('t.bill2'), pg_temp.upload()),
  'a manager adds the bill''s photo');
select pg_temp.as_user('b4');
select throws_ok(format($$ select pay_supplier('{"branch_id":"%s","supplier_id":"%s","bill_id":"%s","method":"cash","amount_minor":1000}') $$,
  current_setting('t.br'), current_setting('t.sup'), current_setting('t.bill2')), '42501', 'not_allowed',
  'the accountant does not pay from the drawer');
select lives_ok(format($$ select pay_supplier('{"branch_id":"%s","supplier_id":"%s","bill_id":"%s","method":"bank","amount_minor":1000}') $$,
  current_setting('t.br'), current_setting('t.sup'), current_setting('t.bill2')), 'the accountant pays by bank');

-- 5. Suppliers.
select pg_temp.as_user('b2');
select lives_ok(format($$ select save_supplier('{"business_id":"%s","name":"Corner Beauty Supply"}') $$, current_setting('t.b')),
  'the front desk adds a new supplier when a delivery comes');
select throws_ok(format($$ select save_supplier('{"business_id":"%s","id":"%s","name":"Gulf Barber","terms_days":0}') $$,
  current_setting('t.b'), current_setting('t.sup')), '42501', null, 'but does not change one');
select is((select count(*)::int from suppliers), 2, 'and reads the supplier list');
select throws_ok(format($$ select * from supplier_balances('%s') $$, current_setting('t.b')), '42501', null,
  'not what is owed to them');
select pg_temp.as_user('b1');
select lives_ok(format($$ select save_supplier('{"business_id":"%s","id":"%s","name":"Gulf Barber Wholesale","terms_days":15}') $$,
  current_setting('t.b'), current_setting('t.sup')), 'a manager changes a supplier');
select is((select balance_minor from supplier_balances(current_setting('t.b')::uuid) where supplier_id = current_setting('t.sup')::uuid),
  32000::bigint, 'and sees what is owed (bill 32,000 + 1,000 − 1,000 paid)');
select pg_temp.as_user('b3');
select throws_ok(format($$ select save_supplier('{"business_id":"%s","name":"Nope"}') $$, current_setting('t.b')), '42501', null,
  'a stylist adds no suppliers');
select is((select count(*)::int from suppliers), 0, 'and reads none');

-- 6. Expenses and bills by branch: a manager sees their branch only; the front desk the petty cash they paid.
select pg_temp.as_user('a0');
select pg_temp.expense('t.br2', 20000);
select pg_temp.as_user('b1');
select lives_ok($$ select pg_temp.expense('t.br', 45000) $$, 'a manager records a bank expense');
select is((select count(*)::int from expenses), 1, 'and sees only their branch''s');
select is((select count(*)::int from purchase_bills), 2, 'and their branch''s bills');
select ok((select count(*) from stock_movements) > 0, 'and its stock history');
select pg_temp.as_user('b4');
select is((select count(*)::int from expenses), 2, 'the accountant sees every branch''s expenses');
select pg_temp.as_user('b2');
select is((select count(*)::int from expenses), 0, 'the front desk sees none they did not pay');
select is((select count(*)::int from purchase_bills), 0, 'and no bills');
select pg_temp.as_user('b3');
select is((select count(*)::int from stock_movements), 0, 'a stylist sees no stock history');
select throws_ok($$ select pg_temp.expense('t.br', 100) $$, '42501', null, 'and records no expenses');

select * from finish();
rollback;
