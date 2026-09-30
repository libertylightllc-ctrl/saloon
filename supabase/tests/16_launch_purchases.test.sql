-- The purchase entry as on a supplier's invoice (owner, 2026-09-30): products bought in packs, each line packs ×
-- price per pack with its own 5% VAT; VAT recoverable only for a VAT-registered salon, otherwise part of the cost.
-- And account deletion: a person's details go, the salon's records stay; an owner leaving closes the salon.
begin;
create extension if not exists pgtap with schema extensions;
-- Paid plans are tested in 14_plans; here every salon may work.
select set_config('salon.plan_check', 'off', false);
select plan(38);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000016aa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pack-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-0000000016bb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'plain-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-0000000016cc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'plain-staff@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-0000000016dd', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'plain-cashier@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

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
create function pg_temp.balance(p_business uuid, p_key text) returns bigint language sql as $$
  select coalesce(sum(l.debit_minor - l.credit_minor), 0)::bigint
  from journal_lines l join journal_entries e on e.id = l.entry_id join accounts a on a.id = l.account_id
  where e.business_id = p_business and a.system_key = p_key
$$;
create function pg_temp.balanced() returns boolean language sql as $$
  select coalesce(bool_and(d = c), true) from (
    select sum(debit_minor) d, sum(credit_minor) c from journal_lines group by entry_id) x
$$;

-- ── A VAT-registered salon buys in packs ─────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000016aa');
select set_config('t.b', (create_business('{"business_name":"Pack Salon","owner_name":"Owner","mode":"ladies",
  "vat_mode":"on","trn":"100234567800003"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select set_config('t.oil', save_item(jsonb_build_object('business_id', current_setting('t.b'), 'name', 'Argan oil 1 L',
  'kind', 'consumable', 'unit', 'ml', 'pack_size', 1000))::text, false);
select is((select pack_size from inventory_items where id = current_setting('t.oil')::uuid), 1000.000,
  'a 1 L bottle is a pack of 1000 ml');
select throws_ok(format($$ select save_item(jsonb_build_object('business_id', '%s', 'name', 'Odd', 'kind', 'consumable',
  'pack_size', 0)) $$, current_setting('t.b')), '22023', null, 'a pack holds something');
select lives_ok(format($$ select save_item(jsonb_build_object('id', '%s', 'business_id', '%s', 'name', 'Argan oil 1 L',
  'kind', 'consumable', 'unit', 'ml')) $$, current_setting('t.oil'), current_setting('t.b')), 'editing without a pack size');
select is((select pack_size from inventory_items where id = current_setting('t.oil')::uuid), 1000.000, 'keeps the pack size');
select set_config('t.sup', (save_supplier(jsonb_build_object('business_id', current_setting('t.b'), 'name', 'Beauty Trading',
  'terms_days', 30)))::text, false);

-- 10 bottles at AED 45.00 + 5% VAT, and AED 20.00 of delivery (no product) + 1.00 VAT.
select set_config('t.bill', (post_purchase_bill(jsonb_build_object('branch_id', current_setting('t.br'),
  'supplier_id', current_setting('t.sup'), 'invoice_ref', 'INV-4471', 'lines', jsonb_build_array(
    jsonb_build_object('item_id', current_setting('t.oil'), 'packs', 10, 'unit_price_minor', 4500, 'vat_minor', 2250),
    jsonb_build_object('description', 'Delivery', 'packs', 1, 'unit_price_minor', 2000, 'vat_minor', 100))))
  ->> 'bill_id'), false);
select results_eq(format($$ select packs, unit_price_minor, total_minor, vat_minor, qty from purchase_bill_lines
  where bill_id = '%s' and item_id is not null $$, current_setting('t.bill')),
  $$ values (10.000, 4500::bigint, 45000::bigint, 2250::bigint, 10000::numeric) $$,
  'the line reads as on the invoice: 10 × 45.00 = 450.00, VAT 22.50, and 10,000 ml');
select results_eq(format($$ select total_minor, vat_minor from purchase_bills where id = '%s' $$, current_setting('t.bill')),
  $$ values (49350::bigint, 2350::bigint) $$, 'grand total 493.50: subtotal 470.00 + VAT 23.50');
select is((select qty from stock_levels where item_id = current_setting('t.oil')::uuid), 10000::numeric,
  'stock goes up by 10,000 ml');
select is((select avg_unit_cost_minor from inventory_levels(current_setting('t.br')::uuid) where item_id = current_setting('t.oil')::uuid),
  4.5000, 'each ml costs 4.5 fils, without the VAT');
select is(pg_temp.balance(current_setting('t.b')::uuid, 'inventory'), 45000::bigint, 'stock valued at 450.00');
select is(pg_temp.balance(current_setting('t.b')::uuid, 'supplies_expense'), 2000::bigint, 'delivery is a 20.00 expense');
select is(pg_temp.balance(current_setting('t.b')::uuid, 'vat_receivable'), 2350::bigint, 'the 23.50 VAT is recoverable');
select is(pg_temp.balance(current_setting('t.b')::uuid, 'supplier_payable'), -49350::bigint, 'the supplier is owed 493.50');
select results_eq(format($$ select taxable_minor, vat_minor from report_vat('%s', to_char(branch_today('%s'), 'YYYY-MM'))
  where kind = 'purchases' $$, current_setting('t.br'), current_setting('t.br')),
  $$ values (47000::bigint, 2350::bigint) $$, 'the VAT report shows 23.50 paid on 470.00');
select throws_ok(format($$ select post_purchase_bill(jsonb_build_object('branch_id', '%s', 'supplier_id', '%s',
  'lines', jsonb_build_array(jsonb_build_object('item_id', '%s', 'packs', 1, 'unit_price_minor', 100, 'vat_minor', 200)))) $$,
  current_setting('t.br'), current_setting('t.sup'), current_setting('t.oil')), '22023', 'invalid_line',
  'a line''s VAT cannot be more than the line');
select throws_ok(format($$ select post_purchase_bill(jsonb_build_object('branch_id', '%s', 'supplier_id', '%s',
  'lines', jsonb_build_array(jsonb_build_object('item_id', '%s', 'packs', 0, 'unit_price_minor', 100)))) $$,
  current_setting('t.br'), current_setting('t.sup'), current_setting('t.oil')), '22023', 'invalid_line', 'nor packs zero');
select lives_ok(format($$ select reverse_purchase_bill('%s', 'Wrong supplier') $$, current_setting('t.bill')), 'reversed');
select is((select qty from stock_levels where item_id = current_setting('t.oil')::uuid), 0::numeric, 'the 10,000 ml go back out');
select ok(pg_temp.balance(current_setting('t.b')::uuid, 'inventory') = 0
          and pg_temp.balance(current_setting('t.b')::uuid, 'supplies_expense') = 0
          and pg_temp.balance(current_setting('t.b')::uuid, 'vat_receivable') = 0
          and pg_temp.balance(current_setting('t.b')::uuid, 'supplier_payable') = 0,
  'and stock, delivery, VAT and the supplier''s balance all return to nothing');

-- ── A salon without VAT: the supplier's VAT is part of the cost ──────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000016bb');
select set_config('t.b2', (create_business('{"business_name":"Plain Salon","owner_name":"Plain Owner","mode":"gents"}')
  ->> 'business_id'), false);
select set_config('t.br2', (select id::text from branches where business_id = current_setting('t.b2')::uuid), false);
select set_config('t.razor', save_item(jsonb_build_object('business_id', current_setting('t.b2'), 'name', 'Razor blades',
  'kind', 'consumable', 'unit', 'pcs', 'pack_size', 12))::text, false);
select set_config('t.sup2', (save_supplier(jsonb_build_object('business_id', current_setting('t.b2'), 'name', 'Barber Supply',
  'terms_days', 0)))::text, false);
select set_config('t.bill2', (post_purchase_bill(jsonb_build_object('branch_id', current_setting('t.br2'),
  'supplier_id', current_setting('t.sup2'), 'lines', jsonb_build_array(
    jsonb_build_object('item_id', current_setting('t.razor'), 'packs', 2, 'unit_price_minor', 10000, 'vat_minor', 1000))))
  ->> 'bill_id'), false);
select is((select qty from stock_levels where item_id = current_setting('t.razor')::uuid), 24::numeric, '2 packs of 12 = 24 blades');
select alike((select memo from journal_entries where source_id = current_setting('t.bill2')::uuid), 'PUR-00001 · %',
  'the books name it PUR-00001');
select is(pg_temp.balance(current_setting('t.b2')::uuid, 'inventory'), 21000::bigint, 'stock includes the VAT it cannot claim');
select is(pg_temp.balance(current_setting('t.b2')::uuid, 'vat_receivable'), 0::bigint, 'nothing recoverable');
select is((select avg_unit_cost_minor from inventory_levels(current_setting('t.br2')::uuid) where item_id = current_setting('t.razor')::uuid),
  875.0000, 'each blade costs 8.75 (210.00 / 24)');
select is((select total_minor from purchase_bills where id = current_setting('t.bill2')::uuid), 21000::bigint, 'the bill is 210.00');
-- A different pack on the invoice (a box of 10 this time): stock follows it, and it becomes the item's usual pack.
select set_config('t.bill3', (post_purchase_bill(jsonb_build_object('branch_id', current_setting('t.br2'),
  'supplier_id', current_setting('t.sup2'), 'lines', jsonb_build_array(
    jsonb_build_object('item_id', current_setting('t.razor'), 'packs', 1, 'pack_size', 10, 'unit_price_minor', 5000))))
  ->> 'bill_id'), false);
select is((select qty from stock_levels where item_id = current_setting('t.razor')::uuid), 34::numeric, 'a box of 10 adds 10');
select is((select pack_size from inventory_items where id = current_setting('t.razor')::uuid), 10.000, 'and is remembered');
select lives_ok(format($$ select reverse_purchase_bill('%s', 'Test box') $$, current_setting('t.bill3')), 'reversed again');
select lives_ok(format($$ select reverse_purchase_bill('%s', 'Duplicate') $$, current_setting('t.bill2')), 'reversed');
select ok(pg_temp.balance(current_setting('t.b2')::uuid, 'inventory') = 0
          and pg_temp.balance(current_setting('t.b2')::uuid, 'supplier_payable') = 0, 'back to nothing');
select ok(pg_temp.balanced(), 'every entry balances');

-- ── Deleting an account ──────────────────────────────────────────────────────────────────
select pg_temp.as_service();
select set_config('t.staff', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b2'),
  'branch_id', current_setting('t.br2'), 'user_id', '00000000-0000-0000-0000-0000000016cc', 'username', 'plainstaff',
  'display_name', 'Imran Plain', 'role', 'staff')) ->> 'member_id'), false);
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b2'), 'branch_id', current_setting('t.br2'),
  'user_id', '00000000-0000-0000-0000-0000000016dd', 'username', 'plaincash', 'display_name', 'Cashier', 'role', 'cashier'));
select pg_temp.as_admin();
insert into subscriptions (business_id, paid_until) values (current_setting('t.b2')::uuid, current_date + 30);
insert into push_tokens (token, member_id, platform) values ('ExponentPushToken[plain-staff]', current_setting('t.staff')::uuid, 'ios');

select pg_temp.as_user('00000000-0000-0000-0000-0000000016cc');
select throws_ok($$ select delete_account_data('00000000-0000-0000-0000-0000000016cc') $$, '42501', null,
  'only the server can delete an account');

select pg_temp.as_service();
select is(delete_account_data('00000000-0000-0000-0000-0000000016cc') ->> 'business_closed', 'false', 'a barber deletes their login');
select pg_temp.as_admin();
select results_eq(format($$ select active, display_name, username, (select count(*)::int from push_tokens where member_id = m.id)
  from members m where id = '%s' $$, current_setting('t.staff')),
  $$ values (false, 'Deleted user'::text, 'deleted-' || left(current_setting('t.staff'), 8), 0) $$,
  'their login is off, their name gone, their phone forgotten');
select ok((select closed_at is null from businesses where id = current_setting('t.b2')::uuid), 'the salon carries on');

select pg_temp.as_service();
select set_config('t.closed', delete_account_data('00000000-0000-0000-0000-0000000016bb')::text, false);
select is(current_setting('t.closed')::jsonb ->> 'business_closed', 'true', 'the owner deletes theirs');
select is((select array_agg(x order by x) from jsonb_array_elements_text(current_setting('t.closed')::jsonb -> 'staff_users') x),
  array['00000000-0000-0000-0000-0000000016cc', '00000000-0000-0000-0000-0000000016dd'], 'and the staff logins go too');
select pg_temp.as_admin();
select ok((select closed_at is not null from businesses where id = current_setting('t.b2')::uuid)
          and not exists (select 1 from members where business_id = current_setting('t.b2')::uuid and active)
          and not plan_active(current_setting('t.b2')::uuid),
  'which closes the salon: every login off, the plan ended');
select ok((select count(*) from purchase_bills where business_id = current_setting('t.b2')::uuid) = 2
          and (select count(*) from journal_entries where business_id = current_setting('t.b2')::uuid) = 4,
  'and its records are kept');

select * from finish();
rollback;
