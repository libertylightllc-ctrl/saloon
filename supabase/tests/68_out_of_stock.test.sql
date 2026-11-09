-- Out-of-stock items are counted (owner's app check A6, 9 Nov 2026): "Low stock 0" showed while 10 of 12 items were at
-- 0. Inventory flags every item at 0 or below; Home, the morning summary and the Reports check count an out-of-stock
-- item only once it had stock at the branch; reaching 0 sends "Out of stock"; tools are never stock.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(16);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000068a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'out-of-stock@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

create function pg_temp.as_owner() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000068a0',
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end $$;

select pg_temp.as_owner();
-- A ladies salon starts with its starter items at 0, never stocked.
select set_config('t.b', (create_business('{"business_name":"Out Of Stock Salon","owner_name":"Owner","mode":"ladies",
  "vat_mode":"off","opening_cash_minor":100000}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
create function pg_temp.item(p_name text, p_kind text, p_reorder int) returns uuid language sql as $$
  select save_item(jsonb_build_object('business_id', current_setting('t.b'), 'name', p_name, 'kind', p_kind, 'unit', 'pcs',
    'sell_price_minor', 100, 'reorder_level', p_reorder))
$$;
create function pg_temp.stock(p_item uuid, p_qty int) returns void language sql as $$
  select set_opening_stock(current_setting('t.br')::uuid, jsonb_build_array(jsonb_build_object('item_id', p_item,
    'qty', p_qty, 'unit_cost_minor', 50)))
$$;
create function pg_temp.sell(p_item uuid, p_qty int) returns void language sql as $$
  select create_sale(jsonb_build_object('branch_id', current_setting('t.br'),
    'lines', jsonb_build_array(jsonb_build_object('kind', 'retail', 'item_id', p_item, 'qty', p_qty)),
    'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_minor', 100 * p_qty))));
$$;
create function pg_temp.home(k text) returns jsonb language sql as $$
  select dashboard_today(current_setting('t.br')::uuid) -> 'stock' -> k
$$;
create function pg_temp.flagged(p_name text) returns boolean language sql as $$
  select low from inventory_levels(current_setting('t.br')::uuid) where name = p_name
$$;
create function pg_temp.alerts(p_out boolean) returns int language sql as $$
  select count(*)::int from notifications n join members m on m.id = n.member_id
  where m.user_id = '00000000-0000-0000-0000-0000000068a0' and n.type = 'low_stock'
    and coalesce((n.data ->> 'out')::boolean, false) = p_out
$$;

-- 1–2. Never stocked: Inventory flags them all, Home counts none.
select ok((select count(*) > 0 and bool_and(low) from inventory_levels(current_setting('t.br')::uuid)
           where active and kind <> 'tool' and qty <= 0), 'Inventory flags every item at 0, reorder level or not');
select is((pg_temp.home('out'))::int, 0, 'Home does not count items that were never stocked');

-- 3–6. An item with no reorder level runs out: Home counts it, and the owner hears once.
select set_config('t.thread', pg_temp.item('Test thread', 'retail', 0)::text, false);
select pg_temp.stock(current_setting('t.thread')::uuid, 2);
select is(pg_temp.flagged('Test thread'), false, 'with 2 in stock it is fine');
select pg_temp.sell(current_setting('t.thread')::uuid, 2);
select is((pg_temp.home('out'))::int, 1, 'at 0 after having stock: out of stock on Home');
select is(pg_temp.home('out_items') ->> 0, 'Test thread', 'Home names it');
select pg_temp.as_service();
select is(pg_temp.alerts(true), 1, 'reaching 0 sends "Out of stock"');
select pg_temp.as_owner();

-- 7–8. Sold below zero: still out of stock, no second alert.
select pg_temp.sell(current_setting('t.thread')::uuid, 1);
select ok(pg_temp.flagged('Test thread') and (select qty from inventory_levels(current_setting('t.br')::uuid)
          where name = 'Test thread') = -1, 'below zero is still flagged (a stock count is needed)');
select pg_temp.as_service();
select is(pg_temp.alerts(true), 1, 'going from 0 to -1 sends nothing new');
select pg_temp.as_owner();

-- 9–11. Low is above 0 and at or below the reorder level, counted apart from out of stock.
select set_config('t.oil', pg_temp.item('Test oil', 'retail', 3)::text, false);
select pg_temp.stock(current_setting('t.oil')::uuid, 5);
select pg_temp.sell(current_setting('t.oil')::uuid, 3);
select is((pg_temp.home('low'))::int, 1, 'at 2 of reorder 3: low');
select is((pg_temp.home('out'))::int, 1, 'and out of stock stays 1');
select pg_temp.as_service();
select is(pg_temp.alerts(false), 1, 'crossing the reorder level sends "Low on stock"');
select pg_temp.as_owner();

-- 12. Tools are never stock.
select set_config('t.dryer', pg_temp.item('Test dryer', 'tool', 0)::text, false);
select is(pg_temp.flagged('Test dryer'), false, 'a tool at 0 is not out of stock');

-- 13. The Reports check counts what Home counts.
select is((owner_control(current_setting('t.br')::uuid) ->> 'low_items')::int, 2, 'Reports: one low, one out of stock');

-- 14–16. The morning summary says both.
select pg_temp.as_service();
select send_daily_digests(((branch_today(current_setting('t.br')::uuid) + 1) + time '08:05')
                          at time zone (select timezone from businesses where id = current_setting('t.b')::uuid));
select is((select (data ->> 'out_of_stock')::int from notifications where type = 'daily_digest'
             and business_id = current_setting('t.b')::uuid), 1, 'the morning summary counts 1 out of stock');
select is((select (data ->> 'low_stock')::int from notifications where type = 'daily_digest'
             and business_id = current_setting('t.b')::uuid), 1, 'and 1 low');
select ok((select body like '%Out of stock: 1 · Low stock: 1' from notifications where type = 'daily_digest'
             and business_id = current_setting('t.b')::uuid), 'the push text says so');

select * from finish();
rollback;
