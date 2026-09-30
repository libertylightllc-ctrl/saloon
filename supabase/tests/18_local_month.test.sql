-- The business date is the salon's local date (rule 8): payroll may be worked out for the salon's current month even
-- while the database's clock (UTC) is still in the previous one — 00:00 to 04:00 on the 1st in Dubai.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(4);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000018aa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'month-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000018aa');
select set_config('t.b', (create_business('{"business_name":"Month Salon","owner_name":"Owner","mode":"gents"}')
  ->> 'business_id'), false);
select lives_ok(format($$ select generate_payroll('%s', to_char(business_today('%s'), 'YYYY-MM')) $$,
  current_setting('t.b'), current_setting('t.b')), 'the salon''s own current month can be worked out');
select throws_ok(format($$ select generate_payroll('%s', to_char(business_today('%s') + interval '1 month', 'YYYY-MM')) $$,
  current_setting('t.b'), current_setting('t.b')), '22023', 'invalid_date', 'next month cannot');

-- A salon 14 hours ahead of UTC: its month turns long before the database's does.
reset role;
update businesses set timezone = 'Pacific/Kiritimati' where id = current_setting('t.b')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-0000000018aa');
select lives_ok(format($$ select generate_payroll('%s', to_char(business_today('%s'), 'YYYY-MM')) $$,
  current_setting('t.b'), current_setting('t.b')), 'its own month counts, whatever the UTC date');
select is((select period from payroll_runs where business_id = current_setting('t.b')::uuid order by generated_at desc limit 1),
  to_char(now() at time zone 'Pacific/Kiritimati', 'YYYY-MM'), 'and the run is for that local month');

select * from finish();
rollback;
