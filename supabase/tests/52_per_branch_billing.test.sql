-- Branches and per-branch prices (full update brief, Phase 6 f): each branch is the base price for up to 4 people who
-- sign in there, plus the extra for each person after that; the owner and the accountant count once, at the first
-- branch; 6 months at 10% off and 12 for the price of 10 (src/config/pricing.json), in AED and USD; the card price; an
-- owner adds branches (stock lines, sale numbers, rooms) and anyone moves between the branches they work at.
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);
grant execute on function public.branch_today(uuid), public.business_today(uuid), public.unique_business_code(text),
  public.branch_setting(uuid, text, jsonb) to authenticated;

-- Owners a0 (UAE) and b0 (USA); staff a1…a9, b1…b9 and bb; the accountant ac; the platform owner c0.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000052' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'pb-' || x || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'ac',
                  'b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'c0']) x;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000052' || p)::uuid,
    'role', 'authenticated')::text, true);
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
-- Staff logins <prefix><from>…<prefix><to> at branch `br` of salon `b`.
create function pg_temp.staff(b text, br text, prefix text, p_from int, p_to int, p_role text default 'staff')
returns void language plpgsql as $$
begin
  perform pg_temp.as_service();
  for i in p_from..p_to loop
    perform register_staff_member(jsonb_build_object('business_id', current_setting(b), 'branch_id', current_setting(br),
      'user_id', '00000000-0000-0000-0000-0000000052' || prefix || i, 'username', 'pb' || prefix || i,
      'display_name', 'Staff ' || prefix || i, 'role', p_role));
  end loop;
end $$;
create function pg_temp.status(who text, b text) returns jsonb language plpgsql as $$
begin
  perform pg_temp.as_user(who);
  return plan_status(current_setting(b)::uuid);
end $$;
create function pg_temp.total(who text, b text, p_months int) returns bigint language sql as $$
  select (l ->> 'total_minor')::bigint from jsonb_array_elements(pg_temp.status(who, b) -> 'lengths') l
  where (l ->> 'months')::int = p_months
$$;

select pg_temp.as_admin();
select set_config('salon.plan_check', 'off', false);
delete from platform_admins;
insert into platform_admins (user_id) values ('00000000-0000-0000-0000-0000000052c0');
update platform_settings set billing_enabled = true, card_payments = 'live', public_free_days = 30, included_people = 4,
  price_per_branch_minor = 5000, extra_person_minor = 1000, intl_price_per_branch_minor = 1399,
  intl_extra_person_minor = 299, currency = 'AED', intl_currency = 'USD' where true;

-- The billing lengths, as src/config/pricing.json has them.
select is(array[plan_length_tenths(1), plan_length_tenths(6), plan_length_tenths(12), plan_length_tenths(3)],
  array[10, 54, 100, null]::int[], '1 month, 6 at 10% off, 12 for the price of 10; no 3-month plan');

-- UAE: 1 branch, 4 people (the owner and 3 staff): AED 50; 270 for 6 months; 500 for 12.
select pg_temp.as_user('a0');
select set_config('t.a', create_business('{"business_name":"Branch Salon","owner_name":"Imran","mode":"ladies","vat_mode":"off"}') ->> 'business_id', false);
select set_config('t.a1', (select id::text from branches where business_id = current_setting('t.a')::uuid), false);
select pg_temp.staff('t.a', 't.a1', 'a', 1, 3);
select is((pg_temp.status('a0', 't.a') ->> 'monthly_minor')::bigint, 5000::bigint, '1 branch, 4 people: AED 50 a month');
select is(pg_temp.total('a0', 't.a', 6), 27000::bigint, 'AED 270 for 6 months');
select is(pg_temp.total('a0', 't.a', 12), 50000::bigint, 'AED 500 for 12 months');
-- 6 people: AED 70; 378 for 6 months; 700 for 12.
select pg_temp.staff('t.a', 't.a1', 'a', 4, 5);
select is((pg_temp.status('a0', 't.a') ->> 'monthly_minor')::bigint, 7000::bigint, '1 branch, 6 people: AED 70 a month');
select is(pg_temp.total('a0', 't.a', 6), 37800::bigint, 'AED 378 for 6 months');
select is(pg_temp.total('a0', 't.a', 12), 70000::bigint, 'AED 700 for 12 months');

-- A second branch, added by the owner, with 5 staff of its own; one of branch 1's staff leaves: 5 + 5 people.
select pg_temp.as_user('a0');
select set_config('t.a2', create_branch(jsonb_build_object('business_id', current_setting('t.a'), 'name', 'Marina',
  'address', 'Dubai Marina'))::text, false);
select is((select count(*)::int from branches where business_id = current_setting('t.a')::uuid), 2, 'the owner adds a branch');
select is((select mode::text from branches where id = current_setting('t.a2')::uuid), 'ladies', 'of the salon''s type');
select is((select count(*)::int from rooms where branch_id = current_setting('t.a2')::uuid), 2, 'with its starter rooms');
select is((select count(*)::int from stock_levels where branch_id = current_setting('t.a2')::uuid),
  (select count(*)::int from inventory_items where business_id = current_setting('t.a')::uuid), 'a stock line for every item');
select pg_temp.as_admin();
select ok(exists (select 1 from sale_counters where branch_id = current_setting('t.a2')::uuid), 'and its own sale numbers');
select pg_temp.as_user('a0');
select throws_ok($$ select create_branch(jsonb_build_object('business_id', current_setting('t.a'), 'name', 'marina')) $$,
  '23505', 'branch_name_taken', 'two branches cannot share a name');
select pg_temp.staff('t.a', 't.a2', 'a', 6, 9);
select pg_temp.as_admin();
update members set active = false where user_id = '00000000-0000-0000-0000-0000000052a5';
select pg_temp.staff('t.a', 't.a2', 'b', 9, 9);
select is(pg_temp.status('a0', 't.a') -> 'branches' -> 1 ->> 'people', '5', 'the second branch counts its own 5 people');
select is((pg_temp.status('a0', 't.a') ->> 'monthly_minor')::bigint, 12000::bigint, '2 branches of 5: AED 120 a month');
select is(pg_temp.total('a0', 't.a', 12), 120000::bigint, 'AED 1,200 for 12 months');

-- The owner (and the accountant) count once, at the first branch, wherever they are working.
select pg_temp.as_user('a0');
select set_my_branch(current_setting('t.a2')::uuid);
select is((select default_branch_id::text from members where user_id = '00000000-0000-0000-0000-0000000052a0'),
  current_setting('t.a2'), 'the owner moves to the second branch');
select is((pg_temp.status('a0', 't.a') ->> 'monthly_minor')::bigint, 12000::bigint, 'and is still counted once, at the first');
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.a'), 'branch_id', current_setting('t.a2'),
  'user_id', '00000000-0000-0000-0000-0000000052ac', 'username', 'pbac', 'display_name', 'Accountant', 'role', 'accountant'));
select is(pg_temp.status('a0', 't.a') -> 'branches' -> 0 ->> 'people', '6', 'the accountant counts at the first branch');
select pg_temp.as_admin();
update members set active = false where role = 'accountant' and business_id = current_setting('t.a')::uuid;

-- Staff move only between branches they work at; only the owner adds branches.
select pg_temp.as_user('a6');
select throws_ok($$ select set_my_branch(current_setting('t.a1')::uuid) $$, '42501', 'not_allowed',
  'staff cannot open a branch they do not work at');
select throws_ok($$ select create_branch(jsonb_build_object('business_id', current_setting('t.a'), 'name', 'Deira')) $$,
  '42501', 'not_allowed', 'staff cannot add branches');

-- USA: 2 branches of 5: USD 33.96 a month; 183.38 for 6 months; 339.60 for 12.
select pg_temp.as_user('b0');
select set_config('t.b', create_business('{"business_name":"US Branches","owner_name":"Marcus","mode":"gents","vat_mode":"off","country_code":"US","currency":"USD","timezone":"America/New_York","tax_name":"Sales tax","tax_rate_bps":0}') ->> 'business_id', false);
select set_config('t.b1', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select set_config('t.b2', create_branch(jsonb_build_object('business_id', current_setting('t.b'), 'name', 'Uptown'))::text, false);
select pg_temp.staff('t.b', 't.b1', 'b', 1, 4);
select pg_temp.staff('t.b', 't.b2', 'b', 5, 8);
select pg_temp.as_admin();
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000052bb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'pb-bb@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.b2'),
  'user_id', '00000000-0000-0000-0000-0000000052bb', 'username', 'pbbb', 'display_name', 'Staff bb', 'role', 'staff'));
select is(pg_temp.status('b0', 't.b') ->> 'currency', 'USD', 'a salon outside the UAE is priced in USD');
select is((pg_temp.status('b0', 't.b') ->> 'monthly_minor')::bigint, 3396::bigint, '2 branches of 5: USD 33.96 a month');
select is(pg_temp.total('b0', 't.b', 6), 18338::bigint, 'USD 183.38 for 6 months');
select is(pg_temp.total('b0', 't.b', 12), 33960::bigint, 'USD 339.60 for 12 months');

-- The card price (always USD) follows the same rule, with the length's discount.
select pg_temp.as_user('a0');
select is((card_checkout_start(current_setting('t.a')::uuid, 6) ->> 'amount_minor')::bigint, 18338::bigint,
  'card, UAE salon of 2 × 5 for 6 months: USD 183.38');
select throws_ok($$ select card_checkout_start(current_setting('t.a')::uuid, 3) $$, '22023', 'invalid_amount', 'no 3-month plan');

-- Asking for the plan keeps the amount for the console; with billing off nothing can be asked for or paid.
select request_plan(current_setting('t.a')::uuid, 12, null);
select pg_temp.as_admin();
select is((select amount_minor from plan_events where business_id = current_setting('t.a')::uuid and kind = 'request'),
  120000::bigint, 'a 12-month request for AED 1,200');
update platform_settings set billing_enabled = false where true;
select pg_temp.as_user('a0');
select throws_ok($$ select request_plan(current_setting('t.a')::uuid, 1, null) $$, '22023', 'billing_off',
  'billing off: no plan to ask for');

select * from finish();
rollback;
