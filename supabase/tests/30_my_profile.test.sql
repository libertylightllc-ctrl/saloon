-- Everyone edits their own profile (name, phone); the owner renames the salon. Nobody edits anyone else's.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(9);
grant execute on function public.branch_today(uuid), public.business_today(uuid), public.unique_business_code(text),
  public.branch_setting(uuid, text, jsonb) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000300a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pr-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000300d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pr-staff@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

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

select pg_temp.as_user('00000000-0000-0000-0000-00000000300a');
select set_config('t.b', (create_business('{"business_name":"Profile Salon","owner_name":"Owner","mode":"gents","vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-00000000300d', 'username', 'prstaff', 'display_name', 'Rafiq', 'role', 'staff'));

-- A barber edits their own name and phone; the salon's staff list shows the same.
select pg_temp.as_user('00000000-0000-0000-0000-00000000300d');
select lives_ok($$ select update_my_profile('{"display_name":"Rafiq Khan","phone":"+971 50 123 4567"}') $$, 'a barber updates their profile');
select pg_temp.as_admin();
select is((select display_name || ' ' || phone from members where user_id = '00000000-0000-0000-0000-00000000300d'),
  'Rafiq Khan +971 50 123 4567', 'their name and phone are saved');
select is((select full_name || ' ' || phone from employees where member_id = (select id from members where user_id = '00000000-0000-0000-0000-00000000300d')),
  'Rafiq Khan +971 50 123 4567', 'and the staff list shows the same');
select pg_temp.as_user('00000000-0000-0000-0000-00000000300d');
select throws_ok($$ select update_my_profile('{"display_name":"R"}') $$, '22023', 'name_required', 'a name is needed');
select throws_ok($$ select update_my_profile('{"display_name":"Rafiq","phone":"call me"}') $$, '22023', 'invalid_phone', 'a phone must look like one');
select throws_ok(format($$ select rename_business('%s', 'Mine now') $$, current_setting('t.b')), '42501', null,
  'a barber cannot rename the salon');

-- The owner renames the salon.
select pg_temp.as_user('00000000-0000-0000-0000-00000000300a');
select lives_ok(format($$ select rename_business('%s', 'Profile Barbers') $$, current_setting('t.b')), 'the owner renames the salon');
select is((select name from businesses where id = current_setting('t.b')::uuid), 'Profile Barbers', 'the new name is saved');
select ok(exists (select 1 from audit_log where business_id = current_setting('t.b')::uuid and summary = 'Renamed the salon: Profile Salon → Profile Barbers'),
  'and the change is in the history');

select * from finish();
rollback;
