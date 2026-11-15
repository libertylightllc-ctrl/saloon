-- Part B, step 5 (owner's app check, 10 Nov 2026; brief B2 "Team"): each of the five login types tried on clocking
-- someone else in, fixing a missed clock-out, rosters, the staff list, payroll, password resets and login types, and
-- which jobs can be booked.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(65);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000073' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'team-roles-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(),
       '{}', '{}'
from unnest(array['a0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6']) n;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000073' || p)::uuid,
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
create function pg_temp.uid(p text) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-0000000073' || p)::uuid
$$;

select pg_temp.as_user('a0');
select set_config('t.b', (create_business('{"business_name":"Team Roles Salon","owner_name":"Owner","mode":"gents",
  "vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select set_my_pin(current_setting('t.b')::uuid, '2580');

-- Manager Mona (b1), front desk Dina (b2), stylists Sami (b3) and Rami (b5) in the branch; the accountant (b4);
-- stylist Zaid (b6) in a second branch; receptionist Rana on the staff list without a login.
select pg_temp.as_admin();
select set_config('t.today', branch_today(current_setting('t.br')::uuid)::text, false);
select set_config('t.period', to_char(current_setting('t.today')::date, 'YYYY-MM'), false);
with b as (insert into branches (business_id, name, mode, created_at)
           values (current_setting('t.b')::uuid, 'Second branch', 'gents', clock_timestamp()) returning id)
select set_config('t.br2', id::text, false) from b;
create function pg_temp.member(p_user text, p_role text, p_name text, p_branch text default 't.br') returns void
language plpgsql as $$
declare v uuid;
begin
  insert into members (business_id, user_id, role, display_name, username)
  values (current_setting('t.b')::uuid, pg_temp.uid(p_user), p_role::member_role, p_name, lower(p_name) || 'seventythree')
  returning id into v;
  perform set_config('t.m' || p_user, v::text, false);
  if p_role <> 'accountant' then
    insert into member_branches (member_id, branch_id) values (v, current_setting(p_branch)::uuid);
    insert into employees (business_id, branch_id, member_id, full_name, role_title, base_salary_minor, started_on)
    values (current_setting('t.b')::uuid, current_setting(p_branch)::uuid, v, p_name,
            case p_role when 'cashier' then 'cashier' when 'manager' then 'manager' else 'staff' end, 300000,
            (current_setting('t.period') || '-01')::date)
    returning id into v;
    perform set_config('t.e' || p_user, v::text, false);
  end if;
end $$;
select pg_temp.member('b1', 'manager', 'Mona'), pg_temp.member('b2', 'cashier', 'Dina'),
       pg_temp.member('b3', 'staff', 'Sami'), pg_temp.member('b4', 'accountant', 'Books'),
       pg_temp.member('b5', 'staff', 'Rami'), pg_temp.member('b6', 'staff', 'Zaid', 't.br2');
with e as (insert into employees (business_id, branch_id, full_name, role_title)
           values (current_setting('t.b')::uuid, current_setting('t.br')::uuid, 'Rana', 'receptionist') returning id)
select set_config('t.rana', id::text, false) from e;
select set_config('t.oa', (select id::text from members where user_id = pg_temp.uid('a0')), false);
select pg_temp.as_user('b1');
select set_my_pin(current_setting('t.b')::uuid, '1357');

-- 1. Clocking someone else in: owner and manager yes, the front desk with a manager's PIN, stylists never.
select pg_temp.as_user('b3');
select throws_ok(format($$ select clock('{"employee_id":"%s","action":"in"}') $$, current_setting('t.eb5')), '42501', null,
  'a stylist cannot clock a colleague in');
select lives_ok(format($$ select clock('{"employee_id":"%s","action":"in"}') $$, current_setting('t.eb3')),
  'but clocks themselves in');
select pg_temp.as_user('b2');
select throws_ok(format($$ select clock('{"employee_id":"%s","action":"in"}') $$, current_setting('t.eb5')), '42501',
  'approval_needed', 'the front desk needs a manager''s PIN to clock Rami in');
select is(approve_with_pin(current_setting('t.br')::uuid, current_setting('t.mb1')::uuid, '0000', 'clock_other') ->> 'error',
  'wrong_pin', 'a wrong PIN approves nothing');
select set_config('t.ap', approve_with_pin(current_setting('t.br')::uuid, current_setting('t.mb1')::uuid, '1357',
  'clock_other') ->> 'approval_id', false);
select is((clock(jsonb_build_object('employee_id', current_setting('t.eb5'), 'action', 'in',
  'approval_id', current_setting('t.ap'))) ->> 'clock_out'), null, 'with Mona''s PIN the front desk clocks Rami in');
select pg_temp.as_admin();
select is((select ref_id::text from approvals where id = current_setting('t.ap')::uuid), (select id::text from attendance
  where employee_id = current_setting('t.eb5')::uuid), 'the approval names the attendance it was used for');
select pg_temp.as_user('b2');
select throws_ok(format($$ select clock('{"employee_id":"%s","action":"break_start","approval_id":"%s"}') $$,
  current_setting('t.eb5'), current_setting('t.ap')), '42501', 'approval_needed', 'a PIN approval works once');
select lives_ok(format($$ select clock('{"employee_id":"%s","action":"in"}') $$, current_setting('t.eb2')),
  'the front desk clocks themselves in without a PIN');
select pg_temp.as_user('b1');
select lives_ok(format($$ select clock('{"employee_id":"%s","action":"break_start"}') $$, current_setting('t.eb5')),
  'a manager records a colleague''s break without a PIN');
select pg_temp.as_user('b1');
select throws_ok(format($$ select clock('{"employee_id":"%s","action":"in"}') $$, current_setting('t.eb6')), '42501', null,
  'a manager cannot clock in someone at another branch');

-- 2. Who reads attendance.
select pg_temp.as_user('b3');
select is((select count(*)::int from attendance), 1, 'a stylist sees only their own attendance');
select is((select count(*)::int from attendance_breaks), 0, 'and none of the others'' breaks');
select pg_temp.as_user('b5');
select is((select count(*)::int from attendance_breaks), 1, 'Rami sees his own break');
select pg_temp.as_user('b2');
select is((select count(*)::int from attendance), 3, 'the front desk sees the branch''s attendance');
select pg_temp.as_user('b4');
select is((select count(*)::int from attendance), 3, 'so does the accountant');
select pg_temp.as_user('b6');
select is((select count(*)::int from attendance), 0, 'a stylist at the other branch sees none');

-- 3. A clock-out missed yesterday: the owner, or a manager with a reason.
select pg_temp.as_admin();
insert into attendance (business_id, branch_id, employee_id, business_date, clock_in)
values (current_setting('t.b')::uuid, current_setting('t.br')::uuid, current_setting('t.eb3')::uuid,
        current_setting('t.today')::date - 1,
        ((current_setting('t.today')::date - 1) + time '10:00') at time zone 'Asia/Dubai');
select set_config('t.missed', (select id::text from attendance where employee_id = current_setting('t.eb3')::uuid
                               and business_date = current_setting('t.today')::date - 1), false);
select set_config('t.fixat', ((((current_setting('t.today')::date - 1) + time '19:00') at time zone 'Asia/Dubai'))::text, false);
select pg_temp.as_user('b2');
select throws_ok(format($$ select fix_clock_out('%s', '%s') $$, current_setting('t.missed'), current_setting('t.fixat')),
  '42501', null, 'the front desk cannot fix a missed clock-out');
select pg_temp.as_user('b3');
select throws_ok(format($$ select fix_clock_out('%s', '%s', 'I forgot') $$, current_setting('t.missed'),
  current_setting('t.fixat')), '42501', null, 'nor can the stylist themselves');
select pg_temp.as_user('b1');
select throws_ok(format($$ select fix_clock_out('%s', '%s') $$, current_setting('t.missed'), current_setting('t.fixat')),
  '22023', 'reason_required', 'a manager gives a reason');
select throws_ok(format($$ select fix_clock_out('%s', '%s', 'Forgot to clock out') $$, current_setting('t.missed'),
  current_setting('t.fixat')::timestamptz + interval '20 hours'), '22023', 'invalid_time',
  'and a time within 24 hours of the clock-in');
select is((fix_clock_out(current_setting('t.missed')::uuid, current_setting('t.fixat')::timestamptz,
  'Forgot to clock out') ->> 'clock_out')::timestamptz, current_setting('t.fixat')::timestamptz,
  'Mona sets Sami''s clock-out to 19:00');
select throws_ok(format($$ select fix_clock_out('%s', '%s', 'Again') $$, current_setting('t.missed'),
  current_setting('t.fixat')), '22023', 'invalid_status', 'a day with a clock-out is not fixed twice');
select throws_ok(format($$ select fix_clock_out('%s', '%s', 'Early') $$,
  (select id from attendance where employee_id = current_setting('t.eb5')::uuid and business_date = current_setting('t.today')::date),
  now()), '22023', 'invalid_status', 'today''s open day is clocked out the normal way');
select pg_temp.as_admin();
select ok(exists (select 1 from audit_log where entity_id = current_setting('t.missed')::uuid
                  and summary like '%by Mona: Forgot to clock out'), 'the audit log names who fixed it and why');

-- 4. Rosters: owner and manager set them; the front desk, manager and accountant read all, a stylist their own.
select pg_temp.as_user('b1');
select lives_ok(format($$ select set_roster('%s', '[{"weekday":1,"start":"10:00","end":"18:00"}]') $$,
  current_setting('t.eb3')), 'a manager sets a roster');
select lives_ok(format($$ select set_roster('%s', '[{"weekday":2,"start":"12:00","end":"20:00"}]') $$,
  current_setting('t.eb5')), 'and another');
select pg_temp.as_user('b2');
select throws_ok(format($$ select set_roster('%s', '[]') $$, current_setting('t.eb3')), '42501', null,
  'the front desk does not');
select is((select count(*)::int from rosters), 2, 'but reads every roster');
select pg_temp.as_user('b3');
select is((select weekday::int from rosters), 1, 'a stylist reads only their own');
select pg_temp.as_user('b4');
select is((select count(*)::int from rosters), 2, 'the accountant reads every roster');

-- 5. The staff list: salaries only for those who see pay.
select pg_temp.as_user('b1');
select is((select base_salary_minor from staff_directory(current_setting('t.b')::uuid)
           where employee_id = current_setting('t.eb3')::uuid), null, 'a manager sees the team without salaries');
select pg_temp.as_user('b4');
select is((select base_salary_minor from staff_directory(current_setting('t.b')::uuid)
           where employee_id = current_setting('t.eb3')::uuid), 300000::bigint, 'the accountant sees salaries');
select pg_temp.as_user('b2');
select throws_ok(format($$ select * from staff_directory('%s') $$, current_setting('t.b')), '42501', null,
  'the front desk has no staff list');
select pg_temp.as_user('b3');
select throws_ok(format($$ select * from staff_directory('%s') $$, current_setting('t.b')), '42501', null,
  'nor does a stylist');

-- 6. Payroll: the owner and the accountant work it out; only the owner approves; the accountant never pays cash.
select pg_temp.as_user('b1');
select throws_ok(format($$ select generate_payroll('%s', '%s') $$, current_setting('t.b'), current_setting('t.period')),
  '42501', null, 'a manager does not run payroll');
select throws_ok(format($$ select record_adjustment('{"employee_id":"%s","kind":"bonus","amount_minor":1000}') $$,
  current_setting('t.eb3')), '42501', null, 'nor give bonuses');
select pg_temp.as_user('b2');
select throws_ok(format($$ select record_adjustment('{"employee_id":"%s","kind":"bonus","amount_minor":1000}') $$,
  current_setting('t.eb3')), '42501', null, 'nor does the front desk');
select pg_temp.as_user('b4');
select lives_ok(format($$ select record_adjustment('{"employee_id":"%s","kind":"bonus","amount_minor":10000,"note":"Top seller"}') $$,
  current_setting('t.eb3')), 'the accountant records a bonus');
select throws_ok(format($$ select record_adjustment('{"employee_id":"%s","kind":"advance","amount_minor":5000,"method":"cash"}') $$,
  current_setting('t.eb5')), '42501', 'not_allowed', 'but not a cash advance from the drawer');
select set_config('t.run', generate_payroll(current_setting('t.b')::uuid, current_setting('t.period'))::text, false);
select is((select net_minor from payroll_lines where run_id = current_setting('t.run')::uuid
           and employee_id = current_setting('t.eb3')::uuid), 310000::bigint, 'the accountant works out the month');
select throws_ok(format($$ select approve_payroll('%s') $$, current_setting('t.run')), '42501', null,
  'but does not approve it');
select pg_temp.as_user('a0');
select lives_ok(format($$ select approve_payroll('%s') $$, current_setting('t.run')), 'the owner approves');
select pg_temp.as_user('b1');
select is((select count(*)::int from payroll_lines), 0, 'a manager reads no payslips');
select pg_temp.as_admin();
select set_config('t.line', (select id::text from payroll_lines where run_id = current_setting('t.run')::uuid
                             and employee_id = current_setting('t.eb3')::uuid), false);
select pg_temp.as_user('b1');
select throws_ok(format($$ select pay_payroll_line('%s', 'bank') $$, current_setting('t.line')), '42501', null,
  'a manager pays no salaries');
select pg_temp.as_user('b4');
select throws_ok(format($$ select pay_payroll_line('%s', 'cash') $$, current_setting('t.line')), '42501', 'not_allowed',
  'the accountant does not pay in cash');
select lives_ok(format($$ select pay_payroll_line('%s', 'bank') $$, current_setting('t.line')),
  'the accountant pays Sami by bank');

-- 7. Password resets and switching a login off (the staff-login server function asks login_admin_for).
select pg_temp.as_user('a0');
select throws_ok(format($$ select login_admin_for('%s', '%s') $$, pg_temp.uid('a0'), current_setting('t.mb2')), '42501',
  null, 'the app itself cannot call the check');
select pg_temp.as_service();
select is(login_admin_for(pg_temp.uid('a0'), current_setting('t.mb4')::uuid)::text, current_setting('t.oa'),
  'the owner resets anyone''s password (here the accountant''s)');
select is(login_admin_for(pg_temp.uid('b1'), current_setting('t.mb2')::uuid)::text, current_setting('t.mb1'),
  'a manager resets the front desk''s in their branch');
select is(login_admin_for(pg_temp.uid('b1'), current_setting('t.mb3')::uuid)::text, current_setting('t.mb1'),
  'and a stylist''s');
select throws_ok(format($$ select login_admin_for('%s', '%s') $$, pg_temp.uid('b1'), current_setting('t.mb6')), '42501',
  'not_allowed', 'but not a stylist''s at another branch');
select throws_ok(format($$ select login_admin_for('%s', '%s') $$, pg_temp.uid('b1'), current_setting('t.mb4')), '42501',
  'not_allowed', 'nor the accountant''s');
select throws_ok(format($$ select login_admin_for('%s', '%s') $$, pg_temp.uid('b1'), current_setting('t.oa')), '42501',
  'not_allowed', 'nor the owner''s');
select throws_ok(format($$ select login_admin_for('%s', '%s') $$, pg_temp.uid('b4'), current_setting('t.mb2')), '42501',
  'not_allowed', 'the accountant resets nobody''s');
select throws_ok(format($$ select login_admin_for('%s', '%s') $$, pg_temp.uid('b2'), current_setting('t.mb3')), '42501',
  'not_allowed', 'nor does the front desk');

-- 8. Changing a login's type: the owner only; nothing else about the person changes.
select pg_temp.as_user('b1');
select throws_ok(format($$ select set_login_type('%s', 'staff') $$, current_setting('t.mb2')), '42501', null,
  'a manager cannot change a login type');
select pg_temp.as_user('a0');
select throws_ok(format($$ select set_login_type('%s', 'owner') $$, current_setting('t.mb2')), '42501', null,
  'nobody is made an owner');
select is(set_login_type(current_setting('t.mb3')::uuid, 'manager') ->> 'role', 'manager', 'the owner makes Sami a manager');
select is((select count(*)::int from employees where member_id = current_setting('t.mb3')::uuid), 1,
  'he keeps his one staff record');
select is((select count(*)::int from attendance where employee_id = current_setting('t.eb3')::uuid), 2,
  'and his attendance');
select is(set_login_type(current_setting('t.mb4')::uuid, 'cashier') ->> 'role', 'cashier',
  'the accountant moved to the front desk');
select is((select role_title from employees where member_id = current_setting('t.mb4')::uuid), 'cashier',
  'gets a place on the staff list');

-- 9. Only jobs that take clients can be booked.
select is(array[takes_clients('staff'), takes_clients('manager'), takes_clients('therapist'), takes_clients('receptionist'),
                takes_clients('cashier'), takes_clients('assistant'), takes_clients('accountant')],
  array[true, true, true, false, false, false, false], 'stylists and managers take clients; desk jobs do not');
select set_config('t.slug', set_online_booking(current_setting('t.br')::uuid, true), false);
select is((select count(*)::int from jsonb_array_elements(public_booking_page(current_setting('t.slug')) -> 'staff') s
           where s ->> 'id' = current_setting('t.rana')), 0, 'the receptionist is not on the booking page');
select is((select count(*)::int from jsonb_array_elements(public_booking_page(current_setting('t.slug')) -> 'staff') s
           where s ->> 'id' = current_setting('t.eb5')), 1, 'a stylist is');

select * from finish();
rollback;
