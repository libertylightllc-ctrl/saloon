-- One free period everywhere (owner's fix list round 2, A3): a new salon's plan record and its free date both come from
-- "Free days for a new salon", labelled with that length, so Console → Plans and Console → Salons show the same date;
-- a changed setting gives the next salon the new length; the 7-day trial's function is gone.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000055' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'fp-' || x || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b0']) x;

create function pg_temp.salon(who text, name text) returns uuid language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000055' || who)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  return (create_business(jsonb_build_object('business_name', name, 'owner_name', 'Owner', 'mode', 'gents', 'vat_mode', 'off'))
          ->> 'business_id')::uuid;
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

update platform_settings set public_free_days = 30 where true;
select set_config('t.a', pg_temp.salon('a0', 'Free Period A')::text, true);
select pg_temp.as_admin();

-- 1–3. A new salon: "30-day free period", until today + 30, the same date its plan shows.
select is((select note from plan_events where business_id = current_setting('t.a')::uuid and kind = 'trial'),
  '30-day free period', 'labelled with the setting''s length');
select is((select paid_until from plan_events where business_id = current_setting('t.a')::uuid and kind = 'trial'),
  business_today(current_setting('t.a')::uuid) + 30, 'until today + 30');
select is((select paid_until from plan_events where business_id = current_setting('t.a')::uuid and kind = 'trial'),
  (select free_until from subscriptions where business_id = current_setting('t.a')::uuid),
  'the Plans record and the salon''s free date agree');

-- 4–6. The setting changed to 45: the next salon gets 45 days, labelled so.
update platform_settings set public_free_days = 45 where true;
select set_config('t.b', pg_temp.salon('b0', 'Free Period B')::text, true);
select pg_temp.as_admin();
select is((select note from plan_events where business_id = current_setting('t.b')::uuid and kind = 'trial'),
  '45-day free period', 'the next salon: the new length');
select is((select free_until from subscriptions where business_id = current_setting('t.b')::uuid),
  business_today(current_setting('t.b')::uuid) + 45, 'free for 45 days');
select is((select count(*)::int from plan_events where kind = 'trial' and note like '%free trial'
           and business_id in (current_setting('t.a')::uuid, current_setting('t.b')::uuid)), 0, 'no "free trial" label');

-- 7. Nothing can start a 7-day trial any more.
select hasnt_function('public', 'start_trial', array['uuid', 'uuid'], 'the 7-day trial''s function is gone');

select * from finish();
rollback;
