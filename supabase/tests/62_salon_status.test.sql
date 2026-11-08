-- The console's salon status (owner, 8 Nov 2026): each salon is in one group — paid, free, pilot, free for good, ended
-- or closed — so the Overview's groups add up to its salon total, "ended" is a salon whose last period is over, the list
-- gives the day it ended, and who can use the app is as before.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(16);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000062' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'salon-status-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b0', 'c0', 'd0', 'e0', 'f0', 'a1', 'b1', 'c1', 'd1']) n;
insert into platform_admins (user_id) values ('00000000-0000-0000-0000-0000000062d1');
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000062' || p)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.n(o jsonb, k text) returns int language sql as $$ select (o ->> k)::int $$;

-- The Overview before these salons, to count what they add.
select pg_temp.as_user('d1');
select set_config('t.before', admin_overview()::text, false);

-- One salon for each case: A paid, B free, C pilot, D free for good, E ended (paid), F ended (free; it paid earlier),
-- A1 closed, B1 a test salon that ended, C1 paid while still in its free period.
create function pg_temp.salon(p text) returns uuid language plpgsql as $$
declare v uuid;
begin
  perform pg_temp.as_user(p);
  v := (create_business(json_build_object('business_name', 'Status ' || p, 'owner_name', 'Owner ' || p, 'mode', 'gents')::jsonb)
        ->> 'business_id')::uuid;
  perform set_config('t.' || p, v::text, false);
  return v;
end $$;
select pg_temp.salon(p) from unnest(array['a0', 'b0', 'c0', 'd0', 'e0', 'f0', 'a1', 'b1', 'c1']) p;
reset role;
create function pg_temp.id(p text) returns uuid language sql as $$ select current_setting('t.' || p)::uuid $$;
insert into subscriptions (business_id, access_type, free_until, paid_until)
select pg_temp.id(p), a, public.business_today(pg_temp.id(p)) + f, public.business_today(pg_temp.id(p)) + d
from (values ('a0', 'paid', null, 30), ('b0', 'trial', 5, null), ('c0', 'pilot', 60, null), ('d0', 'comp', null, null),
             ('e0', 'paid', null, -3), ('f0', 'trial', -1, -20), ('a1', 'paid', null, 30), ('b1', 'trial', -2, null),
             ('c1', 'trial', 5, 20)) v (p, a, f, d)
on conflict (business_id) do update
  set access_type = excluded.access_type, free_until = excluded.free_until, paid_until = excluded.paid_until;
update businesses set closed_at = now() where id = pg_temp.id('a1');
insert into test_salons (business_id, test, changed_by) values (pg_temp.id('b1'), true, '00000000-0000-0000-0000-0000000062d1');

-- 1–8. The Overview: what these salons add to each group, and the groups add up to the total.
select pg_temp.as_user('d1');
select set_config('t.after', admin_overview()::text, false);
create function pg_temp.added(k text) returns int language sql as $$
  select pg_temp.n(current_setting('t.after')::jsonb, k) - pg_temp.n(current_setting('t.before')::jsonb, k)
$$;
select is(pg_temp.added('salons'), 7, 'seven open salons counted (the closed one and the test one are not)');
select is(pg_temp.added('salons_plan_active'), 2, 'two paid, one of them still in its free period');
select is(pg_temp.added('salons_trial'), 1, 'one free');
select is(pg_temp.added('salons_pilot'), 1, 'one pilot');
select is(pg_temp.added('salons_comp'), 1, 'one free for good');
select is(pg_temp.added('salons_ended'), 2, 'two ended');
select is(pg_temp.added('salons_closed'), 1, 'one closed, counted apart');
select is((select pg_temp.n(o, 'salons_plan_active') + pg_temp.n(o, 'salons_trial') + pg_temp.n(o, 'salons_pilot')
                  + pg_temp.n(o, 'salons_comp') + pg_temp.n(o, 'salons_ended')
           from (select current_setting('t.after')::jsonb o) x),
          pg_temp.n(current_setting('t.after')::jsonb, 'salons'), 'the groups add up to the total');

-- 9–11. The list: each salon's status, and the day an ended one ended. (Still as the platform owner; the role is reset
--       only so the test can read a salon's business date.)
reset role;
select is((select array_agg(s.status order by w.n) from admin_salons() s
            join unnest(array['a0', 'b0', 'c0', 'd0', 'e0', 'f0', 'a1', 'b1', 'c1']) with ordinality w (p, n) on s.name = 'Status ' || w.p),
          array['paid', 'free', 'pilot', 'comp', 'ended', 'ended', 'closed', 'ended', 'paid'], 'each salon''s status');
select is((select s.ended_on from admin_salons() s where s.business_id = pg_temp.id('e0')),
          public.business_today(pg_temp.id('e0')) - 3, 'an ended plan: the day it was paid until');
select is((select s.ended_on from admin_salons() s where s.business_id = pg_temp.id('f0')),
          public.business_today(pg_temp.id('f0')) - 1, 'an ended free period that came after a payment: its own last day');

-- 12–14. Who can use the app is as before: with billing on an ended salon cannot save new work and the others can;
--        with billing off everyone can.
reset role;
update platform_settings set billing_enabled = true;
select ok(not public.plan_active(pg_temp.id('e0')) and not public.plan_active(pg_temp.id('f0')), 'billing on: ended salons are stopped');
select ok(public.plan_active(pg_temp.id('a0')) and public.plan_active(pg_temp.id('b0')) and public.plan_active(pg_temp.id('c0'))
          and public.plan_active(pg_temp.id('d0')) and public.plan_active(pg_temp.id('c1')), 'billing on: the others work');
update platform_settings set billing_enabled = false;
select ok(public.plan_active(pg_temp.id('e0')), 'billing off: an ended salon works');

-- 15–16. Only platform owners see the console.
select pg_temp.as_user('a0');
select throws_ok($$ select * from admin_salons() $$, '42501', null, 'a salon owner cannot read the salons list');
select throws_ok($$ select admin_overview() $$, '42501', null, 'nor the Overview');

select * from finish();
rollback;
