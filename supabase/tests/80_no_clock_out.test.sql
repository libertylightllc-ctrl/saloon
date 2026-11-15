-- Part D1 (owner's app check, 9 Nov 2026): a shift left open is closed as "No clock-out" once its day has ended (at the
-- roster's end; no roster: the clock-in time), shows on Home for the owner and managers, and is fixed with the real time.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(20);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000080' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'no-clock-out-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1', 'b2', 'b3']) n;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000080' || p)::uuid,
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
    'user_id', ('00000000-0000-0000-0000-0000000080' || p_user)::uuid, 'username', lower(p_name) || 'eighty',
    'display_name', p_name, 'role', p_role)) ->> 'employee_id'
$$;
-- A local time on a day at the salon, as a moment.
create function pg_temp.at(p_day text, p_time text) returns timestamptz language sql as $$
  select (current_setting(p_day)::date + p_time::time) at time zone current_setting('t.tz')
$$;
create function pg_temp.shift(p_emp text, p_day text) returns attendance language sql as $$
  select * from attendance where employee_id = current_setting(p_emp)::uuid and business_date = current_setting(p_day)::date
$$;

select pg_temp.as_user('a0');
select set_config('t.b', (create_business('{"business_name":"No Clock Out Salon","owner_name":"Owner","mode":"ladies",
  "vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_admin();
select set_config('t.tz', branch_tz(current_setting('t.br')::uuid), false);
select set_config('t.today', branch_today(current_setting('t.br')::uuid)::text, false);
select set_config('t.yday', (current_setting('t.today')::date - 1)::text, false);
select pg_temp.as_service();
select set_config('t.marie', pg_temp.login('b1', 'staff', 'Marie'), false);
select pg_temp.login('b2', 'manager', 'Mona'), pg_temp.login('b3', 'cashier', 'Dina');
select pg_temp.as_user('a0');
select set_config('t.omar', save_employee(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'full_name', 'Omar'))::text, false);
select set_config('t.paru', save_employee(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'full_name', 'Paru'))::text, false);

-- Yesterday: Marie (rostered 10:00–19:00) clocked in at 09:55 and went on a break at 13:00; Omar (no roster) at 21:37.
-- Nobody clocked them out. Paru is in today.
select pg_temp.as_admin();
insert into rosters (employee_id, business_id, weekday, start_time, end_time)
values (current_setting('t.marie')::uuid, current_setting('t.b')::uuid, extract(dow from current_setting('t.yday')::date)::int,
        '10:00', '19:00');
insert into attendance (business_id, branch_id, employee_id, business_date, clock_in)
values (current_setting('t.b')::uuid, current_setting('t.br')::uuid, current_setting('t.marie')::uuid,
        current_setting('t.yday')::date, pg_temp.at('t.yday', '09:55')),
       (current_setting('t.b')::uuid, current_setting('t.br')::uuid, current_setting('t.omar')::uuid,
        current_setting('t.yday')::date, pg_temp.at('t.yday', '21:37')),
       (current_setting('t.b')::uuid, current_setting('t.br')::uuid, current_setting('t.paru')::uuid,
        current_setting('t.today')::date, least(now(), pg_temp.at('t.today', '00:01')));
insert into attendance_breaks (business_id, branch_id, attendance_id, started_at)
select business_id, branch_id, id, pg_temp.at('t.yday', '13:00') from attendance
where employee_id = current_setting('t.marie')::uuid;

-- The hourly job closes yesterday's open shifts.
select is((select count(*)::int from attendance where branch_id = current_setting('t.br')::uuid and clock_out is null
           and business_date < current_setting('t.today')::date), 2, 'two shifts were left open yesterday');
select role_alerts();
select is(((pg_temp.shift('t.marie', 't.yday')).clock_out, (pg_temp.shift('t.marie', 't.yday')).no_clock_out),
  (pg_temp.at('t.yday', '19:00'), true), 'Marie''s shift closes at the roster''s end, marked No clock-out');
select is((select ended_at from attendance_breaks where attendance_id = (pg_temp.shift('t.marie', 't.yday')).id),
  pg_temp.at('t.yday', '19:00'), 'and her open break ends then too');
select is(((pg_temp.shift('t.omar', 't.yday')).clock_out, (pg_temp.shift('t.omar', 't.yday')).no_clock_out),
  (pg_temp.at('t.yday', '21:37'), true), 'no roster: closed at the clock-in time (0 hours)');
select is((pg_temp.shift('t.paru', 't.today')).clock_out, null::timestamptz, 'today''s shift stays open');
select is(close_open_shifts(), 0, 'each shift is closed once');
select is((select count(*)::int from audit_log where entity_id = (pg_temp.shift('t.marie', 't.yday')).id
           and summary = 'Marie did not clock out on ' || to_char(current_setting('t.yday')::date, 'FMDD Mon')
                         || ': shift closed at 19:00'), 1, 'the audit trail says so');
select is((select count(*)::int from notifications n join members m on m.id = n.member_id
           where n.business_id = current_setting('t.b')::uuid and n.type = 'missed_clock_out' and m.role = 'manager'), 2,
  'the manager is told about both');

-- Where it shows.
select pg_temp.as_user('a0');
select is((select status from attendance_day(current_setting('t.br')::uuid, current_setting('t.yday')::date)
           where employee_id = current_setting('t.marie')::uuid), 'no_clock_out', 'that day shows No clock-out');
select is((dashboard_today(current_setting('t.br')::uuid) ->> 'missed_clock_outs')::int, 2, 'Home: 2 to fix (owner)');
select pg_temp.as_user('b2');
select is((dashboard_today(current_setting('t.br')::uuid) ->> 'missed_clock_outs')::int, 2, 'and for the manager');
select pg_temp.as_user('b3');
select is(dashboard_today(current_setting('t.br')::uuid) ->> 'missed_clock_outs', null, 'not for the front desk');
select pg_temp.as_user('b1');
select is(dashboard_today(current_setting('t.br')::uuid) ->> 'missed_clock_outs', null, 'nor for the stylist');

-- Fixing it with the real time: the manager gives a reason.
select pg_temp.as_user('b2');
select throws_ok(format($$ select fix_clock_out('%s', '%s') $$, (pg_temp.shift('t.marie', 't.yday')).id,
  pg_temp.at('t.yday', '18:30')), '22023', 'reason_required', 'a manager says why');
select lives_ok(format($$ select fix_clock_out('%s', '%s', 'Left at 6:30, forgot to clock out') $$,
  (pg_temp.shift('t.marie', 't.yday')).id, pg_temp.at('t.yday', '18:30')), 'fixed with the real time');
select pg_temp.as_admin();
select is(((pg_temp.shift('t.marie', 't.yday')).clock_out, (pg_temp.shift('t.marie', 't.yday')).no_clock_out),
  (pg_temp.at('t.yday', '18:30'), false), 'the shift ends at 18:30 and is no longer marked');
select is((select ended_at from attendance_breaks where attendance_id = (pg_temp.shift('t.marie', 't.yday')).id),
  pg_temp.at('t.yday', '18:30'), 'the break closed with it ends at the real time');
select is((select count(*)::int from notifications where entity_id = (pg_temp.shift('t.marie', 't.yday')).id
           and type = 'missed_clock_out' and (expires_at is null or expires_at > now())), 0, 'and the alert ends');
select pg_temp.as_user('b2');
select throws_ok(format($$ select fix_clock_out('%s', '%s', 'again please') $$, (pg_temp.shift('t.marie', 't.yday')).id,
  pg_temp.at('t.yday', '18:00')), '22023', 'invalid_status', 'a shift fixed once is not fixed again');
select is((dashboard_today(current_setting('t.br')::uuid) ->> 'missed_clock_outs')::int, 1, 'one left to fix');

select * from finish();
rollback;
