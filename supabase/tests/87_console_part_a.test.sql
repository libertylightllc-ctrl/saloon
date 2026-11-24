-- Platform console, Part A (owner's brief, 24 Nov 2026; migrations 109 and 110).
-- A1: a deleted owner is "deleted on <date>", never the scrambled email the sign-in service leaves.
-- A2: deleted accounts are nobody's duplicate; other salons come with their codes.
-- A3: the Overview's numbers follow one rule (test and closed salons left out): the countries add up to the salons;
--     accounts are counted once, split into active, switched off and deleted.
-- A4: a platform owner marks a payment Test or Void (or counts it again) with a reason; the payment is unchanged,
--     the totals leave it out, Changes records it; Creem test-mode payments are marked Test as they arrive.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(22);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000087' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'console-a-' || x || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(),
       '{"provider":"email"}', '{}'
from unnest(array['a0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6']) x;
create function pg_temp.u(p text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000087' || p)::uuid $$;
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
create function pg_temp.salon(p_user text, p_name text, p_owner text) returns uuid language plpgsql as $$
declare v uuid;
begin
  perform pg_temp.as_user(p_user);
  v := (create_business(json_build_object('business_name', p_name, 'owner_name', p_owner, 'mode', 'gents',
                                          'vat_mode', 'off')::jsonb) ->> 'business_id')::uuid;
  perform pg_temp.as_admin();
  return v;
end $$;

-- a0 is the platform owner. b1 and b2: two salons called "Twin Cuts" whose owners are both "Sami Twin". b3 and b4:
-- owners who deleted their accounts (both "Deleted user" now). b5: a salon with a switched-off owner. b6: a test salon.
select set_config('t.b1', pg_temp.salon('b1', 'Twin Cuts', 'Sami Twin')::text, false);
select set_config('t.b2', pg_temp.salon('b2', 'Twin Cuts', 'Sami Twin')::text, false);
select set_config('t.b3', pg_temp.salon('b3', 'Gone One', 'Huda')::text, false);
select set_config('t.b4', pg_temp.salon('b4', 'Gone Two', 'Faris')::text, false);
select set_config('t.b5', pg_temp.salon('b5', 'Quiet Salon', 'Mona')::text, false);
select set_config('t.b6', pg_temp.salon('b6', 'Test Salon 87', 'Tess')::text, false);
delete from platform_admins;
insert into platform_admins (user_id) values (pg_temp.u('a0'));
insert into test_salons (business_id, test) values (current_setting('t.b6')::uuid, true);
-- What deleting an account does (delete_account_data, then the sign-in service's soft delete).
select delete_account_data(pg_temp.u(x)) from unnest(array['b3', 'b4']) x;
update auth.users set deleted_at = '2026-11-03 10:00+04', email = 'AqUeh__IRYXTQ9Swkf' || right(id::text, 4)
where id in (pg_temp.u('b3'), pg_temp.u('b4'));
update members set active = false where user_id = pg_temp.u('b5');
-- What the checks below compare with, read before signing in as the platform owner.
select set_config('t.code2', (select code from businesses where id = current_setting('t.b2')::uuid), false);
select set_config('t.branches', (select count(*)::text from branches br join businesses b on b.id = br.business_id
   where not b.is_demo and b.closed_at is null and not exists (select 1 from test_salons t where t.business_id = b.id and t.test)), false);

select pg_temp.as_user('a0');
-- A1.
select is((select array[owner_name, owner_email, owner_deleted_at::text] from admin_salons() where business_id = current_setting('t.b3')::uuid),
  array[null, null, '2026-11-03 06:00:00+00'], 'a deleted owner: no name or email, the day the account was deleted');
select is((select array[email, display_name] from admin_accounts() where user_id = pg_temp.u('b3')),
  array[null::text, null], 'Accounts: no scrambled email, no "Deleted user"');
select ok((select deleted_at is not null from admin_accounts() where user_id = pg_temp.u('b3')), 'but when it was deleted');
select ok(not exists (select 1 from admin_accounts() a where a.email like 'AqUeh%' or a.username like 'deleted-%'), 'nothing scrambled anywhere');
select is((select close_note from admin_salons() where business_id = current_setting('t.b3')::uuid), null,
  'closed by the owner''s deletion: no reason typed (the card says the owner deleted their account)');

-- A2.
select ok(not exists (select 1 from admin_salon_duplicates() where business_id in (current_setting('t.b3')::uuid, current_setting('t.b4')::uuid)),
  'two deleted owners are not each other''s duplicates');
select is((select others from admin_salon_duplicates() where business_id = current_setting('t.b1')::uuid and reason = 'name'),
  jsonb_build_array(jsonb_build_object('name', 'Twin Cuts', 'code', current_setting('t.code2'))),
  'the other salon with its code');

-- A3.
create temp table o on commit drop as select admin_overview() as v;
select is((select sum((c ->> 'salons')::int) from o, jsonb_array_elements(v -> 'countries') c)::int, (select (v ->> 'salons')::int from o),
  'the countries add up to the salons (test and closed salons left out of both)');
select is((select (v ->> 'accounts')::int from o),
  (select (v ->> 'accounts_active')::int + (v ->> 'accounts_off')::int + (v ->> 'accounts_deleted')::int from o),
  'accounts = active + switched off + deleted');
select ok((select (v ->> 'accounts_deleted')::int >= 2 and (v ->> 'accounts_off')::int >= 1 and (v ->> 'accounts_test')::int >= 1 from o),
  'the deleted, switched-off and test salon accounts are counted where they belong');
select ok((select (v ->> 'new_salons_7d')::int >= 5 from o), 'new salons this week: closed ones included, the test salon not');
select is((select (v ->> 'branches')::int from o), current_setting('t.branches')::int, 'branches: open salons only');

-- A4. A payment recorded on Twin Cuts, and one on the test salon.
select set_config('t.before', coalesce((select (p ->> 'total_minor') from o, jsonb_array_elements(v -> 'plan_income') p where p ->> 'currency' = 'AED'), '0'), false);
select admin_activate(current_setting('t.b1')::uuid, 12, 9900, 'Bank transfer');
select admin_activate(current_setting('t.b6')::uuid, 1, 5000, 'Ours');
create function pg_temp.income(p_key text) returns bigint language sql as $$
  select coalesce((select (p ->> 'total_minor')::bigint from jsonb_array_elements(admin_overview() -> p_key) p where p ->> 'currency' = 'AED'), 0)
$$;
select is(pg_temp.income('plan_income'), current_setting('t.before')::bigint + 9900, 'counted all time; the test salon''s is not');
select ok(pg_temp.income('plan_income_month') >= 9900, 'and this month');
select pg_temp.as_admin();
select set_config('t.pay', (select id::text from plan_events where business_id = current_setting('t.b1')::uuid and kind = 'activate'), false);
select pg_temp.as_user('a0');
select throws_ok($$ select admin_mark_payment(current_setting('t.pay')::uuid, 'test', ' ') $$, '22023', 'reason_required', 'a reason is needed');
select admin_mark_payment(current_setting('t.pay')::uuid, 'test', 'Paid by us to try it');
select is(pg_temp.income('plan_income'), current_setting('t.before')::bigint, 'marked Test: out of the total');
select pg_temp.as_admin();
select is((select array[amount_minor::text, months::text] from plan_events where id = current_setting('t.pay')::uuid), array['9900', '12'],
  'the payment itself is unchanged');
select is((select array[after ->> 'mark', after ->> 'reason', actor::text] from platform_audit where action = 'payment:mark' and business_id = current_setting('t.b1')::uuid),
  array['test', 'Paid by us to try it', pg_temp.u('a0')::text], 'Changes records who, the mark and the reason');
select pg_temp.as_user('a0');
select is((select array[mark, counted::text] from admin_payments() where id = current_setting('t.pay')::uuid), array['test', 'false'],
  'the list says it is marked and not counted');
select admin_mark_payment(current_setting('t.pay')::uuid, null, 'It was real after all');
select is(pg_temp.income('plan_income'), current_setting('t.before')::bigint + 9900, 'counted again');

-- A card payment in Creem's test mode is marked Test as it is recorded.
select pg_temp.as_admin();
insert into plan_events (business_id, kind, months, amount_minor, currency, paid_until, note)
values (current_setting('t.b5')::uuid, 'activate', 1, 1699, 'USD', current_date + 30, 'Card payment (Creem, test) ord_87');
select is((select mark from payment_marks pm join plan_events e on e.id = pm.event_id where e.note = 'Card payment (Creem, test) ord_87'),
  'test', 'a Creem test-mode payment is marked Test');

-- Only platform owners.
select pg_temp.as_user('b1');
select throws_ok($$ select admin_mark_payment(current_setting('t.pay')::uuid, 'void', 'Not mine to say') $$, '42501', 'not_allowed',
  'a salon owner cannot mark payments');

select * from finish();
rollback;
