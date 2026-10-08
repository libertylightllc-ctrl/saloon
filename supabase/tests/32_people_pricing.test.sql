-- The plan is priced by people, per salon: the base covers 4 people who sign in, each one after that adds the extra.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(12);
grant execute on function public.branch_today(uuid), public.business_today(uuid), public.unique_business_code(text),
  public.branch_setting(uuid, text, jsonb) to authenticated;

-- Owners a (UAE) and u (USA), staff a1…a5 and u1…u5, and the platform owner p.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000032' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'pp-' || x || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'c0']) x;

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
-- Gives salon `b` (branch `br`) staff logins for users <prefix>1…<prefix>n.
create function pg_temp.staff(b text, br text, prefix text, n int) returns void language plpgsql as $$
begin
  for i in 1..n loop
    perform register_staff_member(jsonb_build_object('business_id', current_setting(b), 'branch_id', current_setting(br),
      'user_id', '00000000-0000-0000-0000-0000000032' || prefix || i, 'username', 'pp' || prefix || i,
      'display_name', 'Staff ' || prefix || i, 'role', 'staff'));
  end loop;
end $$;
create function pg_temp.monthly(b text) returns bigint language sql as $$
  select (plan_status(current_setting(b)::uuid) ->> 'monthly_minor')::bigint
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000032a0');
select set_config('t.a', (create_business('{"business_name":"People Salon","owner_name":"Owner","mode":"gents","vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.abr', (select id::text from branches where business_id = current_setting('t.a')::uuid), false);
select is(plan_status(current_setting('t.a')::uuid) - 'paid_until' - 'requested_at' - 'requested_months' - 'active',
  '{"people":1,"included_people":4,"base_minor":5000,"extra_person_minor":1000,"monthly_minor":5000,"currency":"AED"}'::jsonb,
  'the owner alone: AED 50 covers up to 4 people');

select pg_temp.as_service();
select pg_temp.staff('t.a', 't.abr', 'a', 3);
select pg_temp.as_user('00000000-0000-0000-0000-0000000032a0');
select is(pg_temp.monthly('t.a'), 5000::bigint, '4 people: still AED 50');

select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.a'), 'branch_id', current_setting('t.abr'),
  'user_id', '00000000-0000-0000-0000-0000000032a4', 'username', 'ppa4', 'display_name', 'Staff a4', 'role', 'cashier'));
select pg_temp.as_user('00000000-0000-0000-0000-0000000032a0');
select is(pg_temp.monthly('t.a'), 6000::bigint, 'the 5th person (a cashier counts too) adds AED 10');

select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.a'), 'branch_id', current_setting('t.abr'),
  'user_id', '00000000-0000-0000-0000-0000000032a5', 'username', 'ppa5', 'display_name', 'Staff a5', 'role', 'accountant'));
select pg_temp.as_user('00000000-0000-0000-0000-0000000032a0');
select is(pg_temp.monthly('t.a'), 7000::bigint, '6 people: AED 50 + 2 × 10 = AED 70');

-- A login switched off does not count; a second branch does not change the price.
select pg_temp.as_admin();
update members set active = false where user_id = '00000000-0000-0000-0000-0000000032a5';
insert into branches (business_id, name, mode) values (current_setting('t.a')::uuid, 'Second branch', 'gents');
select pg_temp.as_user('00000000-0000-0000-0000-0000000032a0');
select is(pg_temp.monthly('t.a'), 6000::bigint, 'a login switched off is not counted, and branches cost nothing extra');
select is((plan_status(current_setting('t.a')::uuid) ->> 'people')::int, 5, 'the owner sees 5 people');

-- Outside the UAE: USD 13.99 for up to 4, USD 2.99 for each one after.
select pg_temp.as_user('00000000-0000-0000-0000-0000000032b0');
select set_config('t.u', (create_business('{"business_name":"People NY","owner_name":"Owner","mode":"gents","vat_mode":"off",
  "country_code":"US","currency":"USD","timezone":"America/New_York"}') ->> 'business_id'), false);
select set_config('t.ubr', (select id::text from branches where business_id = current_setting('t.u')::uuid), false);
select pg_temp.as_service();
select pg_temp.staff('t.u', 't.ubr', 'b', 5);
select pg_temp.as_user('00000000-0000-0000-0000-0000000032b0');
select is(pg_temp.monthly('t.u'), 1997::bigint, '6 people in New York: USD 13.99 + 2 × 2.99 = USD 19.97');

-- The platform owner's console shows each salon's people and monthly price.
select pg_temp.as_admin();
delete from platform_admins;
insert into platform_admins (user_id) values ('00000000-0000-0000-0000-0000000032c0');
select pg_temp.as_user('00000000-0000-0000-0000-0000000032c0');
select results_eq($$ select people, monthly_minor, plan_currency from admin_salons()
                     where business_id in (current_setting('t.a')::uuid, current_setting('t.u')::uuid) order by plan_currency $$,
  $$ values (5, 6000::bigint, 'AED'::text), (6, 1997::bigint, 'USD'::text) $$, 'the console shows people and the monthly price');

-- The plan request email reads the same price.
select pg_temp.as_user('00000000-0000-0000-0000-0000000032a0');
select request_plan(current_setting('t.a')::uuid, 3, null);
select pg_temp.as_service();
select results_eq($$ select people, included_people, base_minor, extra_person_minor, monthly_minor, months
                     from claim_plan_alerts() where salon = 'People Salon' $$,
  $$ values (5, 4, 5000::bigint, 1000::bigint, 6000::bigint, 3) $$, 'the request email has the people and the price');

-- The website reads the whole price; nobody signed in calls the quote directly.
set local role anon;
select is((select included_people || ' ' || extra_person_minor || ' ' || intl_extra_person_minor from platform_settings),
  '4 1000 299', 'visitors read the people price');
select pg_temp.as_user('00000000-0000-0000-0000-0000000032a0');
select throws_ok(format($$ select * from plan_quote('%s') $$, current_setting('t.a')), '42501', null,
  'the quote is not callable from the app');
select throws_ok(format($$ select * from plan_quote('%s') $$, current_setting('t.u')), '42501', null,
  'not for another salon either');

select * from finish();
rollback;
