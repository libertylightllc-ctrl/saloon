-- Staff profiles, rosters and attendance: salaries only for owner and accountant, a roster decides who can be
-- booked, clocking in after the start plus grace is flagged late, staff clock only themselves.
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000050a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'st-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000050c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'st-cashier@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000050d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'st-staff@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000050e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'st-acct@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

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
-- Today at a local clock time, as an instant.
create function pg_temp.at(p_time text) returns timestamptz language sql as $$
  select (branch_today(current_setting('t.br')::uuid) + p_time::time) at time zone 'Asia/Dubai'
$$;
create function pg_temp.dow() returns int language sql as $$
  select extract(dow from branch_today(current_setting('t.br')::uuid))::int
$$;

-- ── Setup: open every day 00:00–23:59, a cashier, a barber, an accountant ─────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000050a');
select set_config('t.b', (create_business('{"business_name":"Staff Salon","owner_name":"Owner","mode":"gents",
  "vat_mode":"off","opening_hours":{"open":"00:00","close":"23:59","days":[0,1,2,3,4,5,6]}}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_service();
select set_config('t.cash_emp', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'user_id', '00000000-0000-0000-0000-00000000050c', 'username', 'stcash',
  'display_name', 'Faisal', 'role', 'cashier')) ->> 'employee_id'), false);
select set_config('t.emp', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'user_id', '00000000-0000-0000-0000-00000000050d', 'username', 'ststaff',
  'display_name', 'Rafiq', 'role', 'staff', 'commission_bps', 1200)) ->> 'employee_id'), false);
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-00000000050e', 'username', 'stacct', 'display_name', 'Accountant', 'role', 'accountant'));

-- ── Profiles and pay privacy ─────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000050a');
select lives_ok(format($$ select save_employee('{"business_id":"%s","id":"%s","full_name":"Rafiq Ahmed","employee_code":"E-014",
  "base_salary_minor":350000,"commission_bps":1500,"wps_required":true,"phone":"+971 50 123 4567"}') $$,
  current_setting('t.b'), current_setting('t.emp')), 'owner sets Rafiq''s salary, commission and WPS');
select set_config('t.new', save_employee(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'full_name', 'Sameer', 'role_title', 'staff', 'base_salary_minor', 300000))::text, false);
select is((select base_salary_minor from staff_directory(current_setting('t.b')::uuid) where employee_id = current_setting('t.emp')::uuid),
  350000::bigint, 'the owner sees the salary');
select is((select count(*)::int from audit_log where entity_type = 'employee' and summary like '%salary AED 0.00 → AED 3,500.00%'), 1,
  'the salary change is in the history');
select throws_ok(format($$ select save_employee('{"business_id":"%s","id":"%s","full_name":"Rafiq","commission_bps":12000}') $$,
  current_setting('t.b'), current_setting('t.emp')), '22023', 'invalid_commission', 'commission cannot pass 100%');

select pg_temp.as_user('00000000-0000-0000-0000-00000000050e');
select is((select base_salary_minor from staff_directory(current_setting('t.b')::uuid) where employee_id = current_setting('t.emp')::uuid),
  350000::bigint, 'the accountant sees the salary');
select pg_temp.as_user('00000000-0000-0000-0000-00000000050c');
select throws_ok(format($$ select * from staff_directory('%s') $$, current_setting('t.b')), '42501', null,
  'a cashier cannot open the staff pay list');
select throws_ok($$ select base_salary_minor from employees $$, '42501', null, 'a cashier cannot read salaries');
select is((select full_name from employees where id = current_setting('t.emp')::uuid), 'Rafiq Ahmed',
  'but sees who works there');
select pg_temp.as_user('00000000-0000-0000-0000-00000000050d');
select throws_ok($$ select base_salary_minor from employees $$, '42501', null, 'staff cannot read salaries');
select throws_ok(format($$ select save_employee('{"business_id":"%s","id":"%s","full_name":"Rafiq","base_salary_minor":999999}') $$,
  current_setting('t.b'), current_setting('t.emp')), '42501', null, 'staff cannot change pay');

-- ── Rosters decide who can be booked ─────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000050a');
select lives_ok(format($$ select set_roster('%s', '[{"weekday":%s,"start":"09:00","end":"13:00"}]') $$,
  current_setting('t.emp'), pg_temp.dow()), 'Rafiq works 09:00–13:00 today''s weekday');
select lives_ok(format($$ select set_roster('%s', '[{"weekday":%s,"start":"14:00","end":"18:00"}]') $$,
  current_setting('t.new'), mod(pg_temp.dow() + 1, 7)), 'Sameer works only tomorrow''s weekday');
select throws_ok(format($$ select set_roster('%s', '[{"weekday":1,"start":"09:00","end":"09:00"}]') $$,
  current_setting('t.emp')), '22023', 'invalid_roster', 'a shift must have a length');
select is((select jsonb_array_length(roster) from staff_directory(current_setting('t.b')::uuid) where employee_id = current_setting('t.emp')::uuid),
  1, 'the directory shows the roster');
-- Next week, same weekday as today: slots for Rafiq only inside his shift.
select is((select array_agg(slot order by slot) from available_slots(current_setting('t.br')::uuid,
    branch_today(current_setting('t.br')::uuid) + 7, 60, current_setting('t.emp')::uuid) where available),
  array['09:00','09:30','10:00','10:30','11:00','11:30','12:00'], 'Rafiq can be booked only 09:00–13:00');
select is((select available from available_slots(current_setting('t.br')::uuid, branch_today(current_setting('t.br')::uuid) + 7,
    30, null) where slot = '15:00'), false, 'nobody is rostered at 15:00 that day, so "any" is not free');
select is((select available from available_slots(current_setting('t.br')::uuid, branch_today(current_setting('t.br')::uuid) + 8,
    30, null) where slot = '15:00'), true, 'the next day Sameer is rostered at 15:00');
select is((select available from available_slots(current_setting('t.br')::uuid, branch_today(current_setting('t.br')::uuid) + 7,
    30, null) where slot = '09:00'), true, 'and Rafiq covers 09:00');

-- ── Attendance ──────────────────────────────────────────────────────────────────────────
-- Rafiq's shift today started 40 minutes ago; the cashier records him in 15 minutes ago → 25 min late.
-- (Within 40 minutes after local midnight the shift would start yesterday, so those checks are skipped.)
select set_config('t.ok', ((now() at time zone 'Asia/Dubai')::time >= '00:45')::text, false);
select set_config('t.start', to_char(date_trunc('minute', now() at time zone 'Asia/Dubai') - interval '40 minutes', 'HH24:MI'), false);
select pg_temp.as_user('00000000-0000-0000-0000-00000000050a');
select set_roster(current_setting('t.emp')::uuid, jsonb_build_array(jsonb_build_object('weekday', pg_temp.dow(),
  'start', current_setting('t.start'), 'end', '23:59')));
select pg_temp.as_user('00000000-0000-0000-0000-00000000050c');
select case when current_setting('t.ok')::boolean
  then is((clock(jsonb_build_object('employee_id', current_setting('t.emp'), 'action', 'in',
            'at', date_trunc('minute', now()) - interval '15 minutes')) ->> 'late')::boolean, true,
          'clocking in 25 minutes after the shift start is late (grace 10)')
  else skip('near local midnight', 1) end;
select case when current_setting('t.ok')::boolean
  then is((select late_minutes from attendance where employee_id = current_setting('t.emp')::uuid), 25, 'by 25 minutes')
  else skip('near local midnight', 1) end;
select case when current_setting('t.ok')::boolean
  then throws_ok(format($$ select clock('{"employee_id":"%s","action":"in"}') $$, current_setting('t.emp')), '22023',
                 'already_clocked_in', 'no second clock-in the same day')
  else skip('near local midnight', 1) end;
select throws_ok(format($$ select clock('{"employee_id":"%s","action":"in","at":"%s"}') $$,
  current_setting('t.cash_emp'), now() + interval '2 hours'), '22023', 'invalid_time', 'no clocking in the future');
-- The cashier clocks in right now: no roster → never late.
select is((clock(jsonb_build_object('employee_id', current_setting('t.cash_emp'), 'action', 'in')) ->> 'late')::boolean, false,
  'without a roster nobody is late');

select pg_temp.as_user('00000000-0000-0000-0000-00000000050d');
select throws_ok(format($$ select clock('{"employee_id":"%s","action":"out"}') $$, current_setting('t.cash_emp')), '42501', null,
  'staff cannot clock someone else');
select throws_ok(format($$ select clock('{"employee_id":"%s","action":"out","at":"%s"}') $$,
  current_setting('t.emp'), now() - interval '3 minutes'), '22023', null, 'staff cannot back-date their own clock');
select case when current_setting('t.ok')::boolean
  then is((select count(*)::int from attendance), 1, 'staff see only their own attendance')
  else skip('near local midnight', 1) end;
select case when current_setting('t.ok')::boolean
  then is((select string_agg(status, ',') from attendance_day(current_setting('t.br')::uuid)), 'on_shift',
          'and only their own row on the board')
  else skip('near local midnight', 1) end;

select pg_temp.as_user('00000000-0000-0000-0000-00000000050c');
select is((clock(jsonb_build_object('employee_id', current_setting('t.cash_emp'), 'action', 'out')) ->> 'clock_out') is not null, true,
  'the cashier clocks out');
select is((select status from attendance_day(current_setting('t.br')::uuid) where employee_id = current_setting('t.cash_emp')::uuid),
  'done', 'the board shows the cashier done for the day');
select is((select status from attendance_day(current_setting('t.br')::uuid) where employee_id = current_setting('t.new')::uuid),
  'off', 'Sameer is off today (rostered on another day)');
select throws_ok(format($$ select clock('{"employee_id":"%s","action":"out"}') $$, current_setting('t.cash_emp')), '22023',
  'not_clocked_in', 'no clocking out twice');

-- Shifts that run past midnight: a moment after midnight belongs to yesterday's shift while it is still going.
select pg_temp.as_user('00000000-0000-0000-0000-00000000050a');
select set_roster(current_setting('t.new')::uuid, '[{"weekday":1,"start":"22:00","end":"06:00"},{"weekday":2,"start":"10:00","end":"18:00"}]');
select pg_temp.as_admin();
-- 2026-09-29 is a Tuesday (2); Monday's shift runs 22:00 → Tuesday 06:00.
select results_eq(format($$ select * from shift_at(%L, '2026-09-29 00:30') $$, current_setting('t.new')),
  $$ values ('2026-09-28 22:00'::timestamp, '2026-09-29 06:00'::timestamp) $$,
  'at 00:30 on Tuesday the barber is on Monday''s night shift');
select results_eq(format($$ select * from shift_at(%L, '2026-09-29 09:00') $$, current_setting('t.new')),
  $$ values ('2026-09-29 10:00'::timestamp, '2026-09-29 18:00'::timestamp) $$,
  'after it ends, Tuesday''s own shift applies');
select is((select shift_start from shift_at(current_setting('t.new')::uuid, '2026-10-01 12:00')), null,
  'no shift on a day off');

select case when current_setting('t.ok')::boolean
  then is((select count(*)::int from audit_log where entity_type = 'attendance' and summary like 'Rafiq Ahmed clocked in%recorded by Faisal'),
          1, 'recording for someone else names who recorded it')
  else skip('near local midnight', 1) end;

select * from finish();
rollback;
