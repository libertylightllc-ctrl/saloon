-- An owner's mobile / WhatsApp number (website brief 3.3): kept from the sign-up details when given (with the time of
-- the WhatsApp OK), saved or removed by the owner in setup, readable only by that owner and platform owners.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Sign-ups: one with a number and the WhatsApp OK, one with a number only, one without.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000045a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'contact-a0@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}',
   '{"display_name":"Aisha","phone":"+971 50 123 4567","whatsapp_ok":true}'),
  ('00000000-0000-0000-0000-0000000045b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'contact-b1@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}',
   '{"display_name":"Bilal","phone":"+919812345678"}'),
  ('00000000-0000-0000-0000-0000000045c2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'contact-c2@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{"display_name":"Chen"}');

select is((select row(phone, whatsapp_ok, whatsapp_ok_at is not null, source)::text from owner_contacts
           where user_id = '00000000-0000-0000-0000-0000000045a0'), '(+971501234567,t,t,sign_up)', 'the number and the WhatsApp OK, with its time');
select is((select row(phone, whatsapp_ok, whatsapp_ok_at is null)::text from owner_contacts
           where user_id = '00000000-0000-0000-0000-0000000045b1'), '(+919812345678,f,t)', 'a number without the OK: no time');
select is((select count(*)::int from owner_contacts where user_id = '00000000-0000-0000-0000-0000000045c2'), 0, 'no number, nothing kept');

-- Each owner reads only their own.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000045b1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from owner_contacts), 1, 'an owner sees only their own number');
select throws_ok($$ insert into owner_contacts (user_id, phone) values ('00000000-0000-0000-0000-0000000045c2', '+971500000000') $$,
  '42501', null, 'and cannot write anyone''s');

-- Setup: save, change, remove.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000045c2","role":"authenticated"}', true);
select lives_ok($$ select save_owner_contact('+44 7700 900123', true) $$, 'a Google sign-up adds a number in setup');
select throws_ok($$ select save_owner_contact('call me', false) $$, '22023', 'invalid_phone', 'a number is digits');
reset role;
select is((select row(phone, whatsapp_ok, source)::text from owner_contacts where user_id = '00000000-0000-0000-0000-0000000045c2'),
  '(+447700900123,t,setup)', 'saved from setup');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000045c2","role":"authenticated"}', true);
set local role authenticated;
select save_owner_contact('', false);
reset role;
select is((select count(*)::int from owner_contacts where user_id = '00000000-0000-0000-0000-0000000045c2'), 0, 'empty removes it');

select * from finish();
rollback;
