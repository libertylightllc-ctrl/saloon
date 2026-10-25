-- Times typed in on the attendance board count to the minute (2026-10-25): the board sends "15:04" (15:04:00); a
-- clock-in a few seconds earlier is 15:04:37. A break, clock-out or return typed in that same minute is accepted and
-- starts no earlier than the event it follows (the proof's failure: "Sameer Khan is on a break" was refused).
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(7);
grant execute on function public.branch_today(uuid), public.branch_tz(uuid), public.business_today(uuid),
  public.unique_business_code(text), public.branch_setting(uuid, text, jsonb) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000051' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'typed-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
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


select pg_temp.as_user('00000000-0000-0000-0000-0000000051a0');
select set_config('t.b', (create_business('{"business_name":"Typed Salon","owner_name":"Owner","mode":"gents"}')
  ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_service();
select set_config('t.emp', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'user_id', '00000000-0000-0000-0000-0000000051b1', 'username', 'typedbarber',
  'display_name', 'Typed Barber', 'role', 'staff')) ->> 'employee_id'), false);
-- The front desk (the owner) records each step with the time the board fills in: this minute, to the minute.
create function pg_temp.typed(p_action text) returns jsonb language sql as $$
  select clock(jsonb_build_object('employee_id', current_setting('t.emp'), 'action', p_action, 'at', date_trunc('minute', now())))
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000051a0');
-- Clocked in at 30 seconds past the minute.
select lives_ok(format($$ select clock(jsonb_build_object('employee_id', '%s', 'action', 'in', 'at', date_trunc('minute', now()) + interval '30 seconds')) $$,
  current_setting('t.emp')), 'clocked in at :30');
select lives_ok($$ select pg_temp.typed('break_start') $$, 'a break typed for the same minute is accepted');
select is((select started_at from attendance_breaks where attendance_id = (pg_temp.day()).id), (pg_temp.day()).clock_in,
  'and starts at the clock-in, not before it');
select lives_ok($$ select pg_temp.typed('break_end') $$, 'its end, typed for the same minute');
select lives_ok($$ select pg_temp.typed('out') $$, 'clocking out in the same minute');
select lives_ok($$ select pg_temp.typed('resume') $$, 'and back to work');
select pg_temp.as_admin();
select is((select count(*)::int from attendance_breaks b join attendance a on a.id = b.attendance_id
           where a.employee_id = current_setting('t.emp')::uuid and (b.ended_at < b.started_at or b.started_at < a.clock_in)), 0,
  'every break lies inside the day, none runs backwards');

select * from finish();
rollback;
