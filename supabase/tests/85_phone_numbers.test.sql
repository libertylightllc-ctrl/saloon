-- Owner's app check F1: one check for phone numbers (the country's length, not all one digit), saved with the
-- country code; new and changed numbers are checked however they are saved, old ones stay until changed; customers'
-- valid local numbers got the country code once (with the activity keeping the numbers before and after); the
-- booking page finds a returning client by the tidied number.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(41);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000085a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'phones-a0@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');
create function pg_temp.as_owner() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000085a0","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- The same numbers as the app's test (src/lib/phone.test.ts).
select is(normalize_phone(typed, country), saved, format('"%s" in %s', typed, coalesce(country, 'no country')))
from (values ('55512345', 'QA', '+974 5551 2345'), ('5551 2345', 'QA', '+974 5551 2345'),
             ('+974 5551 2345', 'QA', '+974 5551 2345'), ('97455512345', 'QA', '+974 5551 2345'),
             ('0501234567', 'AE', '+971 50 123 4567'), ('050 123 4567', 'AE', '+971 50 123 4567'),
             ('501234567', 'AE', '+971 50 123 4567'), ('+971 050 123 4567', 'AE', '+971 50 123 4567'),
             ('00971501234567', 'AE', '+971 50 123 4567'), ('043214567', 'AE', '+971 4321 4567'),
             ('+44 7911 123456', 'AE', '+44 791 112 3456'), ('(202) 555-0123', 'US', '+1 202 555 0123'),
             ('1 202 555 0123', 'US', '+1 202 555 0123'), ('+1 416 555 0123', 'CA', '+1 416 555 0123'),
             ('06 1234 5678', 'IT', '+39 061 234 5678'), ('+880 1712 345678', 'AE', '+880 171 234 5678'),
             ('+99912345678', null, '+99912345678')) v(typed, country, saved);
select is(phone_or_null(typed, country), null, format('"%s" in %s is refused', typed, coalesce(country, 'no country')))
from (values ('000000000', 'AE'), ('555555555', 'AE'), ('+971 555 555 555', 'AE'), ('12345', 'QA'), ('555123456', 'QA'),
             ('abc', 'AE'), ('50-123-4567x', 'AE'), ('55512345', null)) v(typed, country);
select throws_ok($$ select normalize_phone('000000000', 'AE') $$, '22023', 'invalid_phone', 'a number that is not one says so');

-- A Qatar salon.
select pg_temp.as_owner();
select set_config('t.b', (create_business('{"business_name":"Phone Rules Salon","owner_name":"Owner","mode":"ladies",
  "country_code":"QA","currency":"QAR","timezone":"Asia/Qatar","phone":"4444 1234","vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select is((select phone from branches where id = current_setting('t.br')::uuid), '+974 4444 1234',
  'the branch number from setup is saved with the country code');
insert into customers (business_id, name, phone) values (current_setting('t.b')::uuid, 'Red Rose client', '55512345');
select is((select phone from customers where business_id = current_setting('t.b')::uuid and name = 'Red Rose client'),
  '+974 5551 2345', 'a new customer''s number gets the country code');
select is((select phone_digits from customers where business_id = current_setting('t.b')::uuid and name = 'Red Rose client'),
  '97455512345', 'and is searchable by its digits');
select throws_ok($$ insert into customers (business_id, name, phone) values (current_setting('t.b')::uuid, 'X', '000000000') $$,
  '22023', 'invalid_phone', 'all one digit is refused');
select throws_ok(format($$ select update_branch('%s', '{"phone":"000000000"}') $$, current_setting('t.br')),
  '22023', 'invalid_phone', 'Branch settings refuses it too');

-- A number saved before this check stays until someone changes it.
select pg_temp.as_admin();
alter table customers disable trigger customers_tidy_phone;
alter table branches disable trigger branches_tidy_phone;
update branches set phone = '000000000' where id = current_setting('t.br')::uuid;
insert into customers (business_id, name, phone)
values (current_setting('t.b')::uuid, 'Local', '66123456'), (current_setting('t.b')::uuid, 'Odd', '1234 567'),
       (current_setting('t.b')::uuid, 'Abroad', '+44 7911 123456'), (current_setting('t.b')::uuid, 'Zeros', '0044 7911 123456');
alter table customers enable trigger customers_tidy_phone;
alter table branches enable trigger branches_tidy_phone;
select pg_temp.as_owner();
select lives_ok(format($$ select update_branch('%s', '{"name":"Phone Rules Salon"}') $$, current_setting('t.br')),
  'saving Branch settings without touching an old number still works');
select is((select phone from branches where id = current_setting('t.br')::uuid), '000000000', 'and leaves it as it was');

-- The one-time update: valid local numbers get the code; anything else is left exactly as typed.
select pg_temp.as_admin();
select ok(customer_phones_add_country_code() >= 1, 'local numbers got the country code');
select results_eq($$ select name, phone from customers where business_id = current_setting('t.b')::uuid
                     and name in ('Local', 'Odd', 'Abroad', 'Zeros') order by name $$,
  $$ values ('Abroad', '+44 7911 123456'), ('Local', '+974 6612 3456'), ('Odd', '1234 567'), ('Zeros', '0044 7911 123456') $$,
  'only the valid local number changed');
select is((select before ->> (select id::text from customers where business_id = current_setting('t.b')::uuid and name = 'Local')
           from audit_log where business_id = current_setting('t.b')::uuid and summary = 'Added the country code to 1 customer phone numbers'),
  '66123456', 'the activity keeps the number as it was');

-- Merging a customer with an old number into one without a number keeps that number, as it was.
select pg_temp.as_owner();
insert into customers (business_id, name) values (current_setting('t.b')::uuid, 'Kept');
select lives_ok(format($$ select merge_customers('%s', '%s', '%s') $$, current_setting('t.br'),
  (select id from customers where business_id = current_setting('t.b')::uuid and name = 'Kept'),
  (select id from customers where business_id = current_setting('t.b')::uuid and name = 'Odd')),
  'a customer with an old number can still be merged');
select is((select phone from customers where business_id = current_setting('t.b')::uuid and name = 'Kept'), '1234 567',
  'and the number moves across as it was');
select throws_ok($$ update customers set phone = '1234 568' where business_id = current_setting('t.b')::uuid and name = 'Kept' $$,
  '22023', 'invalid_phone', 'typing a new number that is not one is still refused');

-- The booking page finds the client by the number typed the local way.
select pg_temp.as_owner();
select set_config('t.svc', (select id::text from services where business_id = current_setting('t.b')::uuid
                            and status = 'active' order by price_minor desc limit 1), false);
select set_config('t.slug', set_online_booking(current_setting('t.br')::uuid, true), false);
select pg_temp.as_admin();
select set_config('t.today', branch_today(current_setting('t.br')::uuid)::text, false);
select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('t.online', (public_book(jsonb_build_object('slug', current_setting('t.slug'),
  'service_ids', jsonb_build_array(current_setting('t.svc')),
  'starts_at', (current_setting('t.today')::date + 3 + time '12:00') at time zone 'Asia/Qatar',
  'name', 'Someone', 'phone', '6612 3456')) ->> 'token'), false);
select throws_ok(format($$ select public_book(jsonb_build_object('slug', %L, 'service_ids', jsonb_build_array(%L),
  'starts_at', (%L::date + 3 + time '13:00') at time zone 'Asia/Qatar', 'name', 'Nobody', 'phone', '000000000')) $$,
  current_setting('t.slug'), current_setting('t.svc'), current_setting('t.today')), '22023', 'invalid_phone',
  'the booking page refuses a number that is not one');
select pg_temp.as_admin();
select is((select c.name from appointments a join customers c on c.id = a.customer_id
           where a.booking_token = current_setting('t.online')), 'Local', 'an online booking finds the returning client');

select * from finish();
rollback;
