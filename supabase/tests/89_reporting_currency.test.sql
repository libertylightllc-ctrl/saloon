-- Platform console, Part B (owner's brief, 24 Nov 2026; migration 114): the Overview's reporting currency and the
-- day's exchange rates. Only the rates function saves rates, a reply that is not a full table is refused, the
-- currencies fixed to the US dollar keep their fixed rate, and only a platform owner changes the reporting currency
-- (written to Changes).
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000089' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'rates-' || x || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1']) x;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000089' || p)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  perform set_config('role', 'service_role', true);
end $$;
delete from platform_admins;
insert into platform_admins (user_id) values ('00000000-0000-0000-0000-0000000089a0');
-- A day's table as the service gives it: 20 currencies per US dollar, AED a little off its fixed rate.
create temp table day_rates on commit drop as
select jsonb_object_agg(c, case c when 'USD' then 1 when 'AED' then 3.67 when 'INR' then 84.25 else 2 end) as r
from unnest(array['USD', 'AED', 'SAR', 'QAR', 'INR', 'CAD', 'EUR', 'GBP', 'PKR', 'EGP', 'KWD', 'BHD', 'OMR', 'JOD',
                  'TRY', 'ZAR', 'NGN', 'KES', 'AUD', 'JPY']) c;
grant select on day_rates to authenticated, service_role;

select pg_temp.as_user('b1');
select throws_ok($$ select save_fx_rates(current_date, (select r from day_rates)) $$, '42501', null,
  'a signed-in person cannot save rates');
select throws_ok($$ select admin_fx_rates() $$, '42501', 'not_allowed', 'nor read the console''s rates');

select pg_temp.as_service();
select ok(fx_rates_due(), 'before the fetch, today''s rates are due');
select throws_ok($$ select save_fx_rates(current_date, (select r || '{"USD": 1.1}' from day_rates)) $$, '22023', 'invalid_rates',
  'a table not per US dollar is refused');
select throws_ok($$ select save_fx_rates(current_date, '{"USD": 1, "AED": 3.6725}') $$, '22023', 'invalid_rates',
  'so is a short one');
select is(save_fx_rates((now() at time zone 'utc')::date, (select r from day_rates)), 13,
  'the day''s rates are saved, except the 7 fixed to the dollar (USD among them)');
select ok(not fx_rates_due(), 'and nothing more is due today');

select pg_temp.as_user('a0');
select is((select array[(v -> 'rates' ->> 'AED'), (v -> 'rates' ->> 'INR'), v ->> 'day', v ->> 'reporting_currency']
           from admin_fx_rates() v),
  array['3.6725', '84.25', (now() at time zone 'utc')::date::text, 'USD'],
  'the console converts with the fixed AED rate, the day''s INR rate, and says the day');

select throws_ok($$ select admin_set_reporting_currency('XYZ') $$, '22023', 'invalid_setting',
  'a reporting currency needs a rate');
select is(admin_set_reporting_currency('aed'), 'AED', 'a platform owner picks the reporting currency');
reset role;
select is((select array[action, before ->> 'reporting_currency', after ->> 'reporting_currency'] from platform_audit
           where action = 'settings:currency' order by created_at desc limit 1),
  array['settings:currency', 'USD', 'AED'], 'written to Changes, before and after');

select * from finish();
rollback;
