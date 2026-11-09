-- Payroll changes since it was worked out (owner's app check A1, 9 Nov 2026): a sale, refund or pay change after the
-- work-out shows on the payroll and blocks approval until it is worked out again; an approved month stays as it is and
-- tells the owner the commission it missed. Owner and accountant may look; a cashier may not.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(15);
-- Internal helpers the sign-in roles cannot call, allowed inside this rolled-back test only.
grant execute on function public.branch_today(uuid) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000064' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'pay-changes-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1', 'c1', 'd1']) n;

create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000064' || p)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end $$;

select pg_temp.as_user('a0');
select set_config('t.b', (create_business('{"business_name":"Pay Changes Salon","owner_name":"Owner","mode":"ladies",
  "vat_mode":"off","opening_cash_minor":100000}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select set_config('t.period', to_char(branch_today(current_setting('t.br')::uuid), 'YYYY-MM'), false);
select pg_temp.as_service();
select set_config('t.emp', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'user_id', '00000000-0000-0000-0000-0000000064b1', 'username', 'paychstylist',
  'display_name', 'Status Stylist', 'role', 'staff', 'commission_bps', 3500)) ->> 'employee_id'), false);
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-0000000064c1', 'username', 'paychcash', 'display_name', 'Cashier', 'role', 'cashier'));
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-0000000064d1', 'username', 'paychacct', 'display_name', 'Accountant', 'role', 'accountant'));
select pg_temp.as_user('a0');
select save_employee(jsonb_build_object('business_id', current_setting('t.b'), 'id', current_setting('t.emp'),
  'full_name', 'Status Stylist', 'base_salary_minor', 200000));

create function pg_temp.sale() returns uuid language sql as $$
  select (create_sale(jsonb_build_object('branch_id', current_setting('t.br'), 'employee_id', current_setting('t.emp'),
    'lines', jsonb_build_array(jsonb_build_object('kind', 'custom', 'name', 'Blow dry', 'unit_price_minor', 4000,
                                                  'employee_id', current_setting('t.emp'))),
    'payments', '[{"method":"cash","amount_minor":4000}]'::jsonb)) ->> 'sale_id')::uuid
$$;
-- Everything in a test happens at one moment (now()), so "before" and "after" the work-out are set by moving times back.
create function pg_temp.work_out() returns uuid language plpgsql as $$
declare v uuid;
begin
  perform pg_temp.as_user('a0');
  v := generate_payroll(current_setting('t.b')::uuid, current_setting('t.period'));
  perform set_config('role', 'postgres', true);
  update payroll_runs set generated_at = now() - interval '30 minutes' where id = v;
  perform pg_temp.as_user('a0');
  perform set_config('t.run', v::text, false);
  return v;
end $$;
create function pg_temp.changes() returns jsonb language sql as $$ select payroll_changes(current_setting('t.run')::uuid) $$;

-- 1–2. One sale, then the month worked out: nothing changed since.
select set_config('t.s1', pg_temp.sale()::text, false);
reset role;
update sales set created_at = now() - interval '1 hour' where id = current_setting('t.s1')::uuid;
select pg_temp.work_out();
select is((pg_temp.changes() ->> 'stale')::boolean, false, 'just worked out: up to date');
select is((pg_temp.changes() ->> 'changes')::int, 0, 'no changes since');

-- 3–7. A sale after the work-out: the payroll says so and cannot be approved.
select set_config('t.s2', pg_temp.sale()::text, false);
select is((pg_temp.changes() ->> 'stale')::boolean, true, 'a sale after the work-out: out of date');
select is((pg_temp.changes() ->> 'changes')::int, 1, '1 change since it was worked out');
select throws_ok(format($$ select approve_payroll(%L) $$, current_setting('t.run')), '22023', 'payroll_changed',
  'approval is refused until it is worked out again');
select pg_temp.as_user('d1');
select lives_ok($$ select pg_temp.changes() $$, 'the accountant can see the changes');
select pg_temp.as_user('c1');
select throws_ok($$ select pg_temp.changes() $$, '42501', null, 'a cashier cannot');

-- 8–11. Worked out again it is up to date; a bonus after that makes it out of date again; then it is approved.
reset role;
update sales set created_at = now() - interval '40 minutes' where id = current_setting('t.s2')::uuid;
select pg_temp.work_out();
select is((pg_temp.changes() ->> 'stale')::boolean, false, 'worked out again: up to date');
select record_adjustment(jsonb_build_object('employee_id', current_setting('t.emp'), 'kind', 'bonus',
  'amount_minor', 2000, 'note', 'Top month'));
select is((pg_temp.changes() ->> 'stale')::boolean, true, 'a bonus after the work-out: out of date');
select is((pg_temp.changes() ->> 'changes')::int, 1, 'the bonus counts as a change');
reset role;
update payroll_adjustments set created_at = now() - interval '35 minutes' where employee_id = current_setting('t.emp')::uuid;
select pg_temp.work_out();
select lives_ok(format($$ select approve_payroll(%L) $$, current_setting('t.run')), 'worked out again, it is approved');

-- 12–15. A sale after approval: the approved month stays, and says what commission it missed.
select pg_temp.sale();
select is((pg_temp.changes() ->> 'stale')::boolean, false, 'an approved month is never "out of date"');
select is((pg_temp.changes() ->> 'missed_minor')::bigint, 1400::bigint, 'it missed 35% of the later QAR 40 sale');
select is(pg_temp.changes() -> 'missed' -> 0 ->> 'full_name', 'Status Stylist', 'for this person');
select is((select commission_minor from payroll_lines where run_id = current_setting('t.run')::uuid), 2800::bigint,
  'the approved commission is not changed');

select * from finish();
rollback;
