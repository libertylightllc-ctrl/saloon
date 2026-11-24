-- Part C2 (owner's app check, 9 Nov 2026): the full payslip (salon, staff ID, days, late days, tips, paid date), who may
-- read it, "Tips this month", and paying with the day it was paid.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(21);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000078' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'payslips-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1', 'b2', 'b3', 'b4', 'b5']) n;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000078' || p)::uuid,
    'role', 'authenticated')::text, true);
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
create function pg_temp.login(p_user text, p_role text, p_name text) returns text language sql as $$
  select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
    'user_id', ('00000000-0000-0000-0000-0000000078' || p_user)::uuid, 'username', lower(p_name) || 'seventyeight',
    'display_name', p_name, 'role', p_role, 'commission_bps', 1000)) ->> 'employee_id'
$$;

select pg_temp.as_user('a0');
select set_config('t.b', (create_business('{"business_name":"Payslip Salon","owner_name":"Owner","mode":"ladies",
  "vat_mode":"off","opening_cash_minor":50000}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_admin();
select set_config('t.today', branch_today(current_setting('t.br')::uuid)::text, false);
select set_config('t.period', to_char(current_setting('t.today')::date, 'YYYY-MM'), false);
select pg_temp.as_service();
-- Marie and Paru (stylists), the accountant, a manager and the front desk.
select set_config('t.marie', pg_temp.login('b1', 'staff', 'Marie'), false);
select set_config('t.paru', pg_temp.login('b2', 'staff', 'Paru'), false);
select pg_temp.login('b3', 'accountant', 'Books'), pg_temp.login('b4', 'manager', 'Mona'), pg_temp.login('b5', 'cashier', 'Dina');

select pg_temp.as_user('a0');
select save_employee(jsonb_build_object('business_id', current_setting('t.b'), 'id', current_setting('t.marie'),
  'full_name', 'Marie', 'employee_code', 'RR-007', 'base_salary_minor', 70000,
  'started_on', current_setting('t.period') || '-01'));
select save_employee(jsonb_build_object('business_id', current_setting('t.b'), 'id', current_setting('t.paru'),
  'full_name', 'Paru', 'base_salary_minor', 50000, 'started_on', current_setting('t.period') || '-01'));
-- A AED 40.00 service with a AED 5.00 tip for Marie; AED 2.00 of the tip given back.
select set_config('t.sale', (create_sale(jsonb_build_object('branch_id', current_setting('t.br'),
  'employee_id', current_setting('t.marie'), 'tip_minor', 500,
  'lines', jsonb_build_array(jsonb_build_object('kind', 'custom', 'name', 'Blow-dry', 'unit_price_minor', 4000,
                                                'employee_id', current_setting('t.marie'))),
  'payments', '[{"method":"cash","amount_minor":4500}]'::jsonb)) ->> 'sale_id'), false);
select pg_temp.as_admin();
insert into refunds (business_id, branch_id, sale_id, amount_minor, tip_minor, method, reason, business_date, created_by)
select s.business_id, s.branch_id, s.id, 200, 200, 'cash', 'Tip given back', s.business_date,
       (select id from members where business_id = s.business_id and role = 'owner')
from sales s where s.id = current_setting('t.sale')::uuid;
-- Two days at work, one of them late.
insert into attendance (business_id, branch_id, employee_id, business_date, clock_in, late, late_minutes)
values (current_setting('t.b')::uuid, current_setting('t.br')::uuid, current_setting('t.marie')::uuid,
        current_setting('t.today')::date, now(), true, 12),
       (current_setting('t.b')::uuid, current_setting('t.br')::uuid, current_setting('t.marie')::uuid,
        current_setting('t.today')::date - 1, now() - interval '1 day', false, 0);

select pg_temp.as_user('a0');
select set_config('t.run', generate_payroll(current_setting('t.b')::uuid, current_setting('t.period'))::text, false);
select set_config('t.line', (select id::text from payroll_lines where run_id = current_setting('t.run')::uuid
  and employee_id = current_setting('t.marie')::uuid), false);
select set_config('t.paruline', (select id::text from payroll_lines where run_id = current_setting('t.run')::uuid
  and employee_id = current_setting('t.paru')::uuid), false);

-- The payslip's details.
select set_config('t.d', payslip_details(current_setting('t.line')::uuid)::text, false);
select is(current_setting('t.d')::jsonb ->> 'business_name', 'Payslip Salon', 'the salon');
select is(current_setting('t.d')::jsonb ->> 'employee_code', 'RR-007', 'the staff ID');
select is(current_setting('t.d')::jsonb ->> 'period', current_setting('t.period'), 'the month');
select is((current_setting('t.d')::jsonb ->> 'tips_minor')::bigint, 300::bigint, 'tips kept: 5.00 less 2.00 given back');
select is(((current_setting('t.d')::jsonb ->> 'days_worked')::int, (current_setting('t.d')::jsonb ->> 'late_days')::int),
  (case when current_setting('t.today')::date - 1 >= to_date(current_setting('t.period'), 'YYYY-MM') then 2 else 1 end, 1),
  'days worked this month, and 1 late');
select is(current_setting('t.d')::jsonb ->> 'status', 'generated', 'not approved yet');

-- Who reads it.
select pg_temp.as_user('b1');
select throws_ok(format($$ select payslip_details('%s') $$, current_setting('t.line')), '42501', 'not_allowed',
  'Marie does not see a draft payslip');
select pg_temp.as_user('a0');
select approve_payroll(current_setting('t.run')::uuid, 'Approved early in a test');
select pg_temp.as_user('b1');
select is(payslip_details(current_setting('t.line')::uuid) ->> 'full_name', 'Marie', 'once approved, Marie reads hers');
select throws_ok(format($$ select payslip_details('%s') $$, current_setting('t.paruline')), '42501', 'not_allowed',
  'but not Paru''s');
select is((pay_extras(current_setting('t.marie')::uuid, current_setting('t.period')) ->> 'tips_minor')::bigint, 300::bigint,
  'My pay: tips this month');
select throws_ok(format($$ select pay_extras('%s', '%s') $$, current_setting('t.paru'), current_setting('t.period')),
  '42501', 'not_allowed', 'nobody else''s tips');
select pg_temp.as_user('b3');
select is(payslip_details(current_setting('t.line')::uuid) ->> 'full_name', 'Marie', 'the accountant reads payslips');
select pg_temp.as_user('b4');
select throws_ok(format($$ select payslip_details('%s') $$, current_setting('t.line')), '42501', 'not_allowed',
  'a manager does not (no salaries)');
select pg_temp.as_user('b5');
select throws_ok(format($$ select payslip_details('%s') $$, current_setting('t.line')), '42501', 'not_allowed',
  'nor does the front desk');

-- Paying with the day it was paid.
select pg_temp.as_user('a0');
select throws_ok(format($$ select pay_payroll_line('%s', 'bank', '%s') $$, current_setting('t.line'),
  current_setting('t.today')::date + 1), '22023', 'invalid_date', 'not a day still to come');
select throws_ok(format($$ select pay_payroll_line('%s', 'bank', '%s') $$, current_setting('t.line'),
  to_date(current_setting('t.period'), 'YYYY-MM') - 1), '22023', 'invalid_date', 'not before the month began');
select throws_ok(format($$ select pay_payroll_line('%s', 'cash', '%s') $$, current_setting('t.line'),
  current_setting('t.today')::date - 1), '22023', 'invalid_date', 'cash only today (it leaves today''s drawer)');
select set_config('t.paid', greatest(to_date(current_setting('t.period'), 'YYYY-MM'), current_setting('t.today')::date - 1)::text,
  false);
select lives_ok(format($$ select pay_payroll_line('%s', 'bank', '%s') $$, current_setting('t.line'), current_setting('t.paid')),
  'paid by bank on an earlier day of the month');
select is(payslip_details(current_setting('t.line')::uuid) ->> 'paid_on', current_setting('t.paid'), 'the payslip says Paid on that day');
select pg_temp.as_admin();
select is((select business_date::text from journal_entries where source_type = 'payroll_payment'
           and source_id = current_setting('t.line')::uuid), current_setting('t.paid'), 'and the books record it that day');
select pg_temp.as_user('a0');
select lives_ok(format($$ select pay_payroll_line('%s', 'cash') $$, current_setting('t.paruline')),
  'with no day given, it is paid today');

select * from finish();
rollback;
