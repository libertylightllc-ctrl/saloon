-- No email-confirmation wall (owner's fix list, final brief C2): Saloqo keeps its own record of who has confirmed their
-- address. A sign-in through the inbox (an emailed link or a reset code) or with Google confirms it; a password sign-in,
-- a phone code or Supabase's automatic "confirmed" on a new account does not. Asking for a plan and paying by card need
-- a confirmed address. When Google joins an account whose address was never confirmed, its password and sessions go.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- a0 made directly in the database (counts as confirmed); b0, c0, d0, e0, f0 made unconfirmed; a1 with a phone.
insert into auth.users (id, instance_id, aud, role, email, phone, encrypted_password, email_confirmed_at, created_at,
                        updated_at, raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000058' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'ec-' || x || '@test.local', case when x = 'a1' then '971505558000' end,
       crypt('pw-12345', gen_salt('bf')), case when x = 'a0' then now() end, now(), now(), '{}', '{}'
from unnest(array['a0', 'b0', 'c0', 'd0', 'e0', 'f0', 'a1']) x;
create function pg_temp.u(p text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000058' || p)::uuid $$;
-- Signed in as `p`, by `how` (the "amr" Supabase puts in the token: password, otp, oauth …).
create function pg_temp.as_user(p text, how text default 'password') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(p), 'role', 'authenticated',
    'amr', json_build_array(json_build_object('method', how, 'timestamp', 1)))::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.confirmed(p text) returns boolean language sql as $$ select public.email_confirmed(pg_temp.u(p)) $$;
-- A later transaction (Supabase confirms an account in another request than the one that made it).
create function pg_temp.later() returns void language sql as $$ select set_config('saloqo.new_users', '', true) $$;
select pg_temp.later();

-- 1–2. Made in the database with a confirmed address: confirmed. Made without one: not.
select is(pg_temp.confirmed('a0'), true, 'made in the database, confirmed: counts');
select is(pg_temp.confirmed('b0'), false, 'made unconfirmed: not confirmed');

-- 3. Supabase marking a new account confirmed as it makes it ("Confirm email" off) is not a confirmation.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values (pg_temp.u('90'), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ec-90@test.local',
        crypt('pw-12345', gen_salt('bf')), now(), now(), '{}', '{}');
update auth.users set email_confirmed_at = now() where id = pg_temp.u('90');
select is(pg_temp.confirmed('90'), false, 'confirmed automatically as it was made: no');

-- 4. Supabase's own link (while "Confirm email" is on), opened later: confirmed.
select pg_temp.later();
update auth.users set email_confirmed_at = now() where id = pg_temp.u('c0');
select is(pg_temp.confirmed('c0'), true, 'Supabase''s own link: confirmed');

-- 5–8. The app asks after each sign-in. A password sign-in does not confirm; an emailed link does, once.
select pg_temp.as_user('b0', 'password');
select is(confirm_my_email(), '{"confirmed": false, "newly": false}'::jsonb, 'a password sign-in: not confirmed');
select pg_temp.as_user('b0', 'otp');
select is(confirm_my_email(), '{"confirmed": true, "newly": true}'::jsonb, 'an emailed link: confirmed now');
select is(confirm_my_email(), '{"confirmed": true, "newly": false}'::jsonb, 'asked again: already confirmed');
select pg_temp.as_user('b0', 'password');
select is(confirm_my_email(), '{"confirmed": true, "newly": false}'::jsonb, 'and on the other device too');

-- 9. A code by text message to an account with a phone does not confirm the address.
select pg_temp.as_user('a1', 'otp');
select is(confirm_my_email() ->> 'confirmed', 'false', 'a phone code: no');

-- 10–11. A new address needs confirming again; one changed through the links to both inboxes is confirmed.
select pg_temp.as_admin();
update auth.users set email = 'ec-c0-new@test.local' where id = pg_temp.u('c0');
select is((select email || ' ' || how from email_confirmations where user_id = pg_temp.u('c0')),
  'ec-c0-new@test.local change', 'a changed address: the new one is confirmed');
update email_confirmations set email = 'ec-c0@test.local' where user_id = pg_temp.u('c0');
select is(pg_temp.confirmed('c0'), false, 'a confirmation for the old address does not count for a new one');

-- 12–15. Google joins an account whose address was never confirmed: the password and every session go, and the
--        address is confirmed. On a confirmed account (a0) nothing goes. A Google address that differs does nothing.
insert into auth.identities (provider_id, user_id, identity_data, provider)
select pg_temp.u(x)::text, pg_temp.u(x), jsonb_build_object('sub', pg_temp.u(x), 'email', 'ec-' || x || '@test.local'), 'email'
from unnest(array['a0', 'd0', 'f0']) x;
insert into auth.sessions (id, user_id) select gen_random_uuid(), pg_temp.u(x) from unnest(array['a0', 'd0', 'f0']) x;
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('g-d0', pg_temp.u('d0'), '{"sub":"g-d0","email":"EC-D0@test.local","email_verified":true}', 'google'),
  ('g-a0', pg_temp.u('a0'), '{"sub":"g-a0","email":"ec-a0@test.local","email_verified":true}', 'google'),
  ('g-f0', pg_temp.u('f0'), '{"sub":"g-f0","email":"someone-else@test.local","email_verified":true}', 'google');
select is((select encrypted_password from auth.users where id = pg_temp.u('d0')) || '|' ||
          (select count(*) from auth.sessions where user_id = pg_temp.u('d0')), '|0',
  'unconfirmed account joined by Google: no password, signed out everywhere');
select is(pg_temp.confirmed('d0'), true, 'and Google confirmed the address');
select is((select encrypted_password <> '' from auth.users where id = pg_temp.u('a0')) and
          (select count(*) from auth.sessions where user_id = pg_temp.u('a0')) = 1, true,
  'a confirmed account keeps its password and sessions');
select is((select encrypted_password <> '' from auth.users where id = pg_temp.u('f0')) and not pg_temp.confirmed('f0'), true,
  'a different Google address changes nothing');

-- 16–19. Buying a plan needs a confirmed address.
select set_config('salon.plan_check', 'off', false);
update platform_settings set billing_enabled = true, card_payments = 'live' where true;
select pg_temp.as_user('e0');
select set_config('t.g', create_business('{"business_name":"Unconfirmed Salon","owner_name":"Ghada","mode":"ladies","vat_mode":"off"}') ->> 'business_id', false);
select throws_ok($$ select request_plan(current_setting('t.g')::uuid, 1, null) $$, '22023', 'email_unconfirmed',
  'an unconfirmed owner cannot ask for a plan');
select throws_ok($$ select card_checkout_start(current_setting('t.g')::uuid, 1) $$, '22023', 'email_unconfirmed',
  'or pay by card');
select pg_temp.as_user('e0', 'otp');
select is(confirm_my_email() ->> 'newly', 'true', 'the owner opens the emailed link');
select pg_temp.as_user('e0');
select lives_ok($$ select request_plan(current_setting('t.g')::uuid, 1, null) $$, 'then asking for a plan works');

-- 20–22. Nobody writes the record from the app, or reads anyone else's.
select pg_temp.as_user('f0');
select throws_ok($$ insert into email_confirmations (user_id, email, how) values (auth.uid(), 'ec-f0@test.local', 'link') $$,
  '42501', null, 'an account cannot mark itself confirmed');
select throws_ok($$ select note_email_confirmed(auth.uid(), 'link') $$, '42501', null, 'or call the helper');
select pg_temp.as_user('e0');
select is((select array_agg(email) from email_confirmations), array['ec-e0@test.local'], 'each account reads only its own row');

select * from finish();
rollback;
