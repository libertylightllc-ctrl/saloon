-- A clock action for "now" is never refused as earlier than what it follows (2026-10-19): the full proof's End break
-- was refused after the database server's clock stepped back a fraction of a second. Here the step is made by moving
-- the earlier time a little into the future. A time typed in by hand is still checked.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(10);
grant execute on function public.branch_today(uuid), public.branch_tz(uuid), public.business_today(uuid),
  public.unique_business_code(text), public.branch_setting(uuid, text, jsonb) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000040' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'clocknow-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1']) n;

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
-- The barber taps a button: no time sent, the server's "now".
create function pg_temp.tap(p_action text) returns jsonb language sql as $$
  select clock(jsonb_build_object('employee_id', current_setting('t.emp'), 'action', p_action))
$$;
create function pg_temp.day() returns attendance language sql as $$
  select * from attendance where employee_id = current_setting('t.emp')::uuid
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000040a0');
select set_config('t.b', (create_business('{"business_name":"Clock Salon","owner_name":"Owner","mode":"gents"}')
  ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_service();
select set_config('t.emp', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'user_id', '00000000-0000-0000-0000-0000000040b1', 'username', 'clockbarber',
  'display_name', 'Clock Barber', 'role', 'staff')) ->> 'employee_id'), false);

select pg_temp.as_user('00000000-0000-0000-0000-0000000040b1');
select lives_ok($$ select pg_temp.tap('in') $$, 'the barber clocks in');
-- The server's clock steps back: what was stamped a moment ago now reads as 2 seconds ahead.
select pg_temp.as_admin();
update attendance set clock_in = now() + interval '2 seconds' where employee_id = current_setting('t.emp')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-0000000040b1');
select lives_ok($$ select pg_temp.tap('break_start') $$, 'a break starts now, after clocking in');
select is((select started_at from attendance_breaks where attendance_id = (pg_temp.day()).id), (pg_temp.day()).clock_in,
  'not before the clock-in');
select lives_ok($$ select pg_temp.tap('break_end') $$, 'End break is not refused (the proof''s failure)');
select is((select count(*)::int from attendance_breaks where ended_at < started_at), 0, 'no break ends before it starts');

-- A time typed in by hand before the break began is still refused.
select lives_ok($$ select pg_temp.tap('break_start') $$, 'a second break');
select pg_temp.as_user('00000000-0000-0000-0000-0000000040a0');
select throws_ok(format($$ select clock(jsonb_build_object('employee_id', '%s', 'action', 'break_end', 'at', now() - interval '1 second')) $$,
  current_setting('t.emp')), '22023', 'invalid_time', 'the owner cannot type a time before the break began');

-- Clocking out and back to work "now" after another step back.
select pg_temp.as_user('00000000-0000-0000-0000-0000000040b1');
select lives_ok($$ select pg_temp.tap('out') $$, 'clocks out (ending the break)');
select pg_temp.as_admin();
update attendance set clock_out = now() + interval '3 seconds' where employee_id = current_setting('t.emp')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-0000000040b1');
select lives_ok($$ select pg_temp.tap('resume') $$, 'back to work is not refused');
select pg_temp.as_admin();
select is((select count(*)::int from attendance_breaks b join attendance a on a.id = b.attendance_id
           where a.employee_id = current_setting('t.emp')::uuid and (b.ended_at < b.started_at or b.started_at < a.clock_in)), 0,
  'every break lies inside the day, none runs backwards');

select * from finish();
rollback;
