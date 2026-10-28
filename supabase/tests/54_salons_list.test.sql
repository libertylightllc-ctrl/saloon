-- The console's Salons list works out every salon's price and plan in one pass (owner's fix list #12). It must agree
-- with plan_quote and plan_active, salon by salon: owners and accountants at the first branch, staff at their own
-- branch (or the first when theirs belongs to another salon or they have none), logins switched off not counted, a
-- salon with no branch, UAE and other prices, and paid, comp, ended, closed and no-plan salons.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(8);

-- Owners a0, b0, d0; staff a1…a9 and b1; the platform owner c0.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000054' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'sl-' || x || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'b0', 'b1', 'c0', 'd0']) x;
create function pg_temp.u(p text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000054' || p)::uuid $$;
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

delete from platform_admins;
insert into platform_admins (user_id) values (pg_temp.u('c0'));
update platform_settings set billing_enabled = true, included_people = 4, price_per_branch_minor = 5000,
  extra_person_minor = 1000, intl_price_per_branch_minor = 1399, intl_extra_person_minor = 299, currency = 'AED',
  intl_currency = 'USD' where true;

-- A (UAE, 2 branches, paid), B (USA, 1 branch, comp), C (UAE, no branch, free time ended), D (closed, paid), E (no plan).
insert into businesses (id, name, code, country_code, timezone) values
  ('54000000-0000-0000-0000-00000000000a', 'List A', 'lista', 'AE', 'Asia/Dubai'),
  ('54000000-0000-0000-0000-00000000000b', 'List B', 'listb', 'US', 'America/New_York'),
  ('54000000-0000-0000-0000-00000000000c', 'List C', 'listc', 'AE', 'Asia/Dubai'),
  ('54000000-0000-0000-0000-00000000000d', 'List D', 'listd', 'AE', 'Asia/Dubai'),
  ('54000000-0000-0000-0000-00000000000e', 'List E', 'liste', 'AE', 'Asia/Dubai');
update businesses set closed_at = now() where id = '54000000-0000-0000-0000-00000000000d';
insert into branches (id, business_id, name, mode, created_at) values
  ('54000000-0000-0000-0000-0000000000a1', '54000000-0000-0000-0000-00000000000a', 'A first', 'gents', now() - interval '2 days'),
  ('54000000-0000-0000-0000-0000000000a2', '54000000-0000-0000-0000-00000000000a', 'A second', 'gents', now() - interval '1 day'),
  ('54000000-0000-0000-0000-0000000000b1', '54000000-0000-0000-0000-00000000000b', 'B only', 'ladies', now()),
  ('54000000-0000-0000-0000-0000000000d1', '54000000-0000-0000-0000-00000000000d', 'D only', 'gents', now()),
  ('54000000-0000-0000-0000-0000000000e1', '54000000-0000-0000-0000-00000000000e', 'E only', 'gents', now());
insert into members (business_id, user_id, role, display_name, default_branch_id, active)
select '54000000-0000-0000-0000-00000000000a'::uuid, pg_temp.u(x), r::member_role, 'Person ' || x, br::uuid, act
from (values
  ('a0', 'owner', '54000000-0000-0000-0000-0000000000a2', true),       -- owner: first branch, wherever they work
  ('a1', 'accountant', '54000000-0000-0000-0000-0000000000a2', true),  -- accountant: first branch too
  ('a2', 'staff', '54000000-0000-0000-0000-0000000000a2', true),
  ('a3', 'staff', '54000000-0000-0000-0000-0000000000a2', true),
  ('a4', 'cashier', '54000000-0000-0000-0000-0000000000a2', true),
  ('a5', 'staff', '54000000-0000-0000-0000-0000000000a2', true),
  ('a6', 'staff', '54000000-0000-0000-0000-0000000000a2', true),
  ('a7', 'staff', '54000000-0000-0000-0000-0000000000a2', true),     -- 6 at the second branch: 2 over the 4
  ('a8', 'staff', null, true),                                          -- no branch: the first
  ('a9', 'staff', '54000000-0000-0000-0000-0000000000a2', false)       -- switched off: not counted
) v(x, r, br, act);
insert into members (business_id, user_id, role, display_name, default_branch_id) values
  ('54000000-0000-0000-0000-00000000000b', pg_temp.u('b0'), 'owner', 'Owner B', '54000000-0000-0000-0000-0000000000b1'),
  -- a branch of another salon: counted at this salon's first branch
  ('54000000-0000-0000-0000-00000000000b', pg_temp.u('b1'), 'staff', 'Staff B', '54000000-0000-0000-0000-0000000000a1'),
  ('54000000-0000-0000-0000-00000000000c', pg_temp.u('d0'), 'owner', 'Owner C', null),
  ('54000000-0000-0000-0000-00000000000d', pg_temp.u('d0'), 'owner', 'Owner D', '54000000-0000-0000-0000-0000000000d1'),
  ('54000000-0000-0000-0000-00000000000e', pg_temp.u('d0'), 'owner', 'Owner E', '54000000-0000-0000-0000-0000000000e1');
delete from subscriptions where business_id::text like '54000000-%';
insert into subscriptions (business_id, access_type, paid_until, free_until) values
  ('54000000-0000-0000-0000-00000000000a', 'paid', current_date + 10, null),
  ('54000000-0000-0000-0000-00000000000b', 'comp', null, null),
  ('54000000-0000-0000-0000-00000000000c', 'trial', null, current_date - 2),
  ('54000000-0000-0000-0000-00000000000d', 'paid', current_date + 10, null);

-- 1–2. All at once gives what one at a time gives, for every salon (these and the seeded ones).
select bag_eq(
  $$ select b.id, q.people, q.included_people, q.base_minor, q.extra_person_minor, q.monthly_minor, q.currency
     from businesses b cross join lateral plan_quote(b.id) q $$,
  $$ select business_id, people, included_people, base_minor, extra_person_minor, monthly_minor, currency from plan_quotes() $$,
  'every salon is priced the same, one at a time or all at once');
select results_eq(
  $$ select people, monthly_minor, currency from plan_quotes() where business_id::text like '54000000-%' order by business_id $$,
  $$ values (9, 12000::bigint, 'AED'::text), (2, 1399::bigint, 'USD'::text), (0, 0::bigint, 'AED'::text),
            (1, 5000::bigint, 'AED'::text), (1, 5000::bigint, 'AED'::text) $$,
  'A: 9 people, 2 branches + 2 extra = AED 120; B: 2 people, USD 13.99; C: no branch, nothing');

-- 3–5. The list as the platform owner: the same price, and "active" as plan_active has it.
select pg_temp.as_user('c0');
create temp table listed as select * from admin_salons();
select pg_temp.as_admin();
select bag_eq($$ select business_id, active from listed $$,
  $$ select id, plan_active(id) from businesses where not is_demo $$, 'billing on: every salon active as plan_active says');
select results_eq($$ select name, active, people, monthly_minor from listed where name like 'List %' order by name $$,
  $$ values ('List A'::text, true, 9, 12000::bigint), ('List B', true, 2, 1399::bigint), ('List C', false, 0, 0::bigint),
            ('List D', false, 1, 5000::bigint), ('List E', false, 1, 5000::bigint) $$,
  'paid and comp are active; ended free time, closed and no plan are not');
update platform_settings set billing_enabled = false where true;
select pg_temp.as_user('c0');
create temp table listed_off as select * from admin_salons();
select pg_temp.as_admin();
select bag_eq($$ select business_id, active from listed_off $$,
  $$ select id, plan_active(id) from businesses where not is_demo $$, 'billing off: the same as plan_active (only closed is off)');

-- 6. Nothing else changed: the list is still for the platform owner only, and the new helper is the server's own.
select pg_temp.as_user('a0');
select throws_ok($$ select * from admin_salons() $$, '42501', null, 'an owner cannot read the salons list');
select throws_ok($$ select * from plan_quotes() $$, '42501', null, 'nor every salon''s price');
select pg_temp.as_admin();
select is((select count(*)::int from listed where name like 'List %' and owner_name is not null), 5,
  'each salon still shows its owner');

select * from finish();
rollback;
