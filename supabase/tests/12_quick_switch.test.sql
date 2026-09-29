-- PIN quick-switch: a person sets their own PIN; someone signed in to the same salon can check it; five wrong
-- tries lock it; nobody can read the hashes; another salon cannot check it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000011aa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'qs-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-0000000011cc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'qs-cashier@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-0000000011bb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'qs-other@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

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

select pg_temp.as_user('00000000-0000-0000-0000-0000000011aa');
select set_config('t.b', (create_business('{"business_name":"Switch Salon","owner_name":"Owner","mode":"gents"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select set_config('t.owner', (select id::text from members where user_id = '00000000-0000-0000-0000-0000000011aa'), false);
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-0000000011cc', 'username', 'qscash', 'display_name', 'Noor', 'role', 'cashier'));
select set_config('t.cashier', (select id::text from members where user_id = '00000000-0000-0000-0000-0000000011cc'), false);
select pg_temp.as_user('00000000-0000-0000-0000-0000000011bb');
select create_business('{"business_name":"Other Salon","owner_name":"Other","mode":"ladies"}');
select set_config('t.other', (select business_id::text from members where user_id = '00000000-0000-0000-0000-0000000011bb'), false);

-- ── Setting a PIN ────────────────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000011cc');
select is(has_pin(current_setting('t.b')::uuid), false, 'no PIN yet');
select throws_ok(format($$ select set_my_pin('%s', '12a4') $$, current_setting('t.b')), '22023', 'invalid_pin', 'four digits only');
select throws_ok(format($$ select set_my_pin('%s', '7777') $$, current_setting('t.b')), '22023', 'invalid_pin', 'not one digit four times');
select throws_ok(format($$ select set_my_pin('%s', '1234') $$, current_setting('t.b')), '22023', 'invalid_pin', 'not a straight run');
select lives_ok(format($$ select set_my_pin('%s', '2468') $$, current_setting('t.b')), 'the cashier sets a PIN');
select is(has_pin(current_setting('t.b')::uuid), true, 'and has one');
select throws_ok($$ select pin_hash from member_pins $$, '42501', null, 'nobody reads PIN hashes');

-- ── Checking it ──────────────────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000011aa');
select is(check_pin(current_setting('t.cashier')::uuid, '2468'), true, 'the right PIN switches');
select is(check_pin(current_setting('t.cashier')::uuid, '1357'), false, 'a wrong PIN does not');
select throws_ok(format($$ select check_pin('%s', '2468') $$, current_setting('t.owner')), 'P0002', 'not_found',
  'someone without a PIN cannot be switched to');
select pg_temp.as_user('00000000-0000-0000-0000-0000000011bb');
select throws_ok(format($$ select check_pin('%s', '2468') $$, current_setting('t.cashier')), '42501', null,
  'another salon cannot check it');

-- ── Five wrong tries lock it ─────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-0000000011aa');
select check_pin(current_setting('t.cashier')::uuid, '0000') from generate_series(1, 4);
select throws_ok(format($$ select check_pin('%s', '2468') $$, current_setting('t.cashier')), '22023', 'pin_locked',
  'after five wrong tries even the right PIN is refused for a while');
select pg_temp.as_user('00000000-0000-0000-0000-0000000011cc');
select lives_ok(format($$ select set_my_pin('%s', '3579') $$, current_setting('t.b')), 'setting a new PIN unlocks it');
select pg_temp.as_user('00000000-0000-0000-0000-0000000011aa');
select is(check_pin(current_setting('t.cashier')::uuid, '3579'), true, 'and the new PIN works');

select * from finish();
rollback;
