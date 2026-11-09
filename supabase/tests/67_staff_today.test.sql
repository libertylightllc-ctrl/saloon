-- Home → Staff today and the attendance board follow the roster and the clock (owner's app check A5 and D3, 9 Nov
-- 2026): someone on their day off is "off", not "available"; a shift nobody clocked in to is "late_not_in" once it is
-- past the grace minutes and "absent" once it has ended; "not_in" only before the shift starts.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(8);
-- Internal helpers the sign-in roles cannot call, allowed inside this rolled-back test only.
grant execute on function public.branch_today(uuid), public.branch_tz(uuid) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000067a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'staff-today@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000067a0',
  'role', 'authenticated')::text, false);
set role authenticated;

select set_config('t.b', (create_business('{"business_name":"Staff Today Salon","owner_name":"Owner","mode":"ladies",
  "vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
create function pg_temp.person(p_name text) returns uuid language sql as $$
  select save_employee(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
    'full_name', p_name, 'role_title', 'staff'))
$$;
select set_config('t.' || n, pg_temp.person(n)::text, false)
from unnest(array['dayoff', 'late', 'absent', 'later', 'noroster', 'clocked']) n;

-- Rosters around the salon's local time now. The salon is put in a time zone where it is about midday, so no shift
-- crosses midnight whenever the test runs (the skips below are only a guard).
reset role;
update businesses set timezone = 'Etc/GMT' || case when 12 - extract(hour from now() at time zone 'UTC')::int <= 0
                                                    then '+' || (extract(hour from now() at time zone 'UTC')::int - 12)
                                                    else '-' || (12 - extract(hour from now() at time zone 'UTC')::int) end
where id = current_setting('t.b')::uuid;
select set_config('t.now', (now() at time zone branch_tz(current_setting('t.br')::uuid))::text, false);
select set_config('t.dow', extract(dow from current_setting('t.now')::timestamp)::text, false);
select set_config('t.ok', (extract(hour from current_setting('t.now')::timestamp) between 3 and 20)::text, false);
create function pg_temp.roster(p text, p_dow int, p_from interval, p_to interval) returns void language sql as $$
  insert into rosters (employee_id, business_id, weekday, start_time, end_time)
  values (current_setting('t.' || p)::uuid, current_setting('t.b')::uuid, p_dow,
          (current_setting('t.now')::timestamp + p_from)::time, (current_setting('t.now')::timestamp + p_to)::time)
$$;
select pg_temp.roster('dayoff', (current_setting('t.dow')::int + 1) % 7, interval '-1 hour', interval '1 hour');
select pg_temp.roster('late', current_setting('t.dow')::int, interval '-1 hour', interval '1 hour');
select pg_temp.roster('absent', current_setting('t.dow')::int, interval '-2 hours', interval '-1 hour');
select pg_temp.roster('later', current_setting('t.dow')::int, interval '1 hour', interval '2 hours');
select pg_temp.roster('clocked', current_setting('t.dow')::int, interval '-1 hour', interval '1 hour');
insert into attendance (business_id, branch_id, employee_id, business_date, clock_in, late, late_minutes)
values (current_setting('t.b')::uuid, current_setting('t.br')::uuid, current_setting('t.clocked')::uuid,
        branch_today(current_setting('t.br')::uuid), now() - interval '20 minutes', true, 40);
set role authenticated;

create function pg_temp.home(p text) returns jsonb language sql as $$
  select x from jsonb_array_elements(dashboard_today(current_setting('t.br')::uuid) -> 'staff_today') x
  where x ->> 'employee_id' = current_setting('t.' || p)
$$;
create function pg_temp.board(p text) returns text language sql as $$
  select status from attendance_day(current_setting('t.br')::uuid) where employee_id = current_setting('t.' || p)::uuid
$$;

select is(pg_temp.home('dayoff') ->> 'status', 'off', 'a day off is "off" on Home, not available');
select is(pg_temp.home('noroster') ->> 'status', 'available', 'someone with no roster at all is still "available"');
select is((pg_temp.home('clocked') ->> 'late_minutes')::int, 40, 'clocked in late: on Home with the minutes');
select case when current_setting('t.ok')::boolean
  then is(pg_temp.home('late') ->> 'status', 'late_not_in', 'an hour into the shift, not clocked in: late and not in')
  else skip('near midnight a shift would cross days', 1) end;
select case when current_setting('t.ok')::boolean
  then is(pg_temp.home('absent') ->> 'status', 'absent', 'the shift has ended with no clock-in: absent')
  else skip('near midnight a shift would cross days', 1) end;
select case when current_setting('t.ok')::boolean
  then is(pg_temp.home('later') ->> 'status', 'not_in', 'the shift starts later: not in yet')
  else skip('near midnight a shift would cross days', 1) end;
select case when current_setting('t.ok')::boolean
  then is(pg_temp.board('absent'), 'absent', 'the attendance board says absent too')
  else skip('near midnight a shift would cross days', 1) end;
select is(pg_temp.board('dayoff'), 'off', 'and day off');

select * from finish();
rollback;
