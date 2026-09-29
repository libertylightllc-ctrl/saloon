-- Books and reports: closing a finished month locks it, reopening needs a reason; each report adds up to the
-- same numbers as the source records; only the owner and the accountant may read them.
begin;
create extension if not exists pgtap with schema extensions;
-- Paid plans are tested in 14_plans; here every salon may work.
select set_config('salon.plan_check', 'off', false);
select plan(25);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000010aa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'br-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-0000000010cc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'br-cashier@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-0000000010ee', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'br-acct@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-0000000010dd', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'br-staff@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

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

select pg_temp.as_user('00000000-0000-0000-0000-0000000010aa');
select set_config('t.b', (create_business('{"business_name":"Report Salon","owner_name":"Owner","mode":"gents",
  "vat_mode":"on","trn":"100234567800003","opening_cash_minor":20000}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select set_config('t.month', to_char(branch_today(current_setting('t.br')::uuid), 'YYYY-MM'), false);
select set_config('t.last', to_char(branch_today(current_setting('t.br')::uuid) - interval '1 month', 'YYYY-MM'), false);
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-0000000010cc', 'username', 'brcash', 'display_name', 'Faisal', 'role', 'cashier'));
select set_config('t.emp', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'user_id', '00000000-0000-0000-0000-0000000010dd', 'username', 'brstaff',
  'display_name', 'Rafiq', 'role', 'staff', 'commission_bps', 1000)) ->> 'employee_id'), false);
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-0000000010ee', 'username', 'bracct', 'display_name', 'Accountant', 'role', 'accountant'));

-- The month's activity: two sales by Rafiq (one with a tip), a refund, a tea expense, a customer.
select pg_temp.as_user('00000000-0000-0000-0000-0000000010aa');
insert into customers (business_id, name, phone) values (current_setting('t.b')::uuid, 'Omar', '+971 50 111 0000');
select set_config('t.s1', (create_sale(jsonb_build_object('branch_id', current_setting('t.br'), 'employee_id', current_setting('t.emp'),
  'customer_id', (select id from customers where business_id = current_setting('t.b')::uuid),
  'lines', '[{"kind":"custom","name":"Fade","unit_price_minor":10500}]'::jsonb,
  'payments', '[{"method":"cash","amount_minor":10500}]'::jsonb)) ->> 'sale_id'), false);
select create_sale(jsonb_build_object('branch_id', current_setting('t.br'), 'employee_id', current_setting('t.emp'),
  'lines', '[{"kind":"custom","name":"Beard","unit_price_minor":5250}]'::jsonb, 'tip_minor', 1000,
  'payments', '[{"method":"card","amount_minor":6250}]'::jsonb));
select refund_sale(jsonb_build_object('sale_id', current_setting('t.s1'), 'amount_minor', 2100, 'method', 'cash', 'reason', 'Unhappy'));
select record_expense(jsonb_build_object('branch_id', current_setting('t.br'), 'amount_minor', 1500, 'method', 'cash',
  'category_id', (select id from expense_categories where business_id = current_setting('t.b')::uuid and key = 'tea_food')));

-- ── Monthly business ─────────────────────────────────────────────────────────────────────
select is((select sum((d ->> 'sales_minor')::bigint)::bigint from jsonb_array_elements(report_monthly(current_setting('t.br')::uuid,
  current_setting('t.month')) -> 'days') d), 16750::bigint, 'monthly: the days add up to both sales (105.00 + 62.50)');
select is((select sum((d ->> 'expenses_minor')::bigint)::bigint from jsonb_array_elements(report_monthly(current_setting('t.br')::uuid,
  current_setting('t.month')) -> 'days') d), 1500::bigint, 'monthly: expenses by day');
select is((report_monthly(current_setting('t.br')::uuid, current_setting('t.month')) ->> 'revenue_minor')::bigint,
  (10500 + 5250 - 2100) * 100 / 105::bigint, 'monthly: revenue from the books is without VAT, after the refund');
select is((report_monthly(current_setting('t.br')::uuid, current_setting('t.month')) ->> 'costs_minor')::bigint, 1500::bigint,
  'monthly: costs from the books');

-- ── Staff sales ──────────────────────────────────────────────────────────────────────────
select results_eq(format($$ select sales_minor, revenue_minor, tips_minor from report_staff(%L, %L) where employee_id = %L $$,
  current_setting('t.br'), current_setting('t.month'), current_setting('t.emp')),
  $$ values (15750::bigint, 15000::bigint, 1000::bigint) $$, 'staff: sales, revenue without VAT, tips');
select is((select commission_minor from report_staff(current_setting('t.br')::uuid, current_setting('t.month'))
  where employee_id = current_setting('t.emp')::uuid), 1300::bigint, 'staff: 10% commission, less the refunded 20% of sale 1');

-- ── Daily closing and shortages ──────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000010cc');
select set_config('t.expected', (closing_preview(current_setting('t.br')::uuid) ->> 'expected_cash_minor'), false);
select submit_cash_count(jsonb_build_object('branch_id', current_setting('t.br'),
  'counted_cash_minor', current_setting('t.expected')::bigint - 400, 'submit', true,
  'drawer_closed_confirmed', true, 'reason', 'Coins miscounted'));
select pg_temp.as_user('00000000-0000-0000-0000-0000000010aa');
select is(current_setting('t.expected')::bigint, 20000 + 10500 - 2100 - 1500::bigint,
  'the day expects 200 opening + 105 cash sale − 21 cash refund − 15 tea (the card sale is not cash)');
select results_eq(format($$ select expected_minor, counted_minor, variance_minor, counted_by from report_closing(%L, %L)
  where business_date = branch_today(%L::uuid) $$, current_setting('t.br'), current_setting('t.month'), current_setting('t.br')),
  format($$ values (%s::bigint, %s::bigint, -400::bigint, 'Faisal'::text) $$, current_setting('t.expected'),
  current_setting('t.expected')::bigint - 400), 'closing: expected, counted, 4.00 short, counted by Faisal');
select is((select count(*)::int from report_shortages(current_setting('t.br')::uuid, current_setting('t.month'))), 1,
  'shortages: the close that was short');
select is((select reason from report_shortages(current_setting('t.br')::uuid, current_setting('t.month'))), 'Coins miscounted',
  'with its reason');

-- ── Stock and customers ──────────────────────────────────────────────────────────────────
select set_config('t.item', save_item(jsonb_build_object('business_id', current_setting('t.b'), 'name', 'Hair Wax',
  'kind', 'retail', 'sell_price_minor', 4500))::text, false);
select set_opening_stock(current_setting('t.br')::uuid, jsonb_build_array(jsonb_build_object('item_id', current_setting('t.item'),
  'qty', 10, 'unit_cost_minor', 2000)));
select adjust_stock(jsonb_build_object('branch_id', current_setting('t.br'), 'item_id', current_setting('t.item'), 'qty_delta', -3,
  'reason', 'Damaged'));
select results_eq(format($$ select opening, qty_in, qty_out, closing, value_minor from report_stock(%L, %L) where item_id = %L $$,
  current_setting('t.br'), current_setting('t.month'), current_setting('t.item')),
  $$ values (0::numeric, 10::numeric, -3::numeric, 7::numeric, 14000::bigint) $$, 'stock: in 10, out 3, 7 left worth 140.00');
select results_eq(format($$ select visits, spent_minor, month_visits from report_customers(%L, %L) $$,
  current_setting('t.b'), current_setting('t.month')),
  $$ values (1, 8400::bigint, 1) $$, 'customers: one visit, 105.00 less the 21.00 refund');

-- ── Owner control summary ────────────────────────────────────────────────────────────────
select is((owner_control(current_setting('t.br')::uuid) ->> 'last_close_variance_minor')::bigint, -400::bigint,
  'control line: the latest close difference');
select ok((owner_control(current_setting('t.br')::uuid) ->> 'compliance_issues')::int > 0, 'control line: compliance issues (owner)');

-- ── Who may read reports ─────────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000010ee');
select lives_ok(format($$ select report_monthly('%s', '%s') $$, current_setting('t.br'), current_setting('t.month')),
  'the accountant reads reports');
select is(owner_control(current_setting('t.br')::uuid) ->> 'compliance_issues', null, 'but not compliance details');
select pg_temp.as_user('00000000-0000-0000-0000-0000000010cc');
select throws_ok(format($$ select report_monthly('%s', '%s') $$, current_setting('t.br'), current_setting('t.month')), '42501', null,
  'a cashier cannot read reports');
select throws_ok(format($$ select * from report_customers('%s', '%s') $$, current_setting('t.b'), current_setting('t.month')), '42501',
  null, 'nor the customer list report');

-- ── Close period ─────────────────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000010aa');
select throws_ok(format($$ select close_period('%s', '%s') $$, current_setting('t.b'), current_setting('t.month')), '22023',
  'invalid_date', 'this month cannot be closed yet');
-- Last month has a sale moved into it (as the demo does), then the month is closed.
select pg_temp.as_admin();
update journal_entries set business_date = business_date - interval '1 month' where source_type = 'sale' and source_id = current_setting('t.s1')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-0000000010ee');
select throws_ok(format($$ select close_period('%s', '%s') $$, current_setting('t.b'), current_setting('t.last')), '42501', null,
  'the accountant cannot close a month');
select pg_temp.as_user('00000000-0000-0000-0000-0000000010aa');
select lives_ok(format($$ select close_period('%s', '%s') $$, current_setting('t.b'), current_setting('t.last')), 'the owner closes last month');
select is((select status from period_list(current_setting('t.b')::uuid) where month = current_setting('t.last')), 'closed',
  'it shows as closed');
select pg_temp.as_admin();
select throws_ok(format($$ select post_journal('%s', '%s', '%s', 'test', null, 'x', null,
  '[{"account":"cash","debit":100},{"account":"other_income","credit":100}]') $$, current_setting('t.b'), current_setting('t.br'),
  current_setting('t.last') || '-15'), '23514', 'period_closed: ' || current_setting('t.last'), 'nothing can be posted into a closed month');
select pg_temp.as_user('00000000-0000-0000-0000-0000000010aa');
select throws_ok(format($$ select reopen_period('%s', '%s', 'x') $$, current_setting('t.b'), current_setting('t.last')), '22023',
  'reason_required', 'reopening needs a reason');
select lives_ok(format($$ select reopen_period('%s', '%s', 'Supplier bill came late') $$, current_setting('t.b'), current_setting('t.last')),
  'the owner reopens it with a reason');

select * from finish();
rollback;
