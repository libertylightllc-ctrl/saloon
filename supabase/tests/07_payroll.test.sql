-- Payroll: adjustments, advances out of the drawer, generate → approve → pay → journal, advances recovered,
-- commission less refunds, WPS proof, and who may see pay (a cashier never; staff only their own payslip).
begin;
create extension if not exists pgtap with schema extensions;
-- Paid plans are tested in 14_plans; here every salon may work.
select set_config('salon.plan_check', 'off', false);
select plan(42);
-- The checks below work out dates and codes with internal helpers that the app's sign-in roles cannot call (migration
-- 33); they are allowed here, inside this test's transaction only (rolled back at the end).
grant execute on function public.branch_today(uuid), public.branch_tz(uuid), public.business_today(uuid),
  public.compliance_readiness(uuid), public.plan_active(uuid), public.unique_business_code(text),
  public.post_journal(uuid, uuid, date, text, uuid, text, uuid, jsonb), public.branch_setting(uuid, text, jsonb)
  to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000060a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pr-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000060c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pr-cashier@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000060d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pr-staff@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000060f', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pr-staff2@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000060e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pr-acct@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

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
create function pg_temp.line(p_emp text) returns payroll_lines language sql as $$
  select * from payroll_lines where employee_id = p_emp::uuid
$$;

-- ── Setup: AED 1,000 in the drawer; Rafiq (3,500 + 10% commission, WPS), Imran (2,000), a cashier ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000060a');
select set_config('t.b', (create_business('{"business_name":"Payroll Salon","owner_name":"Owner","mode":"gents",
  "vat_mode":"off","opening_cash_minor":100000}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select set_config('t.period', to_char(branch_today(current_setting('t.br')::uuid), 'YYYY-MM'), false);
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-00000000060c', 'username', 'prcash', 'display_name', 'Cashier', 'role', 'cashier'));
select set_config('t.rafiq', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'user_id', '00000000-0000-0000-0000-00000000060d', 'username', 'prrafiq',
  'display_name', 'Rafiq', 'role', 'staff', 'commission_bps', 1000)) ->> 'employee_id'), false);
select set_config('t.imran', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'user_id', '00000000-0000-0000-0000-00000000060f', 'username', 'primran',
  'display_name', 'Imran', 'role', 'staff')) ->> 'employee_id'), false);
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-00000000060e', 'username', 'pracct', 'display_name', 'Accountant', 'role', 'accountant'));
select pg_temp.as_user('00000000-0000-0000-0000-00000000060a');
select save_employee(jsonb_build_object('business_id', current_setting('t.b'), 'id', current_setting('t.rafiq'),
  'full_name', 'Rafiq', 'base_salary_minor', 350000, 'wps_required', true));
select save_employee(jsonb_build_object('business_id', current_setting('t.b'), 'id', current_setting('t.imran'),
  'full_name', 'Imran', 'base_salary_minor', 200000));
-- Commission: two AED 100 sales by Rafiq (10% = 10.00 each); the second is refunded in full.
select set_config('t.s1', (create_sale(jsonb_build_object('branch_id', current_setting('t.br'), 'employee_id', current_setting('t.rafiq'),
  'lines', '[{"kind":"custom","name":"Fade","unit_price_minor":10000}]'::jsonb,
  'payments', '[{"method":"card","amount_minor":10000}]'::jsonb)) ->> 'sale_id'), false);
select set_config('t.s2', (create_sale(jsonb_build_object('branch_id', current_setting('t.br'), 'employee_id', current_setting('t.rafiq'),
  'lines', '[{"kind":"custom","name":"Fade","unit_price_minor":10000}]'::jsonb,
  'payments', '[{"method":"card","amount_minor":10000}]'::jsonb)) ->> 'sale_id'), false);
select refund_sale(jsonb_build_object('sale_id', current_setting('t.s2'), 'amount_minor', 10000, 'method', 'card',
  'reason', 'Unhappy'));

-- ── Adjustments ─────────────────────────────────────────────────────────────────────────
select lives_ok(format($$ select record_adjustment('{"employee_id":"%s","kind":"advance","amount_minor":50000,"method":"cash",
  "note":"Rent help","client_ref":"adv-1"}') $$, current_setting('t.rafiq')), 'owner gives Rafiq a AED 500 cash advance');
select is(expected_cash(current_setting('t.br')::uuid), 50000::bigint, 'the advance leaves the drawer');
select is((record_adjustment(jsonb_build_object('employee_id', current_setting('t.rafiq'), 'kind', 'advance',
  'amount_minor', 50000, 'method', 'cash', 'client_ref', 'adv-1')) ->> 'repeated')::boolean, true, 'a repeated tap gives it once');
select lives_ok(format($$ select record_adjustment('{"employee_id":"%s","kind":"bonus","amount_minor":20000,"note":"Top seller"}') $$,
  current_setting('t.rafiq')), 'a AED 200 bonus');
select lives_ok(format($$ select record_adjustment('{"employee_id":"%s","kind":"deduction","amount_minor":10000,"note":"Late days"}') $$,
  current_setting('t.rafiq')), 'a AED 100 deduction');
select set_config('t.bad', (record_adjustment(jsonb_build_object('employee_id', current_setting('t.imran'), 'kind', 'bonus',
  'amount_minor', 99900)) ->> 'adjustment_id'), false);
select lives_ok(format($$ select reverse_adjustment('%s', 'Entered by mistake') $$, current_setting('t.bad')),
  'a wrong bonus is reversed with a reason');

-- ── Who can see pay ──────────────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000060c');
select is((select count(*)::int from payroll_adjustments), 0, 'a cashier reads no pay adjustments');
select throws_ok(format($$ select record_adjustment('{"employee_id":"%s","kind":"bonus","amount_minor":100}') $$,
  current_setting('t.rafiq')), '42501', null, 'a cashier cannot add pay');
select pg_temp.as_user('00000000-0000-0000-0000-00000000060d');
select is((select count(*)::int from payroll_adjustments), 3, 'Rafiq sees his own advance, bonus and deduction');
select pg_temp.as_user('00000000-0000-0000-0000-00000000060f');
select is((select count(*)::int from payroll_adjustments), 0, 'Imran does not see Rafiq''s (his own was reversed)');

-- ── Generate (a draft; can be done again) ───────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000060a');
select set_config('t.run', generate_payroll(current_setting('t.b')::uuid, current_setting('t.period'))::text, false);
select results_eq(format($$ select base_minor, commission_minor, bonus_minor, deductions_minor, advances_minor, net_minor, wps_status
  from payroll_lines where employee_id = %L $$, current_setting('t.rafiq')),
  $$ values (350000::bigint, 1000::bigint, 20000::bigint, 10000::bigint, 50000::bigint, 311000::bigint, 'required'::text) $$,
  'Rafiq: 3,500 + 10 commission (refunded sale excluded) + 200 − 100 − 500 advance = 3,110');
select is((pg_temp.line(current_setting('t.imran'))).net_minor, 200000::bigint, 'Imran: 2,000 (the reversed bonus is not counted)');
select is(dashboard_today(current_setting('t.br')::uuid) -> 'payroll' ->> 'pending_period', current_setting('t.period'),
  'Home asks the owner to approve the month');
select is(pg_temp.account_balance('salaries_expense'), 0::bigint, 'a generated run posts nothing yet');
select lives_ok(format($$ select record_adjustment('{"employee_id":"%s","kind":"bonus","amount_minor":5000}') $$,
  current_setting('t.imran')), 'a late bonus for Imran');
select is(generate_payroll(current_setting('t.b')::uuid, current_setting('t.period'))::text, current_setting('t.run'),
  'generating again keeps the same run');
select is((pg_temp.line(current_setting('t.imran'))).net_minor, 205000::bigint, 'and picks up the bonus');
select throws_ok(format($$ select generate_payroll('%s', '2099-01') $$, current_setting('t.b')), '22023', 'invalid_date',
  'no payroll for a future month');

select pg_temp.as_user('00000000-0000-0000-0000-00000000060d');
select is((select count(*)::int from payroll_lines), 0, 'staff do not see a draft payslip');
select pg_temp.as_user('00000000-0000-0000-0000-00000000060c');
select is((select count(*)::int from payroll_lines), 0, 'a cashier cannot read payroll');
select is((select count(*)::int from payroll_runs), 0, 'nor payroll runs');
select throws_ok(format($$ select approve_payroll('%s') $$, current_setting('t.run')), '42501', null, 'a cashier cannot approve');

-- ── Approve → books ─────────────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000060a');
select lives_ok(format($$ select approve_payroll('%s') $$, current_setting('t.run')), 'owner approves the month');
select is(pg_temp.account_balance('salaries_expense'), 350000 + 20000 - 10000 + 200000 + 5000::bigint,
  'salaries expense = base + bonus − deductions');
select is(pg_temp.account_balance('commission_expense'), 1000::bigint, 'commission expense');
select is(pg_temp.account_balance('salaries_payable'), -(311000 + 205000)::bigint, 'salaries payable = net pay');
select is(pg_temp.account_balance('staff_advances'), 0::bigint, 'the advance is recovered');
select throws_ok(format($$ select generate_payroll('%s', '%s') $$, current_setting('t.b'), current_setting('t.period')), '22023',
  'payroll_approved', 'an approved month cannot be regenerated');
select throws_ok(format($$ select record_adjustment('{"employee_id":"%s","kind":"bonus","amount_minor":100}') $$,
  current_setting('t.rafiq')), '22023', 'payroll_approved', 'nor get new adjustments');

select pg_temp.as_user('00000000-0000-0000-0000-00000000060d');
select is((select net_minor from payroll_lines), 311000::bigint, 'Rafiq now sees his own payslip only');
select pg_temp.as_user('00000000-0000-0000-0000-00000000060e');
select is((select count(*)::int from payroll_lines), 2, 'the accountant sees every payslip');

-- ── Pay ─────────────────────────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000060a');
select lives_ok(format($$ select pay_payroll_line('%s', 'bank') $$, (pg_temp.line(current_setting('t.rafiq'))).id),
  'owner pays Rafiq by bank');
select lives_ok(format($$ select pay_payroll_line('%s', 'cash') $$, (pg_temp.line(current_setting('t.imran'))).id),
  'and Imran in cash');
select is(expected_cash(current_setting('t.br')::uuid), 50000 - 205000::bigint, 'cash pay leaves the drawer');
select is((dashboard_today(current_setting('t.br')::uuid) -> 'payroll' ->> 'wps_missing')::int, 1,
  'Home flags the WPS salary paid without proof');
select is(pg_temp.account_balance('salaries_payable'), 0::bigint, 'nothing left owed');
select is((select status from payroll_runs where id = current_setting('t.run')::uuid), 'paid', 'the month is paid');
select throws_ok(format($$ select pay_payroll_line('%s', 'cash') $$, (pg_temp.line(current_setting('t.imran'))).id), '22023',
  'invalid_status', 'nobody is paid twice');

-- ── WPS proof ────────────────────────────────────────────────────────────────────────────
insert into storage.objects (bucket_id, name, owner, metadata)
values ('documents', current_setting('t.b') || '/wps/rafiq.pdf', auth.uid(), '{"mimetype":"application/pdf","size":2000}');
select lives_ok(format($$ select attach_wps_evidence('%s', '%s/wps/rafiq.pdf') $$, (pg_temp.line(current_setting('t.rafiq'))).id,
  current_setting('t.b')), 'the bank transfer proof is attached');
select is((pg_temp.line(current_setting('t.rafiq'))).wps_status, 'proven', 'Rafiq''s WPS is proven');
select is((dashboard_today(current_setting('t.br')::uuid) -> 'payroll' ->> 'wps_missing')::int, 0, 'and Home stops asking');
select ok(pg_temp.balanced(), 'every journal entry balances');

select * from finish();
rollback;
