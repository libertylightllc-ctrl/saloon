-- Paid plans: a new salon can be set up but not used until the platform owner records a payment; the plan runs
-- from today (or from its end); an ended plan stops new activity but never reading; only the platform owner
-- activates; the owner asks for it; staff see why they are refused.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);
-- The checks below work out dates and codes with internal helpers that the app's sign-in roles cannot call (migration
-- 33); they are allowed here, inside this test's transaction only (rolled back at the end).
grant execute on function public.branch_today(uuid), public.branch_tz(uuid), public.business_today(uuid),
  public.compliance_readiness(uuid), public.plan_active(uuid), public.unique_business_code(text),
  public.post_journal(uuid, uuid, date, text, uuid, text, uuid, jsonb), public.branch_setting(uuid, text, jsonb)
  to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000014aa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'plan-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-0000000014cc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'plan-cashier@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-0000000014ff', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'platform@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');
insert into platform_admins (user_id) values ('00000000-0000-0000-0000-0000000014ff');

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

-- ── Setting up is free ───────────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000014aa');
select lives_ok($$ select set_config('t.b', (create_business('{"business_name":"Plan Salon","owner_name":"Owner","mode":"gents",
  "opening_cash_minor":10000}') ->> 'business_id'), false) $$, 'a new owner creates the salon, opening cash included');
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select lives_ok(format($$ select save_service(jsonb_build_object('business_id', '%s', 'name', 'Fade', 'price_minor', 5000,
  'duration_min', 30, 'category_id', (select id from service_categories where business_id = '%s' limit 1))) $$,
  current_setting('t.b'), current_setting('t.b')), 'and adds services');
select lives_ok(format($$ select set_config('t.item', save_item('{"business_id":"%s","name":"Wax","kind":"retail","sell_price_minor":3000}')::text, false) $$,
  current_setting('t.b')), 'and items');
select lives_ok(format($$ select set_opening_stock('%s', '[{"item_id":"%s","qty":5,"unit_cost_minor":1000}]') $$,
  current_setting('t.br'), current_setting('t.item')), 'and counts opening stock');
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-0000000014cc', 'username', 'plancash', 'display_name', 'Noor', 'role', 'cashier'));

-- ── …but not used without a plan ─────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000014aa');
select is((plan_status(current_setting('t.b')::uuid) ->> 'active')::boolean, false, 'no plan yet');
select is((plan_status(current_setting('t.b')::uuid) ->> 'monthly_minor')::bigint, 9900::bigint, 'AED 99 for one branch');
select throws_ok(format($$ select create_sale(jsonb_build_object('branch_id', '%s', 'client_ref', 'p1',
  'lines', '[{"kind":"custom","name":"Fade","unit_price_minor":5000}]'::jsonb,
  'payments', '[{"method":"cash","amount_minor":5000}]'::jsonb)) $$, current_setting('t.br')), 'PT402', 'plan_required',
  'no sale without a plan');
select throws_ok(format($$ select create_appointment(jsonb_build_object('branch_id', '%s', 'kind', 'walk_in', 'guest_name', 'Omar',
  'service_ids', jsonb_build_array((select id from services where business_id = '%s' limit 1)))) $$,
  current_setting('t.br'), current_setting('t.b')), 'PT402', 'plan_required', 'no walk-in without a plan');
select throws_ok(format($$ insert into customers (business_id, name) values ('%s', 'Omar') $$, current_setting('t.b')),
  'PT402', 'plan_required', 'no customers without a plan');
select throws_ok(format($$ select record_expense(jsonb_build_object('branch_id', '%s', 'amount_minor', 500, 'method', 'cash',
  'category_id', (select id from expense_categories where business_id = '%s' limit 1))) $$,
  current_setting('t.br'), current_setting('t.b')), 'PT402', 'plan_required', 'no expenses without a plan');
select pg_temp.as_user('00000000-0000-0000-0000-0000000014cc');
select is((plan_status(current_setting('t.b')::uuid) ->> 'active')::boolean, false, 'staff can see the plan is off');

-- ── The owner asks; only the platform owner switches it on ───────────────────────────────
select throws_ok(format($$ select request_plan('%s', 1, null) $$, current_setting('t.b')), '42501', null,
  'a cashier cannot ask for the plan');
select pg_temp.as_user('00000000-0000-0000-0000-0000000014aa');
select lives_ok(format($$ select request_plan('%s', 3, 'Paying by bank transfer') $$, current_setting('t.b')),
  'the owner asks for 3 months');
select is((plan_status(current_setting('t.b')::uuid) ->> 'requested_months')::int, 3, 'the request shows');
select throws_ok(format($$ select admin_activate('%s', 3, 29700, 'x') $$, current_setting('t.b')), '42501', null,
  'an owner cannot switch on their own plan');
select throws_ok($$ select * from admin_salons() $$, '42501', null, 'nor list the salons');
select throws_ok(format($$ insert into subscriptions (business_id, paid_until) values ('%s', '2099-01-01') $$,
  current_setting('t.b')), '42501', null, 'nor write the plan table');

select pg_temp.as_user('00000000-0000-0000-0000-0000000014ff');
select is((select requested_months from admin_salons() where business_id = current_setting('t.b')::uuid), 3,
  'the platform owner sees the request');
select is(admin_activate(current_setting('t.b')::uuid, 3, 29700, 'Bank transfer ref 1234'),
  (business_today(current_setting('t.b')::uuid) - 1 + interval '3 months')::date, 'paid for 3 months from today');
select is(admin_activate(current_setting('t.b')::uuid, 1, 9900, null),
  (business_today(current_setting('t.b')::uuid) - 1 + interval '4 months')::date, 'another month extends it from its end');

select pg_temp.as_user('00000000-0000-0000-0000-0000000014aa');
select is((plan_status(current_setting('t.b')::uuid) ->> 'requested_at'), null, 'the request is settled');
select lives_ok(format($$ select create_sale(jsonb_build_object('branch_id', '%s', 'client_ref', 'p2',
  'lines', '[{"kind":"custom","name":"Fade","unit_price_minor":5000}]'::jsonb,
  'payments', '[{"method":"cash","amount_minor":5000}]'::jsonb)) $$, current_setting('t.br')), 'with a plan the salon sells');

-- ── An ended plan stops new work but not reading ─────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000014ff');
select lives_ok(format($$ select admin_end_plan('%s', 'Card refunded') $$, current_setting('t.b')), 'the platform owner ends it');
select pg_temp.as_user('00000000-0000-0000-0000-0000000014aa');
select is((select count(*)::int from sales where business_id = current_setting('t.b')::uuid), 1, 'the sale is still there to read');

select * from finish();
rollback;
