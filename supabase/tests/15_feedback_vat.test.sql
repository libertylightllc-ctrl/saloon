-- Owner feedback 2026-09-30: a service without a time; a purchase line entered as quantity + amount (100 ml for
-- AED 45); VAT on supplier bills and expenses (input VAT) and their reversals; the monthly VAT report.
begin;
create extension if not exists pgtap with schema extensions;
-- Paid plans are tested in 14_plans; here every salon may work.
select set_config('salon.plan_check', 'off', false);
select plan(22);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000015aa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'vat-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-0000000015bb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'novat-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.balance(p_business uuid, p_key text) returns bigint language sql as $$
  select coalesce(sum(l.debit_minor - l.credit_minor), 0)::bigint
  from journal_lines l join journal_entries e on e.id = l.entry_id join accounts a on a.id = l.account_id
  where e.business_id = p_business and a.system_key = p_key
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000015aa');
select set_config('t.b', (create_business('{"business_name":"VAT Salon","owner_name":"Owner","mode":"ladies",
  "vat_mode":"on","trn":"100234567800003"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select is((select count(*)::int from accounts where business_id = current_setting('t.b')::uuid and system_key = 'vat_receivable'),
  1, 'a new salon has the VAT recoverable account');

-- ── 1. A service without a time ──────────────────────────────────────────────────────────
select set_config('t.svc', (save_service(jsonb_build_object('business_id', current_setting('t.b'), 'name', 'Quick trim',
  'price_minor', 2000, 'category_id', (select id from service_categories where business_id = current_setting('t.b')::uuid limit 1))))::text, false);
select is((select duration_min from services where id = current_setting('t.svc')::uuid), null, 'a service can have no time');
select lives_ok(format($$ select create_appointment(jsonb_build_object('branch_id', '%s', 'kind', 'walk_in', 'guest_name', 'Mona',
  'service_ids', jsonb_build_array('%s'))) $$, current_setting('t.br'), current_setting('t.svc')), 'and still goes in the queue');
select is((select duration_min from appointments where branch_id = current_setting('t.br')::uuid and customer_name = 'Mona'), 30,
  'holding 30 minutes when nothing else says how long');
select lives_ok(format($$ select save_service(jsonb_build_object('business_id', '%s', 'name', 'Fringe', 'price_minor', 1000,
  'duration_min', 10, 'category_id', (select id from service_categories where business_id = '%s' limit 1))) $$,
  current_setting('t.b'), current_setting('t.b')), 'a 10-minute service is fine');

-- ── 3. A bill line as quantity + amount ──────────────────────────────────────────────────
select set_config('t.item', save_item(jsonb_build_object('business_id', current_setting('t.b'), 'name', 'Argan oil',
  'kind', 'consumable', 'unit', 'ml'))::text, false);
select set_config('t.sup', (save_supplier(jsonb_build_object('business_id', current_setting('t.b'), 'name', 'Beauty Trading',
  'terms_days', 30)))::text, false);
select set_config('t.bill', (post_purchase_bill(jsonb_build_object('branch_id', current_setting('t.br'), 'supplier_id', current_setting('t.sup'),
  'vat_minor', 225, 'lines', jsonb_build_array(jsonb_build_object('item_id', current_setting('t.item'), 'qty', 100, 'total_minor', 4500))))
  ->> 'bill_id'), false);
select is((select total_minor from purchase_bill_lines where bill_id = current_setting('t.bill')::uuid), 4500::bigint,
  '100 ml for AED 45.00 is a AED 45.00 line (not 100 × 45)');
select is((select unit_cost_minor from purchase_bill_lines where bill_id = current_setting('t.bill')::uuid), 45.0000,
  'so each ml costs 45 fils');
select is((select qty from stock_levels where item_id = current_setting('t.item')::uuid), 100::numeric, '100 ml in stock');
-- (Item costs are closed to plain reads; the owner sees them through inventory_levels.)
select is((select avg_unit_cost_minor from inventory_levels(current_setting('t.br')::uuid) where item_id = current_setting('t.item')::uuid),
  45.0000, 'valued at 45 fils a ml');

-- ── 5. VAT on the bill ───────────────────────────────────────────────────────────────────
select results_eq(format($$ select total_minor, vat_minor from purchase_bills where id = '%s' $$, current_setting('t.bill')),
  $$ values (4725::bigint, 225::bigint) $$, 'the bill owes AED 47.25: 45.00 + 2.25 VAT');
select is(pg_temp.balance(current_setting('t.b')::uuid, 'inventory'), 4500::bigint, 'stock is valued without VAT');
select is(pg_temp.balance(current_setting('t.b')::uuid, 'vat_receivable'), 225::bigint, 'the VAT is recoverable');
select is(pg_temp.balance(current_setting('t.b')::uuid, 'supplier_payable'), -4725::bigint, 'the supplier is owed 47.25');

-- ── …and on an expense ───────────────────────────────────────────────────────────────────
select set_config('t.exp', (record_expense(jsonb_build_object('branch_id', current_setting('t.br'), 'amount_minor', 10500,
  'vat_minor', 500, 'method', 'card', 'category_id',
  (select id from expense_categories where business_id = current_setting('t.b')::uuid and key = 'internet_phone'))) ->> 'expense_id'), false);
select is(pg_temp.balance(current_setting('t.b')::uuid, 'exp_internet_phone'), 10000::bigint, 'the expense is 100.00 without VAT');
select is(pg_temp.balance(current_setting('t.b')::uuid, 'vat_receivable'), 725::bigint, 'and its 5.00 VAT is recoverable');
select throws_ok(format($$ select record_expense(jsonb_build_object('branch_id', '%s', 'amount_minor', 500, 'vat_minor', 500,
  'method', 'card', 'category_id', (select id from expense_categories where business_id = '%s' limit 1))) $$,
  current_setting('t.br'), current_setting('t.b')), '22023', 'invalid_amount', 'VAT cannot be the whole amount');

-- ── 6. The VAT report, then reversals ────────────────────────────────────────────────────
select create_sale(jsonb_build_object('branch_id', current_setting('t.br'),
  'lines', '[{"kind":"custom","name":"Blow-dry","unit_price_minor":21000}]'::jsonb,
  'payments', '[{"method":"card","amount_minor":21000}]'::jsonb));
select results_eq(format($$ select kind, entries, taxable_minor, vat_minor from report_vat('%s', to_char(branch_today('%s'), 'YYYY-MM')) $$,
  current_setting('t.br'), current_setting('t.br')),
  $$ values ('sales', 1, 20000::bigint, 1000::bigint), ('refunds', 0, 0::bigint, 0::bigint),
            ('purchases', 1, 4500::bigint, 225::bigint), ('expenses', 1, 10000::bigint, 500::bigint) $$,
  'VAT report: 10.00 collected on 200.00 of sales; 7.25 paid on 145.00 of purchases and expenses');
select lives_ok(format($$ select reverse_expense('%s', 'Entered twice') $$, current_setting('t.exp')), 'the expense is reversed');
select lives_ok(format($$ select reverse_purchase_bill('%s', 'Wrong supplier') $$, current_setting('t.bill')), 'and the bill');
select is(pg_temp.balance(current_setting('t.b')::uuid, 'vat_receivable'), 0::bigint, 'the reversals take the input VAT back out');
select is((select sum(vat_minor)::bigint from report_vat(current_setting('t.br')::uuid, to_char(branch_today(current_setting('t.br')::uuid), 'YYYY-MM'))
  where kind in ('purchases', 'expenses')), 0::bigint, 'so the month shows no input VAT');

-- ── VAT only for a VAT-registered salon ──────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000015bb');
select set_config('t.b2', (create_business('{"business_name":"No VAT Salon","owner_name":"Owner","mode":"gents"}') ->> 'business_id'), false);
select throws_ok(format($$ select record_expense(jsonb_build_object('branch_id', '%s', 'amount_minor', 1050, 'vat_minor', 50,
  'method', 'cash', 'category_id', (select id from expense_categories where business_id = '%s' limit 1))) $$,
  (select id from branches where business_id = current_setting('t.b2')::uuid), current_setting('t.b2')), '22023', 'vat_off',
  'a salon without VAT cannot claim input VAT');

select * from finish();
rollback;
