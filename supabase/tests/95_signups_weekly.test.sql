-- Platform console, Part B (owner's brief, 24 Nov 2026; migration 120): B8 new salons each week by country, the last
-- 12 weeks, Monday to Sunday on the Dubai calendar. Test and demo salons are left out; closed ones are counted.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(7);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000095' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'signups-' || x || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1', 'b2', 'b3', 'b4', 'b5']) x;
create function pg_temp.u(p text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000095' || p)::uuid $$;
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
create function pg_temp.salon(p_user text, p_name text, p_country text) returns uuid language plpgsql as $$
declare v uuid;
begin
  perform pg_temp.as_user(p_user);
  v := (create_business(jsonb_build_object('business_name', p_name, 'owner_name', 'Owner', 'mode', 'gents', 'vat_mode', 'off',
          'country_code', p_country, 'currency', 'USD', 'timezone', 'America/New_York')) ->> 'business_id')::uuid;
  perform pg_temp.as_admin();
  return v;
end $$;
delete from platform_admins;
insert into platform_admins (user_id) values (pg_temp.u('a0'));
select set_config('t.monday', date_trunc('week', now() at time zone 'Asia/Dubai')::date::text, false);
create temp table before on commit drop as select admin_signups_weekly() as v from (select pg_temp.as_user('a0')) x;
select pg_temp.as_admin();

-- b1 (US) this week; b2 (US) at 23:30 Dubai on the Sunday of last week; b3 (US) closed, this week;
-- b4 (US) a test salon; b5 (US) 13 weeks ago, before the chart.
select set_config('t.b1', pg_temp.salon('b1', 'Palm Salon', 'US')::text, false);
select set_config('t.b2', pg_temp.salon('b2', 'Cedar Cuts', 'US')::text, false);
select set_config('t.b3', pg_temp.salon('b3', 'Blue Comb', 'US')::text, false);
select set_config('t.b4', pg_temp.salon('b4', 'Test Salon 95', 'US')::text, false);
select set_config('t.b5', pg_temp.salon('b5', 'Old Salon 95', 'US')::text, false);
update businesses set created_at = (current_setting('t.monday')::date - 1 + time '23:30')::timestamp at time zone 'Asia/Dubai'
where id = current_setting('t.b2')::uuid;
update businesses set closed_at = now() where id = current_setting('t.b3')::uuid;
insert into test_salons (business_id, test) values (current_setting('t.b4')::uuid, true);
update businesses set created_at = (current_setting('t.monday')::date - 7 * 13)::timestamp at time zone 'Asia/Dubai'
where id = current_setting('t.b5')::uuid;

select pg_temp.as_user('a0');
create temp table after on commit drop as select admin_signups_weekly() as v;
select pg_temp.as_admin();
create function pg_temp.more(p_week date) returns int language sql as $$
  select coalesce((select (x ->> 'salons')::int from after a, jsonb_array_elements(a.v -> 'counts') x
                   where x ->> 'country_code' = 'US' and (x ->> 'week')::date = p_week), 0)
       - coalesce((select (x ->> 'salons')::int from before b, jsonb_array_elements(b.v -> 'counts') x
                   where x ->> 'country_code' = 'US' and (x ->> 'week')::date = p_week), 0)
$$;

select is((select jsonb_array_length(v -> 'weeks') from after), 12, 'twelve weeks');
select is((select array[(v -> 'weeks' ->> 0)::date, (v -> 'weeks' ->> 11)::date] from after),
  array[current_setting('t.monday')::date - 77, current_setting('t.monday')::date], 'from the Monday 11 weeks ago to this Monday');
select is(pg_temp.more(current_setting('t.monday')::date), 2, 'this week: one open and one closed salon; not the test salon');
select is(pg_temp.more(current_setting('t.monday')::date - 7), 1, 'Sunday 23:30 in Dubai belongs to last week');
select is((select count(*)::int from after, jsonb_array_elements(v -> 'counts') x where (x ->> 'week')::date < current_setting('t.monday')::date - 77), 0,
  'nothing from before the chart');
select is((select jsonb_array_length(admin_signups_weekly(4) -> 'weeks') from (select pg_temp.as_user('a0')) x), 4, 'fewer weeks when asked');

select pg_temp.as_user('b1');
select throws_ok($$ select admin_signups_weekly() $$, '42501', 'not_allowed', 'a salon owner cannot see sign-ups');

select * from finish();
rollback;
