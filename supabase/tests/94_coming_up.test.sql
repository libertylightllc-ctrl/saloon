-- Platform console, Part B (owner's brief, 24 Nov 2026; migration 119): B6 free periods and pilots ending in the next
-- 7 days, plan requests still waiting, and "Message owner" logged in Changes and in the salon's history (not counted
-- as the salon being used). Test and closed salons are left out.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000094' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'coming-' || x || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6']) x;
create function pg_temp.u(p text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000094' || p)::uuid $$;
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
  v := (create_business(json_build_object('business_name', p_name, 'owner_name', 'Owner ' || p_user, 'mode', 'gents', 'vat_mode', 'off')::jsonb) ->> 'business_id')::uuid;
  perform pg_temp.as_admin();
  return v;
end $$;
delete from platform_admins;
insert into platform_admins (user_id) values (pg_temp.u('a0'));
update platform_settings set billing_enabled = true;

-- b1 free, ends in 3 days, WhatsApp OK, uses the app in Arabic; b2 a pilot ending today, no number; b3 free, ends in
-- 20 days; b4 a test salon ending in 2 days; b5 closed, ending in 2 days; b6 asked for a plan twice, 35 days ago.
select set_config('t.b1', pg_temp.salon('b1', 'Palm Salon')::text, false);
select set_config('t.b2', pg_temp.salon('b2', 'Cedar Cuts')::text, false);
select set_config('t.b3', pg_temp.salon('b3', 'Blue Comb')::text, false);
select set_config('t.b4', pg_temp.salon('b4', 'Test Salon 94')::text, false);
select set_config('t.b5', pg_temp.salon('b5', 'Closed Salon 94')::text, false);
select set_config('t.b6', pg_temp.salon('b6', 'Asking Salon')::text, false);
insert into test_salons (business_id, test) values (current_setting('t.b4')::uuid, true);
update businesses set closed_at = now() where id = current_setting('t.b5')::uuid;
update subscriptions set free_until = public.business_today(business_id) + 3 where business_id = current_setting('t.b1')::uuid;
update subscriptions set free_until = public.business_today(business_id), access_type = 'pilot' where business_id = current_setting('t.b2')::uuid;
update subscriptions set free_until = public.business_today(business_id) + 20 where business_id = current_setting('t.b3')::uuid;
update subscriptions set free_until = public.business_today(business_id) + 2
where business_id in (current_setting('t.b4')::uuid, current_setting('t.b5')::uuid);
insert into owner_contacts (user_id, phone, whatsapp_ok, whatsapp_ok_at) values (pg_temp.u('b1'), '+971501234567', true, now());
insert into member_seen (member_id, business_id, last_seen_at, language)
select id, business_id, now(), 'ar' from members where user_id = pg_temp.u('b1');
insert into plan_events (business_id, kind, months, amount_minor, currency, created_at)
values (current_setting('t.b6')::uuid, 'request', 6, 30000, 'AED', now() - interval '35 days'),
       (current_setting('t.b6')::uuid, 'request', 12, 60000, 'AED', now() - interval '3 days');

select pg_temp.as_user('a0');
create temp table up on commit drop as select admin_coming_up() as v;
select pg_temp.as_admin();
grant select on up to authenticated;
create function pg_temp.ending(p_name text) returns jsonb language sql as $$
  select x from up, jsonb_array_elements(v -> 'ending') x where x ->> 'name' = p_name
$$;

select is((select array_agg(x ->> 'name' order by x ->> 'name') from up, jsonb_array_elements(v -> 'ending') x
           where x ->> 'name' in ('Palm Salon', 'Cedar Cuts', 'Blue Comb', 'Test Salon 94', 'Closed Salon 94')),
  array['Cedar Cuts', 'Palm Salon'], 'ending in the next 7 days: not one in 20 days, nor the test or the closed salon');
select is(array[pg_temp.ending('Palm Salon') ->> 'status', pg_temp.ending('Palm Salon') ->> 'days_left',
                pg_temp.ending('Palm Salon') ->> 'whatsapp', pg_temp.ending('Palm Salon') ->> 'language',
                pg_temp.ending('Palm Salon') ->> 'owner_name', pg_temp.ending('Palm Salon') ->> 'email'],
  array['free', '3', '+971501234567', 'ar', 'Owner b1', 'coming-b1@test.local'],
  'a free period: days left, the WhatsApp number they agreed to, their language, name and email');
select is(array[pg_temp.ending('Cedar Cuts') ->> 'status', pg_temp.ending('Cedar Cuts') ->> 'days_left',
                pg_temp.ending('Cedar Cuts') ->> 'whatsapp', pg_temp.ending('Cedar Cuts') ->> 'language'],
  array['pilot', '0', null, 'en'], 'a pilot ending today: no WhatsApp without a number, English by default');
select is((select array[x ->> 'times', x ->> 'months', x ->> 'waiting_days']
           from up, jsonb_array_elements(v -> 'requests') x where x ->> 'name' = 'Asking Salon'),
  array['2', '12', '35'], 'a plan request waiting: asked twice, first 35 days ago, the latest for 12 months');

-- Once paid, the request no longer waits.
select pg_temp.as_user('a0');
select admin_activate(current_setting('t.b6')::uuid, 12, 60000, 'Bank');
select is((select count(*)::int from jsonb_array_elements(admin_coming_up() -> 'requests') x where x ->> 'name' = 'Asking Salon'), 0,
  'paid: no longer waiting');

-- Message owner.
select pg_temp.as_admin();
select set_config('t.seen_before', coalesce(salon_last_active(current_setting('t.b1')::uuid)::text, ''), false);
select pg_temp.as_user('a0');
select lives_ok($$ select admin_log_contact(current_setting('t.b1')::uuid, 'whatsapp') $$, 'WhatsApp to an owner who agreed to it');
select throws_ok($$ select admin_log_contact(current_setting('t.b2')::uuid, 'whatsapp') $$, '22023', 'invalid_setting',
  'not WhatsApp without their OK');
select lives_ok($$ select admin_log_contact(current_setting('t.b2')::uuid, 'email') $$, 'email is fine');
select throws_ok($$ select admin_log_contact(current_setting('t.b6')::uuid, 'email') $$, '22023', 'invalid_status',
  'nothing is ending for a paying salon');
select throws_ok($$ select admin_log_contact(current_setting('t.b1')::uuid, 'sms') $$, '22023', 'invalid_setting', 'only WhatsApp or email');

select pg_temp.as_admin();
select is((select array[after ->> 'channel', after ->> 'ending', (after ->> 'until')::date::text] from platform_audit
           where business_id = current_setting('t.b1')::uuid and action = 'salon:contact'),
  array['whatsapp', 'free', (public.business_today(current_setting('t.b1')::uuid) + 3)::text], 'written to Changes');
select is((select summary from audit_log where business_id = current_setting('t.b2')::uuid and entity_type = 'owner_contact'),
  'The platform owner messaged the salon owner by email: the pilot ends on ' || to_char(public.business_today(current_setting('t.b2')::uuid), 'YYYY-MM-DD'),
  'and to the salon''s history');
select is(coalesce(salon_last_active(current_setting('t.b1')::uuid)::text, ''), current_setting('t.seen_before'),
  'messaging the owner does not make the salon look used');

select pg_temp.as_user('b1');
select throws_ok($$ select admin_coming_up() $$, '42501', 'not_allowed', 'a salon owner cannot see this');

select * from finish();
rollback;
