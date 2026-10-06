-- The platform console (owner, 2026-10-06): totals, salons, accounts, plans and history across the service, and naming
-- platform owners — for platform owners only; the last one cannot be removed.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(16);
grant execute on function public.branch_today(uuid), public.business_today(uuid), public.unique_business_code(text),
  public.post_journal(uuid, uuid, date, text, uuid, text, uuid, jsonb), public.branch_setting(uuid, text, jsonb)
  to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000290a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pc-dev@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}', '{}'),
  ('00000000-0000-0000-0000-00000000290b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pc-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{"provider":"email"}', '{}');

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

-- A salon owner, and a dev account with no salon that is the only platform owner.
select pg_temp.as_user('00000000-0000-0000-0000-00000000290b');
select set_config('t.b', (create_business('{"business_name":"Console Salon","owner_name":"Owner","mode":"gents","vat_mode":"off"}') ->> 'business_id'), false);
select pg_temp.as_admin();
delete from platform_admins;
insert into platform_admins (user_id) values ('00000000-0000-0000-0000-00000000290a');

-- A salon owner sees none of it.
select pg_temp.as_user('00000000-0000-0000-0000-00000000290b');
select throws_ok($$ select admin_overview() $$, '42501', null, 'a salon owner cannot open the console');
select throws_ok($$ select * from admin_accounts() $$, '42501', null, 'nor list every account');
select throws_ok($$ select admin_set_platform_owner('pc-owner@test.local', true) $$, '42501', null, 'nor make themselves a platform owner');

-- The dev account, with no salon of its own, sees everything.
select pg_temp.as_user('00000000-0000-0000-0000-00000000290a');
select ok((admin_overview() ->> 'salons')::int >= 1, 'the overview counts the salons');
select ok(exists (select 1 from admin_salon_stats() where business_id = current_setting('t.b')::uuid), 'each salon''s activity is listed');
select ok(exists (select 1 from admin_accounts() where email = 'pc-owner@test.local' and salon = 'Console Salon' and role = 'owner'),
  'every account, with its salon and role');
select ok(exists (select 1 from admin_accounts() where email = 'pc-dev@test.local' and salon is null and platform_owner),
  'including the dev account, marked as platform owner');
select ok(exists (select 1 from admin_activity(current_setting('t.b')::uuid, 50)), 'the history of one salon');

-- Naming and removing platform owners.
select lives_ok($$ select admin_set_platform_owner('PC-OWNER@test.local', true) $$, 'a platform owner names another, by email');
select lives_ok($$ select admin_set_platform_owner('pc-owner@test.local', false) $$, 'and removes them again');
select throws_ok($$ select admin_set_platform_owner('pc-dev@test.local', false) $$, '22023', 'invalid_status',
  'the last platform owner cannot be removed');

-- Closing a salon: its logins switched off, nothing deleted; only platform owners; a reason is needed.
select pg_temp.as_user('00000000-0000-0000-0000-00000000290b');
select throws_ok(format($$ select admin_close_salon('%s', 'test') $$, current_setting('t.b')), '42501', null,
  'a salon owner cannot close a salon');
select pg_temp.as_user('00000000-0000-0000-0000-00000000290a');
select throws_ok(format($$ select admin_close_salon('%s', '') $$, current_setting('t.b')), '22023', 'reason_required',
  'closing needs a reason');
select lives_ok(format($$ select admin_close_salon('%s', 'Demo salon') $$, current_setting('t.b')), 'the platform owner closes the salon');
select pg_temp.as_admin();
select is((select count(*)::int from members where business_id = current_setting('t.b')::uuid and active), 0,
  'every login of the salon is switched off');
select ok((select closed_at is not null and close_note = 'Demo salon' from businesses where id = current_setting('t.b')::uuid),
  'the salon is marked closed, with the reason, and kept');

select * from finish();
rollback;
