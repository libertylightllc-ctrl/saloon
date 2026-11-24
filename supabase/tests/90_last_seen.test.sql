-- Platform console, Part B (owner's brief, 24 Nov 2026; migration 115), B3: when a salon last used the app. A login
-- says it opened the app (at most one write an hour, unless the language changed), only for its own salon and only
-- while switched on; a salon's last activity is the latest of a sign-in, the app opened and anything recorded.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data, last_sign_in_at)
select ('00000000-0000-0000-0000-0000000090' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'seen-' || x || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}',
       now() - interval '40 days'
from unnest(array['b1', 'b2']) x;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000090' || p)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
select pg_temp.as_user('b1');
select set_config('t.b1', (create_business('{"business_name":"Seen One","owner_name":"Owner","mode":"gents","vat_mode":"off"}') ->> 'business_id'), false);
select pg_temp.as_user('b2');
select set_config('t.b2', (create_business('{"business_name":"Seen Two","owner_name":"Owner","mode":"gents","vat_mode":"off"}') ->> 'business_id'), false);
-- Creating a salon records it; put that back 40 days, as for a salon nobody has used since.
select pg_temp.as_admin();
update audit_log set created_at = now() - interval '40 days' where business_id in (current_setting('t.b1')::uuid, current_setting('t.b2')::uuid);
select set_config('t.quiet', public.salon_last_active(current_setting('t.b1')::uuid)::text, false);

select pg_temp.as_user('b1');
select touch_seen(current_setting('t.b1')::uuid, 'ar');
select touch_seen(current_setting('t.b2')::uuid, 'ar');
select pg_temp.as_admin();
select is((select array_agg(language) from member_seen where business_id in (current_setting('t.b1')::uuid, current_setting('t.b2')::uuid)),
  array['ar'], 'the app opened on the person''s own salon, in Arabic; not on someone else''s');
select ok(public.salon_last_active(current_setting('t.b1')::uuid) > now() - interval '1 minute'
          and current_setting('t.quiet')::timestamptz < now() - interval '39 days',
  'a salon quiet for 40 days is active again once its app is opened');

-- Within the hour: no new write; a new language: written.
update member_seen set last_seen_at = now() - interval '10 minutes' where business_id = current_setting('t.b1')::uuid;
select pg_temp.as_user('b1');
select touch_seen(current_setting('t.b1')::uuid, 'ar');
select pg_temp.as_admin();
select ok((select last_seen_at < now() - interval '9 minutes' from member_seen where business_id = current_setting('t.b1')::uuid),
  'opened again within the hour: not written again');
select pg_temp.as_user('b1');
select touch_seen(current_setting('t.b1')::uuid, 'fr');
select touch_seen(current_setting('t.b1')::uuid, 'xx');
select pg_temp.as_admin();
select is((select language from member_seen where business_id = current_setting('t.b1')::uuid), 'fr',
  'a new language is written at once; an unknown one keeps the last');
update member_seen set last_seen_at = now() - interval '2 hours' where business_id = current_setting('t.b1')::uuid;
select pg_temp.as_user('b1');
select touch_seen(current_setting('t.b1')::uuid);
select pg_temp.as_admin();
select ok((select last_seen_at > now() - interval '1 minute' from member_seen where business_id = current_setting('t.b1')::uuid),
  'after an hour: written again');

-- A switched-off login: nothing.
update members set active = false where business_id = current_setting('t.b2')::uuid;
select pg_temp.as_user('b2');
select touch_seen(current_setting('t.b2')::uuid, 'en');
select pg_temp.as_admin();
select ok(not exists (select 1 from member_seen where business_id = current_setting('t.b2')::uuid), 'a switched-off login is not counted');

-- Anything recorded counts too.
insert into audit_log (business_id, action, entity_type, summary, created_at)
values (current_setting('t.b2')::uuid, 'create', 'sale', 'A sale', now() - interval '2 days');
select ok(public.salon_last_active(current_setting('t.b2')::uuid) between now() - interval '3 days' and now() - interval '1 day',
  'a sale two days ago: active two days ago');

select pg_temp.as_user('b1');
select throws_ok($$ select public.salon_last_active(current_setting('t.b1')::uuid) $$, '42501', null, 'a salon login cannot ask');
select throws_ok($$ select count(*) from member_seen $$, '42501', null, 'nor read who opened the app');

select * from finish();
rollback;
