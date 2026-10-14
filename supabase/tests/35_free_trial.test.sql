-- The free trial: a new salon works for 7 days without paying; one trial per owner; a payment during the trial runs on
-- from its end; an ended trial locks new work like an ended plan (reading still works); the owners are told the day
-- before; demo salons get none; only the database starts trials.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);
grant execute on function public.branch_today(uuid), public.business_today(uuid), public.unique_business_code(text),
  public.branch_setting(uuid, text, jsonb) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000035' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'ft-' || x || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b0', 'c0', 'd0']) x;

create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.status(p_key text) returns text language plpgsql as $$
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000035a0');
  return plan_status(current_setting('t.b')::uuid) ->> p_key;
end $$;
create function pg_temp.walk_in(p_name text) returns uuid language plpgsql as $$
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000035a0');
  return create_appointment(jsonb_build_object('branch_id', current_setting('t.br'), 'kind', 'walk_in',
    'guest_name', p_name));
end $$;

select pg_temp.as_admin();
delete from platform_admins;
insert into platform_admins (user_id) values ('00000000-0000-0000-0000-0000000035c0');
update platform_settings set trial_days = 7 where true;

-- A new salon starts its trial: 7 days on from today, everything works.
select pg_temp.as_user('00000000-0000-0000-0000-0000000035a0');
select set_config('t.b', (create_business('{"business_name":"Trial Salon","owner_name":"Mariam","mode":"ladies","vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_admin();
select set_config('t.until', (select paid_until::text from subscriptions where business_id = current_setting('t.b')::uuid), false);
select set_config('t.tz', (select timezone from businesses where id = current_setting('t.b')::uuid), false);
select is(pg_temp.status('active'), 'true', 'a new salon is open at once');
select is(pg_temp.status('trial'), 'true', 'on its free trial');
select is(pg_temp.status('paid_until')::date, pg_temp.status('today')::date + 7, 'for 7 days: to the same weekday next week');
select isnt(pg_temp.walk_in('Sara'), null, 'the queue works during the trial');

-- The platform owner sees it as a trial, not a paying salon.
select pg_temp.as_user('00000000-0000-0000-0000-0000000035c0');
select is((select trial from admin_salons() where name = 'Trial Salon'), true, 'the console marks it as a trial');
select ok((admin_overview() ->> 'salons_trial')::int >= 1, 'and counts trials apart from paid plans');
select is((select kind from admin_plan_events() where salon = 'Trial Salon' limit 1), 'trial', 'the plan history shows it');

-- The day before it ends, from 09:00 salon time, the owner is told once.
select pg_temp.as_admin();
create function pg_temp.at(p_day_offset int, p_time time) returns timestamptz language sql as $$
  select ((current_setting('t.until')::date + p_day_offset) + p_time) at time zone current_setting('t.tz')
$$;
-- (Other salons' trials in this database are left out of the count.)
update subscriptions set trial = false where business_id <> current_setting('t.b')::uuid;
select is(notify_trials_ending(pg_temp.at(-1, '08:00')), 0, 'not before 09:00 the day before');
select is(notify_trials_ending(pg_temp.at(-1, '09:30')), 1, 'then the owner is told');
select is(notify_trials_ending(pg_temp.at(-1, '10:30')), 0, 'once');
select is((select data ->> 'until' from notifications where type = 'trial_ending'
           and business_id = current_setting('t.b')::uuid), current_setting('t.until'), 'with the day it ends');

-- Once it has ended, nothing new can be saved; everything saved can still be read.
update subscriptions set paid_until = public.business_today(business_id) - 1 where business_id = current_setting('t.b')::uuid;
select is(pg_temp.status('active') || ' ' || pg_temp.status('trial'), 'false true', 'the ended trial shows as ended');
select throws_ok($$ select pg_temp.walk_in('Huda') $$, 'PT402', 'plan_required', 'new work is refused');
select pg_temp.as_user('00000000-0000-0000-0000-0000000035a0');
select is((select count(*)::int from appointments where business_id = current_setting('t.b')::uuid), 1,
  'what was saved during the trial is still there');

-- A payment during the trial runs on from its end.
select pg_temp.as_admin();
update subscriptions set paid_until = current_setting('t.until')::date where business_id = current_setting('t.b')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-0000000035c0');
select is(admin_activate(current_setting('t.b')::uuid, 1, 5000, 'Bank transfer'),
  (current_setting('t.until')::date + interval '1 month')::date, 'the paid month starts when the trial ends');
select is(pg_temp.status('trial'), 'false', 'and it is no longer a trial');

-- Only the database starts trials; with trials off a new owner's salon starts without one.
select pg_temp.as_user('00000000-0000-0000-0000-0000000035b0');
select throws_ok(format($$ select start_trial('%s', '00000000-0000-0000-0000-0000000035b0') $$, current_setting('t.b')),
  '42501', null, 'the app cannot start a trial');
select pg_temp.as_admin();
update platform_settings set trial_days = 0 where true;
select pg_temp.as_user('00000000-0000-0000-0000-0000000035d0');
select set_config('t.b4', (create_business('{"business_name":"No Trial Salon","owner_name":"Dana","mode":"ladies","vat_mode":"off"}') ->> 'business_id'), false);
select is((plan_status(current_setting('t.b4')::uuid) ->> 'active')::boolean, false, 'trials switched off: no trial');

-- One trial per person (a person has one salon, so this guards any other way in).
select pg_temp.as_admin();
update platform_settings set trial_days = 7 where true;
select is(start_trial(current_setting('t.b4')::uuid, '00000000-0000-0000-0000-0000000035a0'), false,
  'someone who has had a trial does not get another');
select is(start_trial(current_setting('t.b4')::uuid, '00000000-0000-0000-0000-0000000035d0'), true,
  'someone who has not, does');

select * from finish();
rollback;
