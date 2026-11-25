-- Platform console, Part B (owner's brief, 24 Nov 2026; migration 118): B3 active salons in the last 7 and 30 days,
-- B7 salons at risk (paying, free, pilot or free for good, nothing for 14 days or more). Test and closed salons are
-- left out; an ended salon is not "at risk". The test database holds other salons, so counts compare with before.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(8);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000093' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'activity-' || x || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1', 'b2', 'b3', 'b4', 'b5']) x;
create function pg_temp.u(p text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000093' || p)::uuid $$;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(p), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.salon(p_user text, p_name text) returns uuid language plpgsql as $$
declare v uuid;
begin
  perform pg_temp.as_user(p_user);
  v := (create_business(json_build_object('business_name', p_name, 'owner_name', 'Owner', 'mode', 'gents', 'vat_mode', 'off')::jsonb) ->> 'business_id')::uuid;
  perform pg_temp.as_admin();
  return v;
end $$;
delete from platform_admins;
insert into platform_admins (user_id) values (pg_temp.u('a0'));
create temp table before on commit drop as select admin_salon_activity() as v from (select pg_temp.as_user('a0')) x;
select pg_temp.as_admin();

-- b1 used two days ago; b2 quiet for 20 days (free); b3 quiet for 40 days, ended; b4 a quiet test salon; b5 quiet, closed.
select set_config('t.b1', pg_temp.salon('b1', 'Busy Salon')::text, false);
select set_config('t.b2', pg_temp.salon('b2', 'Quiet Salon')::text, false);
select set_config('t.b3', pg_temp.salon('b3', 'Gone Quiet Salon')::text, false);
select set_config('t.b4', pg_temp.salon('b4', 'Quiet Test Salon')::text, false);
select set_config('t.b5', pg_temp.salon('b5', 'Quiet Closed Salon')::text, false);
insert into test_salons (business_id, test) values (current_setting('t.b4')::uuid, true);
update businesses set closed_at = now() - interval '1 day' where id = current_setting('t.b5')::uuid;
update subscriptions set free_until = public.business_today(business_id) - 10 where business_id = current_setting('t.b3')::uuid;
update audit_log set created_at = now() - interval '2 days' where business_id = current_setting('t.b1')::uuid;
update audit_log set created_at = now() - interval '20 days' where business_id in (current_setting('t.b2')::uuid, current_setting('t.b4')::uuid, current_setting('t.b5')::uuid);
update audit_log set created_at = now() - interval '40 days' where business_id = current_setting('t.b3')::uuid;

select pg_temp.as_user('a0');
create temp table after on commit drop as select admin_salon_activity(100000) as v;
select pg_temp.as_admin();
create function pg_temp.more(p_key text) returns int language sql as $$
  select (a.v ->> p_key)::int - (b.v ->> p_key)::int from before b, after a
$$;
select is(pg_temp.more('open'), 3, 'open salons: the busy, the quiet and the ended one; not the test or the closed one');
select is(pg_temp.more('active_7d'), 1, 'used in the last 7 days: the busy one');
select is(pg_temp.more('active_30d'), 2, 'in the last 30 days: the busy and the quiet one');
select is(pg_temp.more('at_risk_count'), 1, 'at risk: the quiet one in its free period, not the ended one');
select ok((select exists (select 1 from jsonb_array_elements(v -> 'at_risk') x where x ->> 'name' = 'Quiet Salon' and x ->> 'status' = 'free')
           from after),
  'it is listed with its status');
select is((select count(*)::int from after, jsonb_array_elements(v -> 'at_risk') x
           where x ->> 'name' in ('Busy Salon', 'Gone Quiet Salon', 'Quiet Test Salon', 'Quiet Closed Salon')), 0,
  'the others are not');
-- The list works every salon out at once; salon_last_active() is the rule (migration 115), one salon at a time.
select is((select (x ->> 'last_active')::timestamptz from after, jsonb_array_elements(v -> 'at_risk') x where x ->> 'business_id' = current_setting('t.b2')),
  salon_last_active(current_setting('t.b2')::uuid), 'its last use is the same as salon_last_active() says');

select pg_temp.as_user('b1');
select throws_ok($$ select admin_salon_activity() $$, '42501', 'not_allowed', 'a salon owner cannot see other salons'' activity');

select * from finish();
rollback;
