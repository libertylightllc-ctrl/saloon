-- No opening and closing times: bookings any time of an open day, or within rosters (a shift past midnight covers
-- the next morning); the owner changes the open days in branch settings.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(11);
grant execute on function public.branch_today(uuid), public.business_today(uuid), public.unique_business_code(text),
  public.branch_setting(uuid, text, jsonb) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000310a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'od-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000310c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'od-cashier@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

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
create function pg_temp.slots(p_days int, p_employee uuid default null) returns setof text language sql as $$
  select slot from available_slots(current_setting('t.br')::uuid, branch_today(current_setting('t.br')::uuid) + p_days,
                                   30, p_employee)
$$;
create function pg_temp.dow(p_days int) returns int language sql as $$
  select extract(dow from branch_today(current_setting('t.br')::uuid) + p_days)::int
$$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000310a');
select set_config('t.b', (create_business('{"business_name":"Open Days Salon","owner_name":"Owner","mode":"gents","vat_mode":"off",
  "opening_hours":{"days":[0,1,2,3,4,5,6]}}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-00000000310c', 'username', 'odcash', 'display_name', 'Cashier', 'role', 'cashier'));

-- Nobody to book yet: the whole day, every half hour.
select pg_temp.as_user('00000000-0000-0000-0000-00000000310a');
select is((select count(*)::int from pg_temp.slots(2)), 48, 'any time of an open day: 00:00 to 23:30');
select is((select min(s) || '–' || max(s) from pg_temp.slots(2) s), '00:00–23:30', 'from midnight to the last half hour');

-- Times stored by older versions are not used.
select pg_temp.as_admin();
update branches set opening_hours = '{"open":"18:00","close":"02:00","days":[0,1,2,3,4,5,6]}' where id = current_setting('t.br')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-00000000310a');
select is((select count(*)::int from pg_temp.slots(2)), 48, 'old opening and closing times no longer limit bookings');

-- The owner changes the open days; a closed day offers nothing.
select lives_ok(format($$ select update_branch('%s', '{"open_days":[%s, 1, 1]}') $$, current_setting('t.br'), pg_temp.dow(3)),
  'the owner sets the open days');
select is((select count(*)::int from pg_temp.slots(2)), case when pg_temp.dow(2) = 1 then 48 else 0 end,
  'a closed day offers no times');
select is((select opening_hours -> 'days' from branches where id = current_setting('t.br')::uuid),
  (select jsonb_agg(d order by d) from (select distinct unnest(array[pg_temp.dow(3), 1]) d) x),
  'the days are kept once each, in order');
select throws_ok(format($$ select update_branch('%s', '{"open_days":[]}') $$, current_setting('t.br')),
  '22023', 'days_required', 'at least one open day');
select throws_ok(format($$ select update_branch('%s', '{"open_days":[7]}') $$, current_setting('t.br')),
  '22023', 'days_required', 'only weekdays 0 to 6');
select pg_temp.as_user('00000000-0000-0000-0000-00000000310c');
select throws_ok(format($$ select update_branch('%s', '{"open_days":[1]}') $$, current_setting('t.br')),
  '42501', null, 'a cashier cannot change the open days');

-- A barber rostered 22:00 to 02:00: the evening, and the next morning until 01:30 (the next day must be open too).
select pg_temp.as_user('00000000-0000-0000-0000-00000000310a');
select lives_ok($$ select update_branch(current_setting('t.br')::uuid, '{"open_days":[0,1,2,3,4,5,6]}') $$, 'open every day again');
select set_config('t.emp', save_employee(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'full_name', 'Night Barber', 'role_title', 'staff'))::text, false);
select set_roster(current_setting('t.emp')::uuid, format('[{"weekday":%s,"start":"22:00","end":"02:00"}]', pg_temp.dow(2))::jsonb);
select is((select array_agg(s order by s) from pg_temp.slots(3, current_setting('t.emp')::uuid) s)
          || (select array_agg(s order by s) from pg_temp.slots(2, current_setting('t.emp')::uuid) s),
  array['00:00', '00:30', '01:00', '01:30', '22:00', '22:30', '23:00', '23:30'],
  'the shift''s evening, then the next morning until it ends');

select * from finish();
rollback;
