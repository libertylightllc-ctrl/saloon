-- Changing the country after setup (owner, 2026-10-06): allowed until money is recorded; it brings the currency, time
-- zone and tax, and converts the amounts already typed in. Only the owner may do it.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(14);
grant execute on function public.branch_today(uuid), public.business_today(uuid), public.unique_business_code(text),
  public.post_journal(uuid, uuid, date, text, uuid, text, uuid, jsonb), public.branch_setting(uuid, text, jsonb),
  public.convert_rough(bigint, text, text)
  to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000280a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'cc-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000280b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'cc-owner2@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000280c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'cc-cashier@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

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
create function pg_temp.kazakhstan(p_business text) returns jsonb language sql as $$
  select jsonb_build_object('business_id', p_business, 'country_code', 'KZ', 'currency', 'KZT', 'timezone', 'Asia/Almaty',
    'tax_name', 'VAT', 'tax_rate_bps', 1600, 'tax_inclusive', true, 'tax_id_label', 'BIN / IIN')
$$;

-- A UAE salon that has set up its services and a barber's pay, but recorded no money yet.
select pg_temp.as_user('00000000-0000-0000-0000-00000000280a');
select set_config('t.b', (create_business('{"business_name":"Country Salon","owner_name":"Owner","mode":"gents",
  "vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select set_config('t.svc', (select id::text from services where business_id = current_setting('t.b')::uuid order by price_minor desc limit 1), false);
select set_config('t.price', (select price_minor::text from services where id = current_setting('t.svc')::uuid), false);
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-00000000280c', 'username', 'cccash', 'display_name', 'Faisal', 'role', 'cashier'));
select pg_temp.as_admin();
update employees set base_salary_minor = 300000 where business_id = current_setting('t.b')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-00000000280a');

select is(country_change_allowed(current_setting('t.b')::uuid), true, 'no money recorded yet: the country can change');

-- Only the owner.
select pg_temp.as_user('00000000-0000-0000-0000-00000000280c');
select throws_ok(format($$ select change_country(pg_temp.kazakhstan('%s')) $$, current_setting('t.b')), '42501', null,
  'a cashier cannot change the country');
select pg_temp.as_user('00000000-0000-0000-0000-00000000280b');
select create_business('{"business_name":"Other Salon","owner_name":"Other","mode":"ladies","vat_mode":"off",
  "opening_cash_minor":10000}');
select throws_ok(format($$ select change_country(pg_temp.kazakhstan('%s')) $$, current_setting('t.b')), '42501', null,
  'nor another salon''s owner');

-- The owner moves the salon to Kazakhstan.
select pg_temp.as_user('00000000-0000-0000-0000-00000000280a');
select throws_ok(format($$ select change_country(pg_temp.kazakhstan('%s') || '{"timezone":"Mars/Base"}') $$, current_setting('t.b')),
  '22023', 'invalid_country', 'a time zone that does not exist is refused');
select lives_ok(format($$ select change_country(pg_temp.kazakhstan('%s')) $$, current_setting('t.b')), 'the owner changes the country');
select is((select country_code || ' ' || currency || ' ' || timezone from businesses where id = current_setting('t.b')::uuid),
  'KZ KZT Asia/Almaty', 'country, currency and time zone change together');
select is((select tax_rate_bps from branches where id = current_setting('t.br')::uuid), 1600.0, 'the branch takes the country''s tax rate');
select is((select tax_id_label from branches where id = current_setting('t.br')::uuid), 'BIN / IIN', 'and its tax number label');
select is((select price_minor from services where id = current_setting('t.svc')::uuid),
  convert_rough(current_setting('t.price')::bigint, 'AED', 'KZT'), 'service prices are converted roughly into tenge');
select pg_temp.as_admin();
select ok((select bool_and(base_salary_minor > 300000) from employees where business_id = current_setting('t.b')::uuid),
  'salaries are converted too');
select pg_temp.as_user('00000000-0000-0000-0000-00000000280a');
select ok(exists (select 1 from audit_log where business_id = current_setting('t.b')::uuid and summary like 'Changed the country from AE (AED, Asia/Dubai) to KZ (KZT, Asia/Almaty)%'),
  'the change is in the audit trail');

-- Once money is recorded, the country is fixed.
select post_journal(current_setting('t.b')::uuid, current_setting('t.br')::uuid, branch_today(current_setting('t.br')::uuid),
  'opening_cash', current_setting('t.br')::uuid, 'Opening cash', (select id from members where business_id = current_setting('t.b')::uuid and role = 'owner'),
  jsonb_build_array(jsonb_build_object('account', 'cash', 'debit', 1000000), jsonb_build_object('account', 'owner_equity', 'credit', 1000000)));
select is(country_change_allowed(current_setting('t.b')::uuid), false, 'after the opening cash the country cannot change');
select throws_ok(format($$ select change_country(pg_temp.kazakhstan('%s')) $$, current_setting('t.b')), '22023', 'country_locked',
  'and change_country refuses');

select pg_temp.as_user('00000000-0000-0000-0000-00000000280c');
select throws_ok(format($$ select country_change_allowed('%s') $$, current_setting('t.b')), '42501', null,
  'a cashier cannot ask either');

select * from finish();
rollback;
