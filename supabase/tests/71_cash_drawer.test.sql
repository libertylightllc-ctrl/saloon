-- Part B, step 3 (owner's app check, 10 Nov 2026; brief B2 "Cash drawer", B3, B4): each of the five login types tried on
-- every cash row. Blind count, "Counted by" is the person signed in, the reason and alert limits, managers approving
-- closes (not their own count), petty cash with a receipt photo and a PIN above the limit, cash taken out, the bank
-- deposit, tips and cash added.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(54);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000071' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'cash-roles-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(),
       '{}', '{}'
from unnest(array['a0', 'b1', 'b2', 'b3', 'b4']) n;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000071' || p)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- An owner with AED 200.00 opening cash.
select pg_temp.as_user('a0');
select set_config('t.b', (create_business('{"business_name":"Cash Roles Salon","owner_name":"Owner","mode":"gents",
  "vat_mode":"off","opening_cash_minor":20000}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select set_my_pin(current_setting('t.b')::uuid, '2580');

-- Manager Mona (b1), front desk Dina (b2), stylist Sami (b3) in the branch; the accountant Books (b4).
select pg_temp.as_admin();
select set_config('t.today', branch_today(current_setting('t.br')::uuid)::text, false);
create function pg_temp.member(p_user text, p_role text, p_name text) returns void language plpgsql as $$
declare v uuid;
begin
  insert into members (business_id, user_id, role, display_name, username)
  values (current_setting('t.b')::uuid, ('00000000-0000-0000-0000-0000000071' || p_user)::uuid, p_role::member_role,
          p_name, lower(p_name) || 'seventyone') returning id into v;
  if p_role <> 'accountant' then
    insert into member_branches (member_id, branch_id) values (v, current_setting('t.br')::uuid);
    insert into employees (business_id, branch_id, member_id, full_name, role_title)
    values (current_setting('t.b')::uuid, current_setting('t.br')::uuid, v, p_name,
            case p_role when 'cashier' then 'cashier' when 'manager' then 'manager' else 'staff' end);
  end if;
  perform set_config('t.' || p_user, v::text, false);
end $$;
select pg_temp.member('b1', 'manager', 'Mona'), pg_temp.member('b2', 'cashier', 'Dina'),
       pg_temp.member('b3', 'staff', 'Sami'), pg_temp.member('b4', 'accountant', 'Books');
select set_config('t.a0', (select id::text from members where business_id = current_setting('t.b')::uuid
                           and role = 'owner'), false);
select set_config('t.e3', (select id::text from employees where member_id = current_setting('t.b3')::uuid), false);
select pg_temp.as_user('b1'); select set_my_pin(current_setting('t.b')::uuid, '1357');

create function pg_temp.preview() returns jsonb language sql as $$
  select closing_preview(current_setting('t.br')::uuid)
$$;
create function pg_temp.upload() returns text language sql as $$
  insert into storage.objects (bucket_id, name, owner, metadata)
  values ('receipts', current_setting('t.b') || '/expenses/' || gen_random_uuid() || '.jpg', auth.uid(),
          '{"mimetype":"image/jpeg","size":1200}')
  returning name
$$;
create function pg_temp.expense(p_amount bigint, p_method text, p_extra jsonb default '{}') returns jsonb language sql as $$
  select record_expense(jsonb_build_object('branch_id', current_setting('t.br'), 'amount_minor', p_amount,
    'method', p_method, 'category_id', (select id from expense_categories
                                        where business_id = current_setting('t.b')::uuid and key = 'tea_food')) || p_extra)
$$;
create function pg_temp.count(p jsonb) returns jsonb language sql as $$
  select submit_cash_count(jsonb_build_object('branch_id', current_setting('t.br'), 'drawer_closed_confirmed', true) || p)
$$;
create function pg_temp.today_close() returns uuid language sql as $$
  select id from cash_closings where branch_id = current_setting('t.br')::uuid
    and business_date = current_setting('t.today')::date
$$;

-- 1. Cash in: a manager's sale with a 10.00 tip for Sami, tips paid, cash added.
select pg_temp.as_user('b1');
select lives_ok(format($$ select create_sale('{"branch_id":"%s","employee_id":"%s","tip_minor":1000,
  "lines":[{"kind":"custom","name":"Cut","unit_price_minor":10000}],
  "payments":[{"method":"cash","amount_minor":11000}]}') $$, current_setting('t.br'), current_setting('t.e3')),
  'a manager sells 100.00 cash with a 10.00 tip for Sami');
select is((select owed_minor from tips_owed(current_setting('t.br')::uuid) where employee_id = current_setting('t.e3')::uuid),
  1000::bigint, 'a manager sees the tips owed');
select pg_temp.as_user('b3');
select throws_ok(format($$ select pay_tips('{"branch_id":"%s","employee_id":"%s","amount_minor":1000}') $$,
  current_setting('t.br'), current_setting('t.e3')), '42501', 'not_allowed', 'a stylist does not pay tips');
select pg_temp.as_user('b1');
select lives_ok(format($$ select pay_tips('{"branch_id":"%s","employee_id":"%s","amount_minor":1000}') $$,
  current_setting('t.br'), current_setting('t.e3')), 'a manager pays the tips from the drawer');
select pg_temp.as_user('b4');
select throws_ok(format($$ select add_drawer_cash('{"branch_id":"%s","amount_minor":5000}') $$, current_setting('t.br')),
  '42501', 'not_allowed', 'the accountant does not touch the drawer');
select pg_temp.as_user('b2');
select is(add_drawer_cash(jsonb_build_object('branch_id', current_setting('t.br'), 'amount_minor', 5000))
  -> 'expected_cash_minor', 'null'::jsonb, 'the front desk adds 50.00 the owner put in, without seeing the drawer''s total');

-- 2. Blind count.
select is(array[(pg_temp.preview() ->> 'blind'), coalesce(pg_temp.preview() ->> 'expected_cash_minor', 'hidden'),
                coalesce(pg_temp.preview() ->> 'opening_cash_minor', 'hidden'),
                jsonb_array_length(pg_temp.preview() -> 'lines')::text],
  array['true', 'hidden', 'hidden', '0'],
  'blind count: the front desk sees no expected cash, opening cash or cash list before counting');
select is(expected_cash(current_setting('t.br')::uuid), null, 'nor through expected_cash');
select is(dashboard_today(current_setting('t.br')::uuid) -> 'expected_cash', 'null'::jsonb, 'nor on Home');
select pg_temp.as_user('b4');
select is(pg_temp.preview() ->> 'expected_cash_minor', null, 'the accountant sees it only after the close');
select pg_temp.as_user('b3');
select throws_ok($$ select pg_temp.preview() $$, '42501', 'not_allowed', 'a stylist does not open the closing');
select pg_temp.as_user('b1');
select is((pg_temp.preview() ->> 'expected_cash_minor')::bigint, 35000::bigint,
  'a manager sees it: 200 opening + 110 sale − 10 tips + 50 added = 350.00');
select is((dashboard_today(current_setting('t.br')::uuid) ->> 'expected_cash')::bigint, 35000::bigint,
  'on Home too');
select is((select count(*)::int from jsonb_array_elements(dashboard_today(current_setting('t.br')::uuid) -> 'staff_today') x
           where x ->> 'commission_minor' is not null), 0, 'a manager''s Home shows no commission');
select is(array[dashboard_today(current_setting('t.br')::uuid) ->> 'bills', dashboard_today(current_setting('t.br')::uuid) ->> 'payroll'],
  array[null, null]::text[], 'nor bills or payroll');
select pg_temp.as_user('a0');
select lives_ok(format($$ select save_controls('%s', '{"blind_count": false}') $$, current_setting('t.br')),
  'the owner turns blind count off');
select pg_temp.as_user('b2');
select is((pg_temp.preview() ->> 'expected_cash_minor')::bigint, 35000::bigint, 'then the front desk sees the expected cash');
select pg_temp.as_user('a0');
select save_controls(current_setting('t.br')::uuid, '{"blind_count": true}');

-- 3. Petty cash from the drawer.
select pg_temp.as_user('b2');
select throws_ok($$ select pg_temp.expense(1500, 'cash') $$, '22023', 'receipt_required',
  'the front desk gives a receipt photo for petty cash');
select throws_ok($$ select pg_temp.expense(1500, 'cash', jsonb_build_object('receipt_path',
  current_setting('t.b') || '/expenses/never-uploaded.jpg')) $$, '22023', 'receipt_missing', 'a photo that was uploaded');
select lives_ok($$ select pg_temp.expense(1500, 'cash', jsonb_build_object('receipt_path', pg_temp.upload())) $$,
  'with it, 15.00 for tea goes through');
select is((select count(*)::int from expenses where receipt_path is not null), 1, 'and the photo is on the expense');
select throws_ok($$ select pg_temp.expense(25000, 'cash', jsonb_build_object('receipt_path', pg_temp.upload())) $$,
  '42501', 'approval_needed', '250.00 is above the 200.00 petty-cash limit: a PIN is needed');
select set_config('t.ap', approve_with_pin(current_setting('t.br')::uuid, current_setting('t.b1')::uuid, '1357',
  'petty_cash', 25000) ->> 'approval_id', false);
select lives_ok($$ select pg_temp.expense(25000, 'cash', jsonb_build_object('receipt_path', pg_temp.upload(),
  'approval_id', current_setting('t.ap'))) $$, 'with Mona''s PIN it goes through');
select throws_ok($$ select pg_temp.expense(99999, 'cash', jsonb_build_object('receipt_path', pg_temp.upload())) $$,
  '22023', 'not_enough_cash', 'more than the drawer holds is refused without saying how much it holds');
select throws_ok($$ select pg_temp.expense(700, 'card', jsonb_build_object('receipt_path', pg_temp.upload())) $$,
  '42501', 'not_allowed', 'the front desk pays only cash from the drawer');
select pg_temp.as_admin();
select is((select limit_amount || ' ' || approved_name || ' ' || ref_type from approvals
           where id = current_setting('t.ap')::uuid), '20000 Mona expense',
  'the approval is linked to the expense, with the limit it went over');
select pg_temp.as_user('b4');
select throws_ok($$ select pg_temp.expense(1000, 'cash') $$, '42501', 'not_allowed',
  'the accountant does not pay from the drawer');
select lives_ok($$ select pg_temp.expense(2000, 'card') $$, 'but records an expense paid by card');
select pg_temp.as_user('b3');
select throws_ok($$ select pg_temp.expense(2000, 'card') $$, '42501', 'not_allowed', 'a stylist records no expenses');
select pg_temp.as_user('b1');
select lives_ok($$ select pg_temp.expense(1000, 'cash') $$, 'a manager pays petty cash, any amount, photo optional');
select is((pg_temp.preview() ->> 'expected_cash_minor')::bigint, 7500::bigint,
  'the drawer: 350 − 15 − 250 − 10 = 75.00 (the card expense is not cash)');

-- 4. The count: by the person signed in; reason limit; cash out.
select pg_temp.as_user('b2');
select lives_ok(format($$ select pg_temp.count('{"counted_cash_minor":7000,"counted_by":"%s"}') $$,
  current_setting('t.a0')), 'the front desk saves a draft, naming the owner as the counter');
select is((select counted_by::text from cash_closings where id = pg_temp.today_close()), current_setting('t.b2'),
  'it is saved as counted by the front desk, the person signed in');
select throws_ok($$ select pg_temp.count('{"counted_cash_minor":7500,"submit":true,"taken_out_minor":1000,
  "taken_out_to":"bank"}') $$, '42501', 'not_allowed', 'the front desk does not take cash out');
select throws_ok($$ select pg_temp.count('{"counted_cash_minor":6900,"submit":true}') $$, '22023', 'reason_required',
  '6.00 short is at or above the 5.00 limit: a reason is needed');
select lives_ok($$ select pg_temp.count('{"counted_cash_minor":7200,"submit":true}') $$,
  '3.00 short is under the limit: no reason needed');
select is(array[pg_temp.preview() ->> 'blind', pg_temp.preview() ->> 'expected_cash_minor',
                pg_temp.preview() -> 'closing' ->> 'variance_minor'], array['false', '7500', '-300'],
  'once the count is in, the front desk sees the expected cash and the difference');
select pg_temp.as_user('b4');
select is((pg_temp.preview() ->> 'expected_cash_minor')::bigint, 7500::bigint, 'so does the accountant');
select pg_temp.as_admin();
select is((select string_agg(m.display_name, ', ' order by m.display_name) from notifications n
           join members m on m.id = n.member_id where n.type = 'close_submitted' and n.entity_id = pg_temp.today_close()),
  'Mona, Owner', 'the owner and the branch''s manager hear that a close is waiting');
select is((select count(*)::int from notifications where type = 'cash_difference'), 0,
  'a 3.00 difference tells nobody (notify limit 20.00)');

-- 5. Approving.
select pg_temp.as_user('b2');
select throws_ok(format($$ select approve_cash_closing('%s') $$, pg_temp.today_close()), '42501', 'not_allowed',
  'the front desk does not approve');
select pg_temp.as_user('b4');
select throws_ok(format($$ select approve_cash_closing('%s') $$, pg_temp.today_close()), '42501', 'not_allowed',
  'nor the accountant');
select pg_temp.as_user('b1');
select lives_ok(format($$ select return_cash_closing('%s', 'Count again with me') $$, pg_temp.today_close()),
  'a manager sends the count back');
select lives_ok($$ select pg_temp.count('{"counted_cash_minor":5000,"submit":true,"reason":"Float miscounted",
  "taken_out_minor":1000,"taken_out_to":"bank"}') $$,
  'and counts it again: 25.00 short, 10.00 to the bank');
select pg_temp.as_admin();
select is((select string_agg(m.display_name || ': ' || n.title || ' · ' || n.body, ' | ' order by m.display_name)
           from notifications n join members m on m.id = n.member_id where n.type = 'cash_difference'),
  'Books: Cash short AED 25.00 on ' || to_char(current_setting('t.today')::date, 'FMDD Mon')
    || ' · Counted by Mona · Float miscounted | Owner: Cash short AED 25.00 on '
    || to_char(current_setting('t.today')::date, 'FMDD Mon') || ' · Counted by Mona · Float miscounted',
  '25.00 short tells the owner and the accountant, with who counted and why');
select pg_temp.as_user('b1');
select throws_ok(format($$ select approve_cash_closing('%s') $$, pg_temp.today_close()), '42501', 'own_count',
  'a manager does not approve a count they made');
select pg_temp.as_user('a0');
select lives_ok(format($$ select approve_cash_closing('%s') $$, pg_temp.today_close()), 'the owner does');

-- 6. The bank deposit.
select pg_temp.as_user('b2');
select throws_ok(format($$ select record_bank_deposit('%s', '%s') $$, pg_temp.today_close(),
  current_setting('t.today')), '42501', 'not_allowed', 'the front desk does not record bank deposits');
select pg_temp.as_user('b4');
select throws_ok(format($$ select record_bank_deposit('%s', '%s') $$, pg_temp.today_close(),
  current_setting('t.today')::date - 1), '22023', 'invalid_date', 'not before the close');
select lives_ok(format($$ select record_bank_deposit('%s', '%s', 'Slip 4471') $$, pg_temp.today_close(),
  current_setting('t.today')), 'the accountant records that the 10.00 reached the bank');
select throws_ok(format($$ select record_bank_deposit('%s', '%s') $$, pg_temp.today_close(),
  current_setting('t.today')), '22023', 'already_recorded', 'once');
select is((select banked_by::text || ' ' || bank_ref from cash_closings where id = pg_temp.today_close()),
  current_setting('t.b4') || ' Slip 4471', 'with who recorded it and the slip');

-- 7. Who reads closes.
select pg_temp.as_user('b1');
select is((select count(*)::int from cash_closings), 1, 'a manager reads the branch''s closes');
select pg_temp.as_user('b3');
select is((select count(*)::int from cash_closings) + (select count(*)::int from tip_payouts), 0,
  'a stylist reads no closes or tip payouts');

select * from finish();
rollback;
