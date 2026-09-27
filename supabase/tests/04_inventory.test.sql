-- Inventory & tools: items, retail sales (product revenue, cost of goods, no commission), costs hidden from
-- staff, adjustments with a reason, stock counts, low stock and tools on Home, restock on a full refund.
begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000030a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'inv-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000030c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'inv-cashier@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000030d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'inv-staff@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

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
create function pg_temp.account_balance(p_key text) returns bigint language sql as $$
  select coalesce(sum(l.debit_minor - l.credit_minor), 0)::bigint from journal_lines l
  join accounts a on a.id = l.account_id where a.business_id = current_setting('t.b')::uuid and a.system_key = p_key
$$;
create function pg_temp.level(p_item text) returns numeric language sql as $$
  select coalesce((select qty from stock_levels where item_id = p_item::uuid and branch_id = current_setting('t.br')::uuid), 0)
$$;

-- ── Setup: VAT on, an owner, a cashier and a stylist ──────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000030a');
select set_config('t.b', (create_business('{"business_name":"Stock Salon","owner_name":"Owner","mode":"ladies",
  "vat_mode":"on","trn":"100234567800003"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-00000000030c', 'username', 'invcash', 'display_name', 'Noor', 'role', 'cashier'));
select set_config('t.emp', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'user_id', '00000000-0000-0000-0000-00000000030d', 'username', 'invstaff',
  'display_name', 'Aisha', 'role', 'staff', 'commission_bps', 1200)) ->> 'employee_id'), false);

-- ── Items ────────────────────────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000030a');
select set_config('t.oil', save_item(jsonb_build_object('business_id', current_setting('t.b'), 'name', 'Argan Hair Oil',
  'kind', 'retail', 'unit', 'pcs', 'reorder_level', 3, 'sell_price_minor', 9450, 'location', 'Reception shelf'))::text, false);
select throws_ok(format($$ select save_item('{"business_id":"%s","name":"argan hair oil","kind":"retail","sell_price_minor":100}') $$,
  current_setting('t.b')), '23505', 'item_exists', 'item names are unique in a business');
select throws_ok(format($$ select save_item('{"business_id":"%s","name":"Hand Cream","kind":"retail"}') $$,
  current_setting('t.b')), '22023', 'price_required', 'a retail item needs a selling price');
select lives_ok(format($$ select save_item('{"business_id":"%s","name":"Hair Dryer","kind":"tool","condition":"needs_service",
  "assigned_to":"Station 2"}') $$, current_setting('t.b')), 'owner adds a tool that needs a service');
select lives_ok(format($$ select set_opening_stock('%s', '[{"item_id":"%s","qty":10,"unit_cost_minor":3000}]') $$,
  current_setting('t.br'), current_setting('t.oil')), 'owner counts 10 bottles in at AED 30.00');
select ok((dashboard_today(current_setting('t.br')::uuid) -> 'setup' ->> 'opening_stock')::boolean,
  'the setup checklist ticks "opening stock counted"');
select ok(not (dashboard_today(current_setting('t.br')::uuid) -> 'setup' ->> 'suppliers')::boolean,
  'no suppliers yet: that step is still open');

select pg_temp.as_user('00000000-0000-0000-0000-00000000030c');
select throws_ok(format($$ select save_item('{"business_id":"%s","name":"Nail File","kind":"consumable"}') $$,
  current_setting('t.b')), '42501', null, 'a cashier cannot add items');

select pg_temp.as_user('00000000-0000-0000-0000-00000000030d');
select is((select qty from inventory_levels(current_setting('t.br')::uuid) where name = 'Argan Hair Oil'), 10::numeric,
  'staff see the level');
select is((select value_minor from inventory_levels(current_setting('t.br')::uuid) where name = 'Argan Hair Oil'), null,
  'staff do not see the value');
select throws_ok($$ select avg_unit_cost_minor from inventory_items $$, '42501', null, 'staff cannot read item costs');
select is((select count(*)::int from inventory_items where name = 'Argan Hair Oil'), 1, 'staff can read the item itself');

select pg_temp.as_user('00000000-0000-0000-0000-00000000030a');
select is((select value_minor from inventory_levels(current_setting('t.br')::uuid) where name = 'Argan Hair Oil'), 30000::bigint,
  'the owner sees the value: 10 × 30.00');

-- ── Retail sale ──────────────────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000030c');
select set_config('t.sale', (create_sale(jsonb_build_object('branch_id', current_setting('t.br'),
  'employee_id', current_setting('t.emp'),
  'lines', jsonb_build_array(jsonb_build_object('kind', 'retail', 'item_id', current_setting('t.oil'), 'qty', 2)),
  'payments', '[{"method":"cash","amount_minor":18900}]'::jsonb)) ->> 'sale_id'), false);
select is(pg_temp.level(current_setting('t.oil')), 8::numeric, 'selling 2 bottles takes them out of stock');
select is((select name_snapshot || ' ' || item_id from sale_lines where sale_id = current_setting('t.sale')::uuid),
  'Argan Hair Oil ' || current_setting('t.oil'), 'the sale line keeps the item');
select is((select commission_minor from sale_lines where sale_id = current_setting('t.sale')::uuid), 0::bigint,
  'no commission on retail');
select pg_temp.as_admin();
select is(pg_temp.account_balance('product_revenue'), -18000::bigint, 'product revenue AED 180.00 ex VAT');
select is(pg_temp.account_balance('service_revenue'), 0::bigint, 'nothing to service revenue');
select is(pg_temp.account_balance('vat_payable'), -900::bigint, 'VAT 5/105 of 189.00');
select is(pg_temp.account_balance('cost_of_goods_sold'), 6000::bigint, 'cost of goods sold 2 × 30.00');
select is((select reason::text from stock_movements where ref_id = current_setting('t.sale')::uuid), 'retail_sale',
  'the movement is a retail sale');
select pg_temp.as_user('00000000-0000-0000-0000-00000000030c');
select throws_ok(format($$ select create_sale('{"branch_id":"%s","lines":[{"kind":"retail","item_id":"%s"}],
  "payments":[{"method":"cash","amount_minor":100}]}') $$, current_setting('t.br'),
  (select id from inventory_items where name = 'Hair Dryer')), '22023', 'item_unavailable', 'tools cannot be sold');

-- ── Refund: items back only on a full refund ─────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000030a');
select throws_ok(format($$ select refund_sale('{"sale_id":"%s","amount_minor":9450,"method":"cash","reason":"Wrong item",
  "restock":true}') $$, current_setting('t.sale')), '22023', 'invalid_restock', 'a part refund cannot restock');
select lives_ok(format($$ select refund_sale('{"sale_id":"%s","amount_minor":18900,"method":"cash","reason":"Unopened, returned",
  "restock":true}') $$, current_setting('t.sale')), 'owner refunds the whole sale and restocks');
select is(pg_temp.level(current_setting('t.oil')), 10::numeric, 'both bottles are back in stock');
select pg_temp.as_admin();
select is(pg_temp.account_balance('cost_of_goods_sold'), 0::bigint, 'cost of goods sold reversed');
select is(pg_temp.account_balance('product_revenue'), 0::bigint, 'product revenue reversed');

-- ── Adjustment ───────────────────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000030a');
select throws_ok(format($$ select adjust_stock('{"branch_id":"%s","item_id":"%s","qty_delta":-1}') $$,
  current_setting('t.br'), current_setting('t.oil')), '22023', 'reason_required', 'an adjustment needs a reason');
select throws_ok(format($$ select adjust_stock('{"branch_id":"%s","item_id":"%s","qty_delta":-11,"reason":"Lost"}') $$,
  current_setting('t.br'), current_setting('t.oil')), '22023', 'invalid_qty', 'stock cannot go below zero');
select is((adjust_stock(jsonb_build_object('branch_id', current_setting('t.br'), 'item_id', current_setting('t.oil'),
  'qty_delta', -1, 'reason', 'Bottle broke', 'client_ref', 'adj-1')) ->> 'value_change_minor')::bigint, -3000::bigint,
  'owner writes off a broken bottle: −30.00');
select is((adjust_stock(jsonb_build_object('branch_id', current_setting('t.br'), 'item_id', current_setting('t.oil'),
  'qty_delta', -1, 'reason', 'Bottle broke', 'client_ref', 'adj-1')) ->> 'repeated')::boolean, true,
  'the same adjustment sent twice counts once');
select is(pg_temp.level(current_setting('t.oil')), 9::numeric, 'the level is 9');
select pg_temp.as_admin();
select is(pg_temp.account_balance('consumables_used'), 3000::bigint, 'the loss is a cost');
select pg_temp.as_user('00000000-0000-0000-0000-00000000030c');
select throws_ok(format($$ select adjust_stock('{"branch_id":"%s","item_id":"%s","qty_delta":1,"reason":"Found one"}') $$,
  current_setting('t.br'), current_setting('t.oil')), '42501', null, 'a cashier cannot adjust stock');

-- ── Stock count, low stock and tools on Home ─────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000030a');
select is((record_stock_count(jsonb_build_object('branch_id', current_setting('t.br'), 'note', 'Month-end count',
  'client_ref', 'count-1', 'counts', jsonb_build_array(jsonb_build_object('item_id', current_setting('t.oil'),
  'counted_qty', 3)))) ->> 'value_change_minor')::bigint, -18000::bigint, 'counting 3 of 9 writes off 6 × 30.00');
select is(pg_temp.level(current_setting('t.oil')), 3::numeric, 'the level is what was counted');
select is((select items_changed from stock_counts where client_ref = 'count-1'), 1, 'the count is recorded');
select is((dashboard_today(current_setting('t.br')::uuid) -> 'stock' ->> 'low')::int, 1,
  'at its reorder level the item shows as low on Home');
select is((dashboard_today(current_setting('t.br')::uuid) -> 'stock' -> 'low_items') ->> 0, 'Argan Hair Oil',
  'Home names it');
select is((dashboard_today(current_setting('t.br')::uuid) -> 'stock' ->> 'tools_due')::int, 1,
  'the dryer that needs a service shows on Home');
select ok((select low from inventory_levels(current_setting('t.br')::uuid) where name = 'Argan Hair Oil'),
  'the inventory list flags it low');

select pg_temp.as_admin();
select is((select sum(qty_delta) from stock_movements where item_id = current_setting('t.oil')::uuid),
  pg_temp.level(current_setting('t.oil')), 'the level equals the sum of its movements');
select is(pg_temp.account_balance('inventory'), 9000::bigint, 'inventory in the books = 3 × 30.00');
select ok(pg_temp.balanced(), 'every journal entry balances');

select * from finish();
rollback;
