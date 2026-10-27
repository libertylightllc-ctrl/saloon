-- The drawer cannot go below zero (owner's fix list #9): a cash payment bigger than the drawer is refused with what the
-- drawer holds; cash put in from the owner or the bank is recorded and lets it through; card and bank payments and the
-- cash close are not checked; who may add cash.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(17);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000530a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'dc-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000530c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'dc-cashier@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000530d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'dc-staff@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

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
create function pg_temp.expense(p_amount bigint, p_method text) returns jsonb language sql as $$
  select record_expense(jsonb_build_object('branch_id', current_setting('t.br'), 'amount_minor', p_amount,
    'method', p_method, 'category_id', (select id from expense_categories
                                        where business_id = current_setting('t.b')::uuid and key = 'tea_food')))
$$;
create function pg_temp.drawer() returns bigint language sql as $$
  select expected_cash(current_setting('t.br')::uuid)
$$;

-- ── A salon with no opening cash, a cashier and a barber ───────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000530a');
select set_config('t.b', (create_business('{"business_name":"Drawer Salon","owner_name":"Owner","mode":"gents",
  "vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-00000000530c', 'username', 'dccash', 'display_name', 'Noor', 'role', 'cashier'));
select set_config('t.emp', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'user_id', '00000000-0000-0000-0000-00000000530d', 'username', 'dcstaff',
  'display_name', 'Rafiq', 'role', 'staff')) ->> 'employee_id'), false);

-- ── An empty drawer pays nothing in cash ──────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000530c');
select is(pg_temp.drawer(), 0::bigint, 'a new salon with no opening cash starts with an empty drawer');
select throws_ok($$ select pg_temp.expense(1000, 'cash') $$, '22023', 'not_enough_cash: 0',
  'a AED 10.00 cash expense from an empty drawer is refused, saying the drawer holds nothing');
select pg_temp.as_user('00000000-0000-0000-0000-00000000530a');
select lives_ok($$ select pg_temp.expense(1000, 'card') $$, 'the owner pays the same expense by card');
select is(pg_temp.drawer(), 0::bigint, 'and the drawer is untouched');
select pg_temp.as_user('00000000-0000-0000-0000-00000000530c');

-- ── A cash sale fills it; paying more than it holds is still refused ─────────────────────────────
select lives_ok(format($$ select create_sale('{"branch_id":"%s","employee_id":"%s",
  "lines":[{"kind":"custom","name":"Haircut","unit_price_minor":6000}],
  "payments":[{"method":"cash","amount_minor":6000}]}') $$, current_setting('t.br'), current_setting('t.emp')),
  'a AED 60.00 cash sale');
select throws_ok($$ select pg_temp.expense(50000, 'cash') $$, '22023', 'not_enough_cash: 6000',
  'AED 500.00 electricity in cash with AED 60.00 in the drawer is refused (Demo Shop''s 4 Oct)');
select lives_ok($$ select pg_temp.expense(6000, 'cash') $$, 'paying exactly what the drawer holds is fine');
select is(pg_temp.drawer(), 0::bigint, 'the drawer is empty, not below zero');

-- ── Cash put in ─────────────────────────────────────────────────────────────────────────────
select throws_ok(format($$ select add_drawer_cash('{"branch_id":"%s","amount_minor":0}') $$, current_setting('t.br')),
  '22023', 'invalid_amount', 'nothing to add is refused');
select throws_ok(format($$ select add_drawer_cash('{"branch_id":"%s","amount_minor":100,"from":"till"}') $$,
  current_setting('t.br')), '22023', 'invalid_amount', 'cash comes from the owner or the bank only');
select is((add_drawer_cash(jsonb_build_object('branch_id', current_setting('t.br'), 'amount_minor', 50000,
  'from', 'owner', 'note', 'For the DEWA bill')) ->> 'expected_cash_minor')::bigint, 50000::bigint,
  'the cashier records AED 500.00 the owner put in; the drawer holds it');
select lives_ok($$ select pg_temp.expense(50000, 'cash') $$, 'now the AED 500.00 cash bill goes through');

-- The books are the owner's to read.
select pg_temp.as_user('00000000-0000-0000-0000-00000000530a');
select is((select array_agg(a.system_key || ':' || (l.debit_minor - l.credit_minor) order by a.system_key)
           from journal_entries e join journal_lines l on l.entry_id = e.id join accounts a on a.id = l.account_id
           where e.business_id = current_setting('t.b')::uuid and e.source_type = 'cash_added'),
  array['cash:50000', 'owner_equity:-50000'], 'it is posted Dr Cash, Cr Owner equity');
select lives_ok(format($$ select add_drawer_cash('{"branch_id":"%s","amount_minor":20000,"from":"bank"}') $$,
  current_setting('t.br')), 'the owner adds AED 200.00 drawn from the bank');
select is((select sum(l.debit_minor - l.credit_minor)::bigint from journal_entries e
           join journal_lines l on l.entry_id = e.id join accounts a on a.id = l.account_id and a.system_key = 'bank'
           where e.business_id = current_setting('t.b')::uuid and e.source_type = 'cash_added'), -20000::bigint,
  'cash from the bank comes out of the bank');

select pg_temp.as_user('00000000-0000-0000-0000-00000000530d');
select throws_ok(format($$ select add_drawer_cash('{"branch_id":"%s","amount_minor":100}') $$, current_setting('t.br')),
  '42501', null, 'a barber cannot add cash to the drawer');

select pg_temp.as_user('00000000-0000-0000-0000-00000000530a');
select is((select count(*)::int from audit_log where business_id = current_setting('t.b')::uuid
           and entity_type = 'cash_added'), 2, 'both additions are in the audit log');

select * from finish();
rollback;
