-- Test salons (owner's final brief E1): a platform owner marks a salon as a test salon; it is left out of every Overview
-- number and of the pilot's places, and back in when unmarked. Only platform owners can see or change the mark, and
-- each change is in Console → Changes.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(22);
grant execute on function public.branch_today(uuid), public.business_today(uuid), public.unique_business_code(text),
  public.post_journal(uuid, uuid, date, text, uuid, text, uuid, jsonb), public.branch_setting(uuid, text, jsonb)
  to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000600a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ts-admin@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}', '{}'),
  ('00000000-0000-0000-0000-00000000600b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ts-real@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}', '{}'),
  ('00000000-0000-0000-0000-00000000600c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ts-test@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}', '{}');

create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
-- One Overview number, or AED in plan payments received.
create function pg_temp.n(p_key text) returns int language sql as $$ select (admin_overview() ->> p_key)::int $$;
create function pg_temp.aed_income() returns bigint language sql as $$
  select coalesce((select (x ->> 'total_minor')::bigint from jsonb_array_elements(admin_overview() -> 'plan_income') x
                   where x ->> 'currency' = 'AED'), 0) $$;

-- A real salon and one the owner tests with: the test one is a pilot salon, has paid once and is asking for a plan.
select pg_temp.as_user('00000000-0000-0000-0000-00000000600b');
select set_config('t.real', (create_business('{"business_name":"Real Salon","owner_name":"Real","mode":"gents","vat_mode":"off"}') ->> 'business_id'), false);
select pg_temp.as_user('00000000-0000-0000-0000-00000000600c');
select set_config('t.test', (create_business('{"business_name":"Test Salon","owner_name":"Tester","mode":"gents","vat_mode":"off"}') ->> 'business_id'), false);
select pg_temp.as_admin();
insert into platform_admins (user_id) values ('00000000-0000-0000-0000-00000000600a') on conflict do nothing;
select set_config('t.max', (select pilot_max_salons::text from platform_settings), false);
insert into subscriptions (business_id, paid_until, trial, access_type, free_until)
values (current_setting('t.test')::uuid, null, false, 'pilot', current_date + 60)
on conflict (business_id) do update set access_type = 'pilot', free_until = current_date + 60;
insert into plan_events (business_id, kind, months, amount_minor, currency) values
  (current_setting('t.test')::uuid, 'activate', 1, 5000, 'AED'),
  (current_setting('t.test')::uuid, 'request', 1, 5000, 'AED');

-- Salon owners cannot see or change the mark.
select pg_temp.as_user('00000000-0000-0000-0000-00000000600c');
select throws_ok(format($$ select admin_set_test_salon('%s', false) $$, current_setting('t.test')), '42501', null,
  'a salon owner cannot mark or unmark a test salon');
select throws_ok($$ select * from admin_test_salons() $$, '42501', null, 'nor list the test salons');
select throws_ok($$ select * from test_salons $$, '42501', null, 'nor read the marks directly');

-- The Overview before.
select pg_temp.as_user('00000000-0000-0000-0000-00000000600a');
create temporary table before_mark as
select pg_temp.n('salons') salons, pg_temp.n('salons_pilot') pilot, pg_temp.n('pilot_places_left') places,
       pg_temp.n('branches') branches, pg_temp.n('accounts') accounts, pg_temp.n('owners') owners,
       pg_temp.n('signups_7d') signups, pg_temp.n('plan_requests_open') requests, pg_temp.n('salons_test') tests,
       pg_temp.aed_income() income,
       (select (c ->> 'salons')::int from jsonb_array_elements(admin_overview() -> 'countries') c where c ->> 'code' = 'AE') ae;
grant select on before_mark to authenticated;

-- Marked: left out of every number, and of the pilot's places.
select is(admin_set_test_salon(current_setting('t.test')::uuid, true), true, 'a platform owner marks the salon as a test salon');
select ok(current_setting('t.test')::uuid in (select business_id from admin_test_salons()), 'it is listed as a test salon');
select is(pg_temp.n('salons'), (select salons - 1 from before_mark), 'it is not counted among the salons');
select is(pg_temp.n('salons_test'), (select tests + 1 from before_mark), 'the Overview says one test salon is left out');
select is(pg_temp.n('branches'), (select branches - 1 from before_mark), 'nor its branch');
select is(pg_temp.n('owners'), (select owners - 1 from before_mark), 'nor its owner');
select is(pg_temp.n('accounts'), (select accounts - 1 from before_mark), 'nor an account that is only in test salons');
select is(pg_temp.n('signups_7d'), (select signups - 1 from before_mark), 'nor among the sign-ups');
select is(pg_temp.n('plan_requests_open'), (select requests - 1 from before_mark), 'nor its plan request');
select is(pg_temp.aed_income(), (select income - 5000 from before_mark), 'nor its plan payment');
select is((select (c ->> 'salons')::int from jsonb_array_elements(admin_overview() -> 'countries') c where c ->> 'code' = 'AE'),
  (select ae - 1 from before_mark), 'nor in salons by country');
select is(pg_temp.n('salons_pilot'), (select pilot - 1 from before_mark), 'it holds no pilot place');
select is(pg_temp.n('pilot_places_left'), (select greatest(current_setting('t.max')::int - (pilot - 1), 0) from before_mark),
  'so the places left are counted without it');

-- Logged once per change; marking again changes nothing.
select is(admin_set_test_salon(current_setting('t.test')::uuid, true), true, 'marking it again is fine');
select pg_temp.as_admin();
select is((select count(*)::int from platform_audit where action = 'salon:test' and business_id = current_setting('t.test')::uuid
           and before = '{"test": false}' and after = '{"test": true}' and actor = '00000000-0000-0000-0000-00000000600a'),
  1, 'the change is in Console → Changes once, with who made it');

-- Unmarked: counted again.
select pg_temp.as_user('00000000-0000-0000-0000-00000000600a');
select is(admin_set_test_salon(current_setting('t.test')::uuid, false), false, 'and unmarks it');
select is(pg_temp.n('salons'), (select salons from before_mark), 'it is counted again');
select is(pg_temp.n('accounts'), (select accounts from before_mark), 'and so is its owner''s account');
select throws_ok($$ select admin_set_test_salon('00000000-0000-0000-0000-0000000060ff', true) $$, 'P0002', null,
  'an unknown salon is refused');

select * from finish();
rollback;
