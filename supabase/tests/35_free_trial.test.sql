-- The free period, the pilot and the one access check (full update brief, Phase 6; this was the 7-day trial's test):
-- a new salon is free for the public free days; billing off lets every open salon work; with billing on an ended free
-- period locks new work until paid, while a pilot, a paid plan or free-for-good keeps it open; pilot codes (any letter
-- case, one pilot per salon, used up, expired, rate-limited, given at sign-up); the console's controls are recorded with
-- their old and new values; pilot applications (honeypot, rate limit, approval with a code); the 14- and 3-day notices.
begin;
create extension if not exists pgtap with schema extensions;
select plan(48);
grant execute on function public.branch_today(uuid), public.business_today(uuid), public.unique_business_code(text),
  public.branch_setting(uuid, text, jsonb) to authenticated;

-- Owners a0, b0, e0 (e0 typed a pilot code at sign-up), the platform owner c0, staff f1 of salon A.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000035' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'ft-' || x || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}',
       case when x = 'e0' then '{"pilot_code":"pilot-signup"}' else '{}' end::jsonb
from unnest(array['a0', 'b0', 'c0', 'e0', 'f1']) x;

create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000035' || p)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
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
-- Salon `b`'s plan, as its owner `who` sees it.
create function pg_temp.status(who text, b text, k text) returns text language plpgsql as $$
begin
  perform pg_temp.as_user(who);
  return plan_status(current_setting(b)::uuid) ->> k;
end $$;
create function pg_temp.walk_in(who text, br text) returns uuid language plpgsql as $$
begin
  perform pg_temp.as_user(who);
  return create_appointment(jsonb_build_object('branch_id', current_setting(br), 'kind', 'walk_in', 'guest_name', 'Sara'));
end $$;
create function pg_temp.redeem(who text, b text, code text) returns jsonb language plpgsql as $$
begin
  perform pg_temp.as_user(who);
  return redeem_pilot_code(current_setting(b)::uuid, code);
end $$;
create function pg_temp.admin(p_action text, b text, p jsonb default '{}') returns jsonb language plpgsql as $$
begin
  perform pg_temp.as_user('c0');
  return admin_set_access(current_setting(b)::uuid, p || jsonb_build_object('action', p_action));
end $$;
create function pg_temp.billing(p_on boolean) returns void language plpgsql as $$
begin
  perform pg_temp.as_user('c0');
  perform admin_set_billing(jsonb_build_object('billing_enabled', p_on));
end $$;
create function pg_temp.salon(who text, name text) returns text language plpgsql as $$
begin
  perform pg_temp.as_user(who);
  return create_business(jsonb_build_object('business_name', name, 'owner_name', 'Owner', 'mode', 'gents', 'vat_mode', 'off'))
         ->> 'business_id';
end $$;

select pg_temp.as_admin();
delete from platform_admins;
insert into platform_admins (user_id) values ('00000000-0000-0000-0000-0000000035c0');
update platform_settings set billing_enabled = false, public_free_days = 30, pilot_free_days = 90, pilot_max_salons = 3
where true;
-- Other salons in this database are not pilots (the places are counted from real pilots).
update subscriptions set access_type = 'trial' where access_type = 'pilot';

-- A new salon: free for 30 days from today, open at once.
select set_config('t.a', pg_temp.salon('a0', 'Free Salon A'), false);
select set_config('t.abr', (select id::text from branches where business_id = current_setting('t.a')::uuid), false);
select is(pg_temp.status('a0', 't.a', 'free_until')::date, pg_temp.status('a0', 't.a', 'today')::date + 30,
  'a new salon is free for the public free days');
select is(pg_temp.status('a0', 't.a', 'access_type'), 'trial', 'on its free period');
select is(pg_temp.status('a0', 't.a', 'billing_enabled'), 'false', 'with billing off');
select isnt(pg_temp.walk_in('a0', 't.abr'), null, 'the queue works');

-- Billing on: the free period still counts; ended, new work is refused; billing off again opens it.
select pg_temp.billing(true);
select is(pg_temp.status('a0', 't.a', 'active'), 'true', 'billing on: open during the free period');
select pg_temp.admin('end_now', 't.a');
select is(pg_temp.status('a0', 't.a', 'active'), 'false', 'billing on: the free period ended');
select throws_ok($$ select pg_temp.walk_in('a0', 't.abr') $$, 'PT402', 'plan_required', 'so new work is refused');
select pg_temp.billing(false);
select is(pg_temp.status('a0', 't.a', 'active'), 'true', 'billing off: an ended free period still works');
select isnt(pg_temp.walk_in('a0', 't.abr'), null, 'the queue works again');
select pg_temp.billing(true);

-- The pilot: a code in any letter case, the later of the current free time and today + its days.
select pg_temp.as_user('c0');
select is(admin_create_pilot_code('{"code":"PILOT-DXB-07","days":60,"max_uses":1}'), 'PILOT-DXB-07', 'the platform owner creates a code');
select admin_create_pilot_code(jsonb_build_object('code', 'PILOT-OLD', 'days', 90, 'max_uses', 5,
  'expires_on', (current_date - 1)::text));
select admin_create_pilot_code('{"code":"PILOT-SIGNUP","days":90,"max_uses":5}');
select is(pg_temp.redeem('a0', 't.a', ' pilot-dxb-07 ') ->> 'ok', 'true', 'the owner uses it, in lower case');
select is(pg_temp.status('a0', 't.a', 'access_type'), 'pilot', 'the salon is a pilot salon');
select is(pg_temp.status('a0', 't.a', 'free_until')::date, pg_temp.status('a0', 't.a', 'today')::date + 60, 'free for its 60 days');
select is(pg_temp.status('a0', 't.a', 'active'), 'true', 'and open');

select set_config('t.b', pg_temp.salon('b0', 'Free Salon B'), false);
select is(pg_temp.redeem('b0', 't.b', 'PILOT-DXB-07') ->> 'reason', 'code_used_up', 'a code past its uses is refused');
select is(pg_temp.redeem('b0', 't.b', 'PILOT-OLD') ->> 'reason', 'code_expired', 'an expired code is refused');
select is(pg_temp.redeem('b0', 't.b', 'NOPE-123') ->> 'reason', 'invalid_code', 'an unknown code is refused');
select is(pg_temp.redeem('a0', 't.a', 'PILOT-SIGNUP') ->> 'reason', 'pilot_already', 'one pilot per salon');
select pg_temp.redeem('b0', 't.b', 'NOPE-' || n) from generate_series(1, 8) n;
select is(pg_temp.redeem('b0', 't.b', 'PILOT-SIGNUP') ->> 'reason', 'too_many_attempts', 'ten wrong codes in an hour: wait');

-- A staff login cannot use codes; it still works while the salon is open.
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.a'), 'branch_id', current_setting('t.abr'),
  'user_id', '00000000-0000-0000-0000-0000000035f1', 'username', 'ftstaff1', 'display_name', 'Staff 1', 'role', 'staff'));
select throws_ok($$ select pg_temp.redeem('f1', 't.a', 'PILOT-SIGNUP') $$, '42501', 'not_allowed', 'staff cannot use pilot codes');
select isnt(pg_temp.walk_in('f1', 't.abr'), null, 'staff work in an open pilot salon');

-- A code typed at sign-up is used when the salon is created.
select set_config('t.e', pg_temp.salon('e0', 'Pilot From Sign-up'), false);
select is(pg_temp.status('e0', 't.e', 'access_type'), 'pilot', 'a sign-up code makes the new salon a pilot salon');
select is(pg_temp.status('e0', 't.e', 'free_until')::date, pg_temp.status('e0', 't.e', 'today')::date + 90,
  'free for the code''s days');

-- The pilot's places come from the real pilots: 3 places, 2 used.
select pg_temp.as_anon();
select is((pilot_status() ->> 'places_left')::int, 1, 'visitors see the places left');
select is((pilot_status() ->> 'days')::int, 90, 'and the pilot''s days');

-- A pilot that ended locks like any free period (billing on); paid and free-for-good stay open.
select pg_temp.admin('end_now', 't.a');
select is(pg_temp.status('a0', 't.a', 'active'), 'false', 'an ended pilot is closed for new work');
select pg_temp.as_user('c0');
select admin_activate(current_setting('t.a')::uuid, 1, 5000, 'Bank transfer');
select is(pg_temp.status('a0', 't.a', 'access_type'), 'paid', 'a payment makes it paid');
select is(pg_temp.status('a0', 't.a', 'active'), 'true', 'and open');
select pg_temp.admin('end_now', 't.b');
select is(pg_temp.status('b0', 't.b', 'active'), 'false', 'salon B''s free period ended');
select pg_temp.admin('comp', 't.b');
select is(pg_temp.status('b0', 't.b', 'active'), 'true', 'free for good: open whatever the dates');
select is(pg_temp.admin('extend', 't.b') ->> 'free_until', (pg_temp.status('b0', 't.b', 'today')::date + 30)::text,
  'extend: 30 more days from today');
select is(pg_temp.admin('note', 't.b', '{"note":"Met at the Dubai expo"}') ->> 'admin_note', 'Met at the Dubai expo', 'a note');

-- Every change is recorded with who, when, old and new.
select pg_temp.as_user('c0');
select is((select before ->> 'access_type' from admin_platform_audit() where action = 'access:comp' limit 1), 'trial',
  'the record keeps the old value');
select is((select after ->> 'access_type' from admin_platform_audit() where action = 'access:comp' limit 1), 'comp',
  'and the new one');
select is((select after ->> 'billing_enabled' from admin_platform_audit() where action = 'settings' limit 1), 'true',
  'billing switches are recorded');
select pg_temp.as_user('a0');
select throws_ok($$ select admin_set_billing('{"billing_enabled":false}') $$, '42501', 'not_allowed', 'owners cannot switch billing');
select throws_ok($$ select * from admin_platform_audit() $$, '42501', 'not_allowed', 'nor read the record');

-- Pilot applications: a filled-in hidden field is dropped; three an hour from one address; approval gives a code.
select pg_temp.as_anon();
select set_config('request.headers', '{"x-forwarded-for":"203.0.113.9"}', true);
create function pg_temp.apply(extra jsonb default '{}') returns jsonb language sql as $$
  select apply_for_pilot(jsonb_build_object('name', 'Mariam', 'salon_name', 'Al Wasl Ladies', 'emirate', 'dubai',
    'area', 'Al Wasl', 'salon_type', 'ladies', 'staff_count', 6, 'whatsapp', '+971 50 123 4567', 'language', 'ar',
    'whatsapp_ok', true) || extra)
$$;
select is(pg_temp.apply('{"website":"spam.example"}') ->> 'ok', 'true', 'a bot is thanked');
select pg_temp.as_admin();
-- Only this test's rows (made in this transaction): local end-to-end runs leave applications of their own.
select is((select count(*)::int from pilot_applications where created_at >= now()), 0, 'and nothing is kept');
select pg_temp.as_anon();
select is(pg_temp.apply('{"staff_count":0}') ->> 'reason', 'invalid', 'a wrong answer is refused');
select is(pg_temp.apply() ->> 'ok', 'true', 'a salon applies');
select pg_temp.apply(), pg_temp.apply();
select is(pg_temp.apply() ->> 'reason', 'too_many', 'the fourth in an hour from one address waits');
select pg_temp.as_user('c0');
select set_config('t.app', (select id::text from admin_pilot_applications() where created_at >= now() order by created_at limit 1), false);
select ok((admin_decide_pilot_application(current_setting('t.app')::uuid, true) ->> 'code') like 'PILOT-%',
  'approving gives a one-use code for the WhatsApp message');
select is((select status from admin_pilot_applications() where id = current_setting('t.app')::uuid), 'approved', 'approved');

-- With billing on, the owner is told 14 and 3 days before the free time ends, from 09:00 salon time, once each.
select pg_temp.as_admin();
update subscriptions set access_type = 'paid' where business_id not in (current_setting('t.b')::uuid);
update subscriptions set access_type = 'trial', free_until = business_today(business_id) + 14
where business_id = current_setting('t.b')::uuid;
create function pg_temp.at(p_day_offset int, p_time time) returns timestamptz language sql as $$
  select ((business_today(current_setting('t.b')::uuid) + p_day_offset) + p_time)
         at time zone (select timezone from businesses where id = current_setting('t.b')::uuid)
$$;
select is(notify_trials_ending(pg_temp.at(0, '08:00')), 0, 'not before 09:00');
select is(notify_trials_ending(pg_temp.at(0, '09:30')), 1, '14 days before: the owner is told');
select is(notify_trials_ending(pg_temp.at(0, '10:30')), 0, 'once');
update platform_settings set billing_enabled = false where true;
select is(notify_trials_ending(pg_temp.at(11, '09:30')), 0, 'nothing while billing is off');

select * from finish();
rollback;
