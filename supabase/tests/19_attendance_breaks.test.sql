-- Breaks and a safer clock-out (owner, 2026-10-01): breaks while on shift, clocking out ends an open break, and
-- "back to work" after clocking out continues the day with the time away recorded as a break.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000019' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'break-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1', 'c2']) n;

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
-- A moment today, as a share of the time since the branch's midnight (so every moment is today and in the past).
create function pg_temp.at(p_share numeric) returns timestamptz language sql as $$
  select d + (now() - d) * p_share
  from (select (branch_today(current_setting('t.br')::uuid)::timestamp at time zone branch_tz(current_setting('t.br')::uuid)) d) x
$$;
create function pg_temp.clock(p_action text, p_share numeric) returns jsonb language sql as $$
  select clock(jsonb_build_object('employee_id', current_setting('t.emp'), 'action', p_action, 'at', pg_temp.at(p_share)))
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000019a0');
select set_config('t.b', (create_business('{"business_name":"Break Salon","owner_name":"Owner","mode":"gents"}')
  ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_service();
select set_config('t.emp', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'user_id', '00000000-0000-0000-0000-0000000019b1', 'username', 'breakbarber',
  'display_name', 'Break Barber', 'role', 'staff')) ->> 'employee_id'), false);
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-0000000019c2', 'username', 'breakcash', 'display_name', 'Break Cashier', 'role', 'cashier'));

-- The owner records the day (times earlier today).
select pg_temp.as_user('00000000-0000-0000-0000-0000000019a0');
select lives_ok($$ select pg_temp.clock('in', 0.10) $$, 'clocked in');
select lives_ok($$ select pg_temp.clock('break_start', 0.30) $$, 'a break starts');
select results_eq($$ select status from attendance_day(current_setting('t.br')::uuid) where employee_id = current_setting('t.emp')::uuid $$,
  $$ values ('on_break'::text) $$, 'the board shows the break');
select throws_ok($$ select pg_temp.clock('break_start', 0.32) $$, '22023', 'on_break', 'one break at a time');
select lives_ok($$ select pg_temp.clock('break_end', 0.40) $$, 'and ends');
select throws_ok($$ select pg_temp.clock('break_end', 0.42) $$, '22023', 'not_on_break', 'a break cannot end twice');
select lives_ok($$ select pg_temp.clock('break_start', 0.50) $$, 'a second break');
select lives_ok($$ select pg_temp.clock('out', 0.60) $$, 'clocking out while on it');
select results_eq($$ select status, break_minutes from attendance_day(current_setting('t.br')::uuid)
  where employee_id = current_setting('t.emp')::uuid $$,
  $$ select 'done'::text, floor((extract(epoch from pg_temp.at(0.40) - pg_temp.at(0.30))
                                + extract(epoch from pg_temp.at(0.60) - pg_temp.at(0.50))) / 60)::int $$,
  'ends the break; both breaks add up (whole minutes of their total)');

-- Clocked out by mistake: back to work, the time away becomes a break.
select lives_ok($$ select pg_temp.clock('resume', 0.80) $$, 'back to work');
select results_eq($$ select status, clock_out is null from attendance_day(current_setting('t.br')::uuid)
  where employee_id = current_setting('t.emp')::uuid $$, $$ values ('on_shift'::text, true) $$, 'the day goes on');
select is((select count(*)::int from attendance_breaks where attendance_id =
  (select id from attendance where employee_id = current_setting('t.emp')::uuid)), 3, 'the time away is a third break');
select throws_ok($$ select pg_temp.clock('resume', 0.85) $$, '22023', 'not_clocked_in', 'only after clocking out');

-- The cashier records a break for the barber.
select pg_temp.as_user('00000000-0000-0000-0000-0000000019c2');
select lives_ok($$ select pg_temp.clock('break_start', 0.90) $$, 'the cashier records a break for the barber');

select * from finish();
rollback;
