-- Inventory's stock value and the books' 1200 Stock stay equal (owner's app check A3, 9 Nov 2026). The case found: one
-- glove used before any stock was entered went out at a cost of 0; when 50 came in at 0.50 the books took all 50 while
-- 49 were left, so the books were 0.50 high. Now stock coming in costs again what was used below zero, a reversed bill
-- works the average out again, stock below zero is valued below zero, and the owner or accountant can fix an old gap.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(17);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000065' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'stock-value-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'c1', 'd1']) n;

create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000065' || p)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end $$;

select pg_temp.as_user('a0');
select set_config('t.b', (create_business('{"business_name":"Stock Value Salon","owner_name":"Owner","mode":"ladies",
  "vat_mode":"off","opening_cash_minor":100000}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-0000000065c1', 'username', 'stvcash', 'display_name', 'Cashier', 'role', 'cashier'));
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-0000000065d1', 'username', 'stvacct', 'display_name', 'Accountant', 'role', 'accountant'));
select pg_temp.as_user('a0');
select set_config('t.item', save_item(jsonb_build_object('business_id', current_setting('t.b'), 'name', 'Test gloves',
  'kind', 'retail', 'unit', 'pcs', 'sell_price_minor', 100))::text, false);
select set_config('t.sup', save_supplier(jsonb_build_object('business_id', current_setting('t.b'), 'name', 'Glove Trading'))::text, false);

create function pg_temp.sell(p_qty int) returns void language sql as $$
  select create_sale(jsonb_build_object('branch_id', current_setting('t.br'),
    'lines', jsonb_build_array(jsonb_build_object('kind', 'retail', 'item_id', current_setting('t.item'), 'qty', p_qty)),
    'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_minor', 100 * p_qty))));
$$;
create function pg_temp.buy(p_qty int, p_cost int) returns uuid language sql as $$
  select (post_purchase_bill(jsonb_build_object('branch_id', current_setting('t.br'), 'supplier_id', current_setting('t.sup'),
    'lines', jsonb_build_array(jsonb_build_object('item_id', current_setting('t.item'), 'packs', p_qty,
                                                  'unit_price_minor', p_cost, 'vat_minor', 0)))) ->> 'bill_id')::uuid
$$;
create function pg_temp.check() returns jsonb language sql as $$ select stock_books_check(current_setting('t.b')::uuid) $$;
create function pg_temp.diff() returns bigint language sql as $$ select (pg_temp.check() ->> 'difference_minor')::bigint $$;
create function pg_temp.value() returns bigint language sql as $$
  select value_minor from inventory_levels(current_setting('t.br')::uuid) where item_id = current_setting('t.item')::uuid
$$;

-- 1–3. One glove used with nothing in stock, then 50 counted in at 0.50: books and stock both 49 × 0.50.
select pg_temp.sell(1);
select lives_ok(format($$ select set_opening_stock('%s', '[{"item_id":"%s","qty":50,"unit_cost_minor":50}]') $$,
  current_setting('t.br'), current_setting('t.item')), 'opening stock counted after one was used');
select is((pg_temp.check() ->> 'books_minor')::bigint, 2450::bigint, 'the books hold 49 gloves at 0.50, not 50');
select is(pg_temp.diff(), 0::bigint, 'books and stock agree');

-- 4–5. A bill of 100 at 0.40, then the bill reversed: the average goes back to 0.50 and the two still agree.
select set_config('t.bill', pg_temp.buy(100, 40)::text, false);
select is(pg_temp.diff(), 0::bigint, 'after a supplier bill they agree');
select reverse_purchase_bill(current_setting('t.bill')::uuid, 'Wrong supplier');
select results_eq(format($$ select round(avg_unit_cost_minor, 2), value_minor from inventory_levels(%L) where item_id = %L $$,
  current_setting('t.br'), current_setting('t.item')), $$ values (50.00::numeric, 2450::bigint) $$,
  'after the reversal the average is 0.50 again and 49 are worth 24.50');

-- 6–8. Sold below zero, valued below zero; stock in at a new cost costs those units again.
select pg_temp.sell(60);
select is(pg_temp.value(), -550::bigint, '11 below zero are worth -5.50, as the books carry them');
select is(pg_temp.diff(), 0::bigint, 'and they agree below zero');
select pg_temp.buy(20, 60);
select results_eq(format($$ select qty, value_minor from inventory_levels(%L) where item_id = %L $$,
  current_setting('t.br'), current_setting('t.item')), $$ values (9::numeric, 540::bigint) $$,
  '20 in at 0.60: 9 left, worth 5.40');
select is(pg_temp.diff(), 0::bigint, 'the 11 used below zero were costed again at 0.60: they agree');

-- 9–13. An old gap (here made by hand): shown, and fixed with one "Stock difference" entry by the accountant.
reset role;
update stock_levels set qty = qty - 1 where item_id = current_setting('t.item')::uuid;
select pg_temp.as_user('a0');
select is(pg_temp.diff(), 60::bigint, 'an old gap shows: the books are 0.60 above the stock');
select pg_temp.as_user('d1');
select is(fix_stock_difference(current_setting('t.b')::uuid), 60::bigint, 'the accountant fixes it');
select is(pg_temp.diff(), 0::bigint, 'now they agree');
select is((select count(*)::int from journal_entries where business_id = current_setting('t.b')::uuid
           and source_type = 'stock_difference'), 1, 'with one "Stock difference" entry');
select is(fix_stock_difference(current_setting('t.b')::uuid), 0::bigint, 'fixing again adds nothing');

-- 14–16. A cashier can do neither; the history says who fixed it.
select pg_temp.as_user('c1');
select throws_ok($$ select pg_temp.check() $$, '42501', null, 'a cashier cannot see the check');
select throws_ok(format($$ select fix_stock_difference(%L) $$, current_setting('t.b')), '42501', null, 'nor fix it');
reset role;
select matches((select summary from audit_log where business_id = current_setting('t.b')::uuid
                and entity_type = 'stock_difference'),
  '^Fixed the stock difference: [A-Z]{3} 0\.60$', 'the history says what was fixed');

select * from finish();
rollback;
