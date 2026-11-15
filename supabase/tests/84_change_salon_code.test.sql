-- Owner's app check F3: the owner changes the salon code once; every staff login of the salon moves to the new code
-- in the same step (another salon's do not), and a code that is taken, badly formed or a second change is refused
-- with nothing changed. Only the owner may change it.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000084' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'change-code-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'e0']) n;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000084' || p)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_uid(p uuid) returns void language plpgsql as $$
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
-- A staff login as the staff-login function makes it: username@<code>.staff.internal, with its email identity.
create function pg_temp.staff_login(p_id uuid, p_username text, p_business text, p_role text) returns void
language plpgsql as $$
declare
  v_email text;
begin
  perform pg_temp.as_admin();
  v_email := p_username || '@' || (select code from businesses where id = p_business::uuid) || '.staff.internal';
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                          raw_app_meta_data, raw_user_meta_data)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email,
          crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');
  insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  values (p_id::text, p_id, jsonb_build_object('sub', p_id::text, 'email', v_email), 'email', now(), now());
  perform pg_temp.as_service();
  perform register_staff_member(jsonb_build_object('business_id', p_business,
    'branch_id', (select id from branches where business_id = p_business::uuid limit 1), 'user_id', p_id,
    'username', p_username, 'display_name', p_username, 'role', p_role));
end $$;
create function pg_temp.emails(p_ids uuid[]) returns text[] language sql as $$
  select array_agg(email::text order by email) from auth.users where id = any(p_ids)
$$;

select pg_temp.as_user('a0');
select set_config('t.b', (create_business('{"business_name":"Rderose Ladies","owner_name":"Owner","mode":"ladies",
  "opening_cash_minor":0}') ->> 'business_id'), false);
select set_config('t.old', (select code from businesses where id = current_setting('t.b')::uuid), false);
select pg_temp.as_user('e0');
select set_config('t.e', (create_business('{"business_name":"Other Salon","owner_name":"Other","mode":"gents",
  "opening_cash_minor":0}') ->> 'business_id'), false);
select set_config('t.other_code', (select code from businesses where id = current_setting('t.e')::uuid), false);
select pg_temp.staff_login('00000000-0000-0000-0000-0000000084b1', 'marie', current_setting('t.b'), 'staff');
select pg_temp.staff_login('00000000-0000-0000-0000-0000000084c1', 'desk', current_setting('t.b'), 'cashier');
select pg_temp.staff_login('00000000-0000-0000-0000-0000000084f1', 'omar', current_setting('t.e'), 'staff');

select pg_temp.as_uid('00000000-0000-0000-0000-0000000084c1');
select throws_ok($$ select change_salon_code(current_setting('t.b')::uuid, 'redrose') $$, '42501', null,
  'only the owner changes the salon code');

select pg_temp.as_user('a0');
select throws_ok($$ select change_salon_code(current_setting('t.b')::uuid, 'Red Rose!') $$, '22023', 'invalid_salon_code',
  'letters and numbers only');
select throws_ok($$ select change_salon_code(current_setting('t.b')::uuid, 'abc') $$, '22023', 'invalid_salon_code',
  'at least 4');
select throws_ok($$ select change_salon_code(current_setting('t.b')::uuid, current_setting('t.old')) $$, '22023', 'code_unchanged',
  'the same code is not a change');
select throws_ok($$ select change_salon_code(current_setting('t.b')::uuid, current_setting('t.other_code')) $$, '23505', 'code_taken',
  'another salon''s code is taken');
select is((select code_changed_at from businesses where id = current_setting('t.b')::uuid), null, 'a refused change leaves the salon as it was');

select is(change_salon_code(current_setting('t.b')::uuid, ' RedRose26 '), 'redrose26', 'the owner changes it (spaces and capitals tidied)');
select pg_temp.as_admin();
select is(pg_temp.emails(array['00000000-0000-0000-0000-0000000084b1', '00000000-0000-0000-0000-0000000084c1']::uuid[]),
  array['desk@redrose26.staff.internal', 'marie@redrose26.staff.internal'], 'every staff login moved to the new code');
select is((select array_agg(identity_data ->> 'email' order by identity_data ->> 'email') from auth.identities
           where user_id in ('00000000-0000-0000-0000-0000000084b1', '00000000-0000-0000-0000-0000000084c1')),
  array['desk@redrose26.staff.internal', 'marie@redrose26.staff.internal'], 'with their sign-in identities');
select is(pg_temp.emails(array['00000000-0000-0000-0000-0000000084f1']::uuid[]),
  array['omar@' || current_setting('t.other_code') || '.staff.internal'], 'another salon''s logins did not move');
select is((select email::text from auth.users where id = '00000000-0000-0000-0000-0000000084a0'), 'change-code-a0@test.local',
  'the owner''s own email is unchanged');
-- (one transaction: every row has the same time, so it is looked up by its words)
select ok(exists (select 1 from audit_log where business_id = current_setting('t.b')::uuid and entity_type = 'business'
                    and summary = 'Changed the salon code: ' || current_setting('t.old') || ' → redrose26'),
  'the activity says what it was and what it is');

select pg_temp.as_user('a0');
select throws_ok($$ select change_salon_code(current_setting('t.b')::uuid, 'redrose27') $$, '22023', 'code_changed',
  'it changes only once');
-- The new code is now this salon's.
select pg_temp.as_user('e0');
select throws_ok($$ select change_salon_code(current_setting('t.e')::uuid, 'redrose26') $$, '23505', 'code_taken',
  'the new code is taken for everyone else');

select * from finish();
rollback;
