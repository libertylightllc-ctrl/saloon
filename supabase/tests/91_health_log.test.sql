-- Platform console, Part B (owner's brief, 24 Nov 2026; migration 116), B10 "System health": the service's functions
-- write how emails, Creem's notices and the day's rates went (at most 200 of a kind an hour); a signed-in person's
-- crashed screen is written (at most 20 an hour, the salon only when they work there); only platform owners read it.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000091' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'health-' || x || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1', 'b2']) x;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000091' || p)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  perform set_config('role', 'service_role', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
delete from platform_admins;
insert into platform_admins (user_id) values ('00000000-0000-0000-0000-0000000091a0');
select pg_temp.as_user('b1');
select set_config('t.b1', (create_business('{"business_name":"Health One","owner_name":"Owner","mode":"gents","vat_mode":"off"}') ->> 'business_id'), false);
select pg_temp.as_user('b2');
select set_config('t.b2', (create_business('{"business_name":"Health Two","owner_name":"Owner","mode":"gents","vat_mode":"off"}') ->> 'business_id'), false);
select pg_temp.as_admin();
delete from health_log;

select pg_temp.as_user('b1');
select throws_ok($$ select log_health('email', true, 'Plan request') $$, '42501', null, 'a salon login cannot write the service''s records');
select throws_ok($$ select admin_health() $$, '42501', 'not_allowed', 'nor read them');

select pg_temp.as_service();
select log_health('email', true, 'Plan request');
select log_health('email', false, 'Support alert: the email service answered 500');
select log_health('card_webhook', false, 'Refused: the signature did not match') from generate_series(1, 250);
select log_health('rates', true, 'Rates of 2026-11-25');
select pg_temp.as_admin();
select is((select count(*)::int from health_log where kind = 'card_webhook'), 200, 'a flood of forged notices stops at 200 an hour');

-- A crashed screen: on the person's own salon; not someone else's; nothing from someone signed out.
select pg_temp.as_user('b1');
select report_app_error('TypeError: x is undefined', '/sale', current_setting('t.b1')::uuid);
select report_app_error('TypeError: y is undefined', '/queue', current_setting('t.b2')::uuid);
select report_app_error('   ', '/sale', null);
select pg_temp.as_admin();
select is((select array_agg(coalesce(b.name, '-') order by h.id) from health_log h left join businesses b on b.id = h.business_id
           where h.kind = 'app_error'),
  array['Health One', '-'], 'the salon is kept only when the person works there; an empty error is not written');
select pg_temp.as_user('b1');
select report_app_error('Again', '/sale', null) from generate_series(1, 30);
select pg_temp.as_admin();
select is((select count(*)::int from health_log where kind = 'app_error'), 20, 'at most 20 a person an hour');
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$ select report_app_error('From outside', '/', null) $$, '42501', null, 'nobody signed out can write one');
reset role;

select pg_temp.as_user('a0');
create temp table h on commit drop as select admin_health() as v;
grant select on h to authenticated;
select is((select array[v #>> '{email,ok_24h}', v #>> '{email,fails_24h}', v #>> '{email,last_fail}'] from h),
  array['1', '1', 'Support alert: the email service answered 500'], 'emails: sent, failed and why');
select is((select array[v #>> '{card_webhook,fails_24h}', v #>> '{card_webhook,last_ok_at}'] from h),
  array['200', null], 'card notices: the refused ones, and none accepted');
select is((select (v ->> 'app_errors_24h')::int from h), 20, 'crashed screens in the last day');
select is((select jsonb_array_length(v -> 'app_errors') from h), 5, 'the latest five, with their salon');

select * from finish();
rollback;
