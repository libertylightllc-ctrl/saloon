-- Platform console, Part B (owner's brief, 24 Nov 2026; migration 117): B1 monthly recurring revenue (now and on the
-- last day of last month), B4 free-period conversion, B5 churn. Test salons and payments marked Test or Void are left
-- out; amounts stay in their own currency. The test database holds other salons, so each check compares with before.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000092' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'revenue-' || x || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9']) x;
create function pg_temp.u(p text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000092' || p)::uuid $$;
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
create function pg_temp.salon(p_user text, p_name text, p_country text default 'AE') returns uuid language plpgsql as $$
declare v uuid;
begin
  perform pg_temp.as_user(p_user);
  v := (create_business(jsonb_build_object('business_name', p_name, 'owner_name', 'Owner', 'mode', 'gents', 'vat_mode', 'off',
          'country_code', p_country, 'currency', case p_country when 'AE' then 'AED' else 'USD' end,
          'timezone', case p_country when 'AE' then 'Asia/Dubai' else 'America/New_York' end)) ->> 'business_id')::uuid;
  perform pg_temp.as_admin();
  return v;
end $$;
delete from platform_admins;
insert into platform_admins (user_id) values (pg_temp.u('a0'));
create function pg_temp.money(p jsonb, p_currency text) returns bigint language sql as $$
  select coalesce((select (x ->> 'minor')::bigint from jsonb_array_elements(p) x where x ->> 'currency' = p_currency), 0)
$$;
create temp table before on commit drop as select admin_revenue() as v from (select pg_temp.as_user('a0')) x;
select pg_temp.as_admin();

-- b1: a year for AED 9,900 (AED 825 a month). b2: a US salon, a month for USD 16.99. b3: switched on for 0.
-- b4: a test salon, paid. b5: paid, then its plan ended today. b6: paid, then closed today.
select set_config('t.b1', pg_temp.salon('b1', 'Year Salon')::text, false);
select set_config('t.b2', pg_temp.salon('b2', 'Month Salon', 'US')::text, false);
select set_config('t.b3', pg_temp.salon('b3', 'Zero Salon')::text, false);
select set_config('t.b4', pg_temp.salon('b4', 'Test Salon 92')::text, false);
select set_config('t.b5', pg_temp.salon('b5', 'Ended Salon')::text, false);
select set_config('t.b6', pg_temp.salon('b6', 'Closed Salon')::text, false);
insert into test_salons (business_id, test) values (current_setting('t.b4')::uuid, true);
select pg_temp.as_user('a0');
select admin_activate(current_setting('t.b1')::uuid, 12, 9900, 'Bank');
select admin_activate(current_setting('t.b2')::uuid, 1, 1699, 'Card');
select admin_activate(current_setting('t.b3')::uuid, 1, 0, 'On us');
select admin_activate(current_setting('t.b4')::uuid, 1, 5000, 'Ours');
select admin_activate(current_setting('t.b5')::uuid, 6, 30000, 'Bank');
select admin_activate(current_setting('t.b6')::uuid, 1, 5000, 'Bank');
select admin_end_plan(current_setting('t.b5')::uuid, 'Stopped paying');
select admin_close_salon(current_setting('t.b6')::uuid, 'Closed for good');

create temp table after on commit drop as select admin_revenue() as v;
select pg_temp.as_admin();
grant select on before, after to authenticated;
select pg_temp.as_user('a0');

select is((select (a.v ->> 'paying')::int - (b.v ->> 'paying')::int from before b, after a), 3,
  'paying: the year, the month and the one switched on for 0; not the test salon, the ended or the closed one');
select is((select (a.v ->> 'paying_unpriced')::int - (b.v ->> 'paying_unpriced')::int from before b, after a), 1,
  'the one switched on for 0 is paying but adds nothing');
select is((select pg_temp.money(a.v -> 'mrr', 'AED') - pg_temp.money(b.v -> 'mrr', 'AED') from before b, after a), 825::bigint,
  'a year for AED 9,900 is AED 825 a month');
select is((select pg_temp.money(a.v -> 'mrr', 'USD') - pg_temp.money(b.v -> 'mrr', 'USD') from before b, after a), 1699::bigint,
  'a US salon''s month stays in dollars');
select is((select (select array_agg(array[x ->> 'name', x ->> 'status', x ->> 'minor'] order by x ->> 'name') from jsonb_array_elements(a.v -> 'churn') x
                   where x ->> 'business_id' in (current_setting('t.b5'), current_setting('t.b6')))
           from after a),
  array[array['Closed Salon', 'closed', '5000'], array['Ended Salon', 'free', '5000']],
  'churn this month: the closed one, and the one whose plan ended (back on its free days), with what they paid a month');

-- Marked Void: out of the monthly figure, still paying.
select pg_temp.as_admin();
select set_config('t.pay1', (select id::text from plan_events where business_id = current_setting('t.b1')::uuid and kind = 'activate'), false);
select pg_temp.as_user('a0');
select admin_mark_payment(current_setting('t.pay1')::uuid, 'void', 'Paid twice by mistake');
select is((select pg_temp.money(admin_revenue() -> 'mrr', 'AED') - pg_temp.money(b.v -> 'mrr', 'AED') from before b), 0::bigint,
  'a payment marked Void adds nothing');

-- Last month: b7 paid on the 20th of last month until the 20th of next; b8 paid last month until the 10th of last month.
select pg_temp.as_admin();
select set_config('t.b7', pg_temp.salon('b7', 'Last Month Salon')::text, false);
select set_config('t.b8', pg_temp.salon('b8', 'Lapsed Salon')::text, false);
select set_config('t.month', date_trunc('month', now() at time zone 'Asia/Dubai')::date::text, false);
update businesses set created_at = (current_setting('t.month')::date - 40)::timestamp at time zone 'Asia/Dubai'
where id in (current_setting('t.b7')::uuid, current_setting('t.b8')::uuid);
insert into plan_events (business_id, kind, months, amount_minor, currency, paid_until, note, created_at)
values (current_setting('t.b7')::uuid, 'activate', 1, 5000, 'AED', current_setting('t.month')::date + 19, 'Bank',
        (current_setting('t.month')::date - 11)::timestamp at time zone 'Asia/Dubai'),
       (current_setting('t.b8')::uuid, 'activate', 1, 7000, 'AED', current_setting('t.month')::date - 21, 'Bank',
        (current_setting('t.month')::date - 25)::timestamp at time zone 'Asia/Dubai');
select pg_temp.as_user('a0');
select is((select pg_temp.money(admin_revenue() -> 'mrr_prev', 'AED') - pg_temp.money(b.v -> 'mrr_prev', 'AED') from before b), 5000::bigint,
  'on the last day of last month: the salon paid through it, not the one whose time ran out earlier');

-- B4: b9's free period ended 5 days ago without paying; b1's (a year paid) ended 10 days ago.
select pg_temp.as_admin();
select set_config('t.b9', pg_temp.salon('b9', 'Unpaid Salon')::text, false);
update subscriptions set free_until = public.business_today(business_id) - 5 where business_id = current_setting('t.b9')::uuid;
update subscriptions set free_until = public.business_today(business_id) - 10 where business_id = current_setting('t.b1')::uuid;
select pg_temp.as_user('a0');
create temp table conv on commit drop as select admin_revenue() -> 'conversion' as c;
select is((select array[(c ->> 'ended')::int - (b.v #>> '{conversion,ended}')::int, (c ->> 'paid')::int - (b.v #>> '{conversion,paid}')::int]
           from conv, before b),
  array[2, 0], 'free periods ended: two, and the one that paid was marked Void, so none paid');

select pg_temp.as_user('b1');
select throws_ok($$ select admin_revenue() $$, '42501', 'not_allowed', 'a salon owner cannot see the platform''s income');
select throws_ok($$ select * from salons_monthly(now()) $$, '42501', null, 'nor ask for a salon''s');

select * from finish();
rollback;
