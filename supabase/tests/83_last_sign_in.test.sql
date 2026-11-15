-- Owner's app check F4: the owner reads when each login last signed in (or that it never has); a manager reads it for
-- front-desk and stylist logins in a branch they share; nobody else, and not for another salon.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(8);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data, last_sign_in_at)
select ('00000000-0000-0000-0000-0000000083' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'last-sign-in-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}',
       case n when 'b1' then timestamptz '2026-11-12 05:14:00+00' end
from unnest(array['a0', 'b1', 'c1', 'd1', 'e0']) n;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000083' || p)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end $$;
create function pg_temp.member(p text) returns uuid language sql as $$
  select current_setting('t.m_' || p)::uuid
$$;

select pg_temp.as_user('a0');
select set_config('t.b', (create_business('{"business_name":"Last Sign In Salon","owner_name":"Owner","mode":"ladies",
  "opening_cash_minor":0}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_user('e0');
select create_business('{"business_name":"Other Salon","owner_name":"Other","mode":"gents","opening_cash_minor":0}');
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-0000000083' || n, 'username', 'lastsign' || n, 'display_name', 'Person ' || n, 'role', r))
from (values ('b1', 'staff'), ('c1', 'manager'), ('d1', 'cashier')) v(n, r);
select set_config('t.m_' || n, (select id::text from members where user_id = ('00000000-0000-0000-0000-0000000083' || n)::uuid), false)
from unnest(array['a0', 'b1', 'c1', 'd1']) n;

select pg_temp.as_user('a0');
select is(login_last_sign_in(pg_temp.member('b1')), timestamptz '2026-11-12 05:14:00+00', 'the owner reads when a stylist last signed in');
select is(login_last_sign_in(pg_temp.member('d1')), null, 'and that the front desk never has');
select is(login_last_sign_in(pg_temp.member('c1')), null, 'and the manager''s');

select pg_temp.as_user('c1');
select is(login_last_sign_in(pg_temp.member('b1')), timestamptz '2026-11-12 05:14:00+00', 'a manager reads a stylist''s in their branch');
select throws_ok(format('select login_last_sign_in(%L)', pg_temp.member('a0')), '42501', null, 'but not the owner''s');

select pg_temp.as_user('d1');
select throws_ok(format('select login_last_sign_in(%L)', pg_temp.member('b1')), '42501', null, 'the front desk cannot');
select pg_temp.as_user('b1');
select throws_ok(format('select login_last_sign_in(%L)', pg_temp.member('b1')), '42501', null, 'nor a stylist');
select pg_temp.as_user('e0');
select throws_ok(format('select login_last_sign_in(%L)', pg_temp.member('b1')), '42501', null, 'nor another salon''s owner');

select * from finish();
rollback;
