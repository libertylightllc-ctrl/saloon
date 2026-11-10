-- Part B, step 1 (owner's app check, 9 Nov 2026; docs/PART-B-PLAN.md): the Manager login type, the one list of who
-- can do what, branches per login type, the owner's controls and manager approval with a PIN.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(49);
-- Internal checks the sign-in roles cannot call, allowed inside this rolled-back test only.
grant execute on function public.require_can(uuid, text), public.require_can_business(uuid, text) to authenticated;

-- 1. The list of who can do what is exactly the B2 table. src/lib/permissions.ts must hold the same list: a jest test
-- (src/lib/permissions.test.ts) reads the rows between the matrix markers below and compares them.
select ok('manager' = any (enum_range(null::member_role)::text[]), 'there is a Manager login type');
select set_eq(
  'select capability, role::text, level from role_capabilities',
  $$values
-- matrix:start
  ('viewQueue', 'owner', 'yes'), ('viewQueue', 'manager', 'yes'), ('viewQueue', 'cashier', 'yes'), ('viewQueue', 'staff', 'own'),
  ('addToQueue', 'owner', 'yes'), ('addToQueue', 'manager', 'yes'), ('addToQueue', 'cashier', 'yes'), ('addToQueue', 'staff', 'own'),
  ('book', 'owner', 'yes'), ('book', 'manager', 'yes'), ('book', 'cashier', 'yes'), ('book', 'staff', 'own'),
  ('noShowOrCancel', 'owner', 'yes'), ('noShowOrCancel', 'manager', 'yes'), ('noShowOrCancel', 'cashier', 'yes'),
  ('sell', 'owner', 'yes'), ('sell', 'manager', 'yes'), ('sell', 'cashier', 'yes'), ('sell', 'staff', 'own'),
  ('discount', 'owner', 'yes'), ('discount', 'manager', 'reason'), ('discount', 'cashier', 'limit'), ('discount', 'staff', 'limit'),
  ('changePrice', 'owner', 'yes'), ('changePrice', 'manager', 'reason'), ('changePrice', 'cashier', 'pin'),
  ('refund', 'owner', 'yes'), ('refund', 'manager', 'reason'), ('refund', 'cashier', 'pin'),
  ('refundDeposit', 'owner', 'yes'), ('refundDeposit', 'manager', 'yes'), ('refundDeposit', 'cashier', 'pin'),
  ('receipts', 'owner', 'yes'), ('receipts', 'manager', 'yes'), ('receipts', 'cashier', 'yes'), ('receipts', 'staff', 'own'),
  ('viewSales', 'owner', 'yes'), ('viewSales', 'manager', 'yes'), ('viewSales', 'cashier', 'yes'), ('viewSales', 'staff', 'own'), ('viewSales', 'accountant', 'yes'),
  ('viewMoney', 'owner', 'yes'), ('viewMoney', 'manager', 'yes'), ('viewMoney', 'cashier', 'yes'), ('viewMoney', 'accountant', 'yes'),
  ('countCash', 'owner', 'yes'), ('countCash', 'manager', 'yes'), ('countCash', 'cashier', 'yes'),
  ('viewClosing', 'owner', 'yes'), ('viewClosing', 'manager', 'yes'), ('viewClosing', 'cashier', 'yes'), ('viewClosing', 'accountant', 'yes'),
  ('approveClosing', 'owner', 'yes'), ('approveClosing', 'manager', 'yes'),
  ('pettyCash', 'owner', 'yes'), ('pettyCash', 'manager', 'yes'), ('pettyCash', 'cashier', 'limit'),
  ('cashOut', 'owner', 'yes'), ('cashOut', 'manager', 'yes'),
  ('bankDeposit', 'owner', 'yes'), ('bankDeposit', 'manager', 'yes'), ('bankDeposit', 'accountant', 'yes'),
  ('payTips', 'owner', 'yes'), ('payTips', 'manager', 'yes'), ('payTips', 'cashier', 'yes'),
  ('viewCustomers', 'owner', 'yes'), ('viewCustomers', 'manager', 'yes'), ('viewCustomers', 'cashier', 'yes'), ('viewCustomers', 'staff', 'own'),
  ('customerContacts', 'owner', 'yes'), ('customerContacts', 'manager', 'yes'), ('customerContacts', 'cashier', 'yes'), ('customerContacts', 'staff', 'own'),
  ('manageCustomers', 'owner', 'yes'), ('manageCustomers', 'manager', 'yes'), ('manageCustomers', 'cashier', 'yes'),
  ('serviceNotes', 'owner', 'yes'), ('serviceNotes', 'manager', 'yes'), ('serviceNotes', 'cashier', 'yes'), ('serviceNotes', 'staff', 'own'),
  ('mergeCustomers', 'owner', 'yes'), ('mergeCustomers', 'manager', 'yes'),
  ('exportCustomers', 'owner', 'yes'),
  ('deleteCustomers', 'owner', 'yes'),
  ('recordAttendance', 'owner', 'yes'), ('recordAttendance', 'manager', 'yes'), ('recordAttendance', 'cashier', 'pin'),
  ('fixAttendance', 'owner', 'yes'), ('fixAttendance', 'manager', 'reason'),
  ('viewAttendance', 'owner', 'yes'), ('viewAttendance', 'manager', 'yes'), ('viewAttendance', 'cashier', 'yes'), ('viewAttendance', 'staff', 'own'), ('viewAttendance', 'accountant', 'yes'),
  ('manageRoster', 'owner', 'yes'), ('manageRoster', 'manager', 'yes'),
  ('viewRoster', 'owner', 'yes'), ('viewRoster', 'manager', 'yes'), ('viewRoster', 'cashier', 'yes'), ('viewRoster', 'staff', 'own'), ('viewRoster', 'accountant', 'yes'),
  ('viewStaff', 'owner', 'yes'), ('viewStaff', 'manager', 'yes'), ('viewStaff', 'accountant', 'yes'),
  ('manageStaff', 'owner', 'yes'),
  ('manageUsers', 'owner', 'yes'),
  ('resetLogin', 'owner', 'yes'), ('resetLogin', 'manager', 'branch'),
  ('viewStaffSales', 'owner', 'yes'), ('viewStaffSales', 'manager', 'yes'), ('viewStaffSales', 'staff', 'own'), ('viewStaffSales', 'accountant', 'yes'),
  ('viewPayroll', 'owner', 'yes'), ('viewPayroll', 'accountant', 'yes'),
  ('recordPay', 'owner', 'yes'), ('recordPay', 'accountant', 'yes'),
  ('runPayroll', 'owner', 'yes'), ('runPayroll', 'accountant', 'yes'),
  ('approvePayroll', 'owner', 'yes'),
  ('payPayroll', 'owner', 'yes'), ('payPayroll', 'accountant', 'yes'),
  ('myPay', 'staff', 'own'),
  ('viewInventory', 'owner', 'yes'), ('viewInventory', 'manager', 'yes'), ('viewInventory', 'cashier', 'yes'), ('viewInventory', 'staff', 'yes'), ('viewInventory', 'accountant', 'yes'),
  ('countStock', 'owner', 'yes'), ('countStock', 'manager', 'yes'),
  ('manageInventory', 'owner', 'yes'),
  ('orderStock', 'owner', 'yes'), ('orderStock', 'manager', 'yes'),
  ('receiveDelivery', 'owner', 'yes'), ('receiveDelivery', 'manager', 'yes'), ('receiveDelivery', 'cashier', 'yes'),
  ('priceDelivery', 'owner', 'yes'), ('priceDelivery', 'manager', 'yes'), ('priceDelivery', 'accountant', 'yes'),
  ('addPurchase', 'owner', 'yes'), ('addPurchase', 'manager', 'yes'), ('addPurchase', 'accountant', 'yes'),
  ('viewPurchases', 'owner', 'yes'), ('viewPurchases', 'manager', 'yes'), ('viewPurchases', 'accountant', 'yes'),
  ('payBill', 'owner', 'yes'), ('payBill', 'accountant', 'yes'),
  ('addExpense', 'owner', 'yes'), ('addExpense', 'manager', 'yes'), ('addExpense', 'accountant', 'yes'),
  ('viewExpenses', 'owner', 'yes'), ('viewExpenses', 'manager', 'yes'), ('viewExpenses', 'cashier', 'own'), ('viewExpenses', 'accountant', 'yes'),
  ('payOrReverseMoneyOut', 'owner', 'yes'),
  ('viewReports', 'owner', 'yes'), ('viewReports', 'manager', 'branch'), ('viewReports', 'staff', 'own'), ('viewReports', 'accountant', 'yes'),
  ('viewAccounting', 'owner', 'yes'), ('viewAccounting', 'accountant', 'yes'),
  ('closePeriod', 'owner', 'yes'), ('closePeriod', 'accountant', 'yes'),
  ('reopenPeriod', 'owner', 'yes'),
  ('exportLedger', 'owner', 'yes'), ('exportLedger', 'accountant', 'yes'),
  ('viewActivity', 'owner', 'yes'), ('viewActivity', 'manager', 'branch'), ('viewActivity', 'accountant', 'yes'),
  ('viewApprovals', 'owner', 'yes'), ('viewApprovals', 'manager', 'branch'),
  ('viewServices', 'owner', 'yes'), ('viewServices', 'manager', 'yes'), ('viewServices', 'cashier', 'yes'), ('viewServices', 'staff', 'yes'), ('viewServices', 'accountant', 'yes'),
  ('manageServices', 'owner', 'yes'),
  ('manageBranch', 'owner', 'yes'),
  ('manageControls', 'owner', 'yes'),
  ('viewCompliance', 'owner', 'yes'), ('viewCompliance', 'manager', 'yes'), ('viewCompliance', 'accountant', 'yes'),
  ('manageCompliance', 'owner', 'yes'), ('manageCompliance', 'manager', 'yes'),
  ('signHygiene', 'owner', 'yes'), ('signHygiene', 'manager', 'yes'), ('signHygiene', 'cashier', 'yes'), ('signHygiene', 'staff', 'yes'),
  ('backup', 'owner', 'yes'),
  ('viewPlan', 'owner', 'yes'), ('viewPlan', 'accountant', 'yes'),
  ('requestPlan', 'owner', 'yes'),
  ('support', 'owner', 'yes'), ('support', 'manager', 'yes'), ('support', 'cashier', 'yes'), ('support', 'staff', 'yes'), ('support', 'accountant', 'yes')
-- matrix:end
  $$,
  'who can do what matches the B2 table');
select is_empty(
  $$select m[1] from pg_proc p, regexp_matches(p.prosrc, 'require_can(?:_business)?\([^,]+, ''([A-Za-z]+)''\)', 'g') m
    where p.pronamespace = 'public'::regnamespace
    except select capability from role_capabilities$$,
  'every capability the database checks is in the list');

-- People: the owner (a0), Manager One (b1) and the front desk (b2) and a stylist (b3) in the first branch, an
-- accountant (b4) given only the first branch, Manager Two (b5) in the second branch only.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000069' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'roles-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1', 'b2', 'b3', 'b4', 'b5']) n;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000069' || p)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

select pg_temp.as_user('a0');
select set_config('t.b', (create_business('{"business_name":"Roles Salon","owner_name":"Owner","mode":"gents"}')
  ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select set_config('t.br2', create_branch(jsonb_build_object('business_id', current_setting('t.b'), 'name', 'Marina'))::text,
  false);
select set_my_pin(current_setting('t.b')::uuid, '2580');

select pg_temp.as_admin();
create function pg_temp.member(p_user text, p_role text, p_name text, p_branch text) returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into members (business_id, user_id, role, display_name, username)
  values (current_setting('t.b')::uuid, ('00000000-0000-0000-0000-0000000069' || p_user)::uuid, p_role::member_role,
          p_name, lower(replace(p_name, ' ', ''))) returning id into v;
  insert into member_branches (member_id, branch_id) values (v, current_setting(p_branch)::uuid);
  perform set_config('t.' || p_user, v::text, false);
  return v;
end $$;
select pg_temp.member('b1', 'manager', 'Manager One', 't.br'), pg_temp.member('b2', 'cashier', 'Desk', 't.br'),
       pg_temp.member('b3', 'staff', 'Stylist', 't.br'), pg_temp.member('b4', 'accountant', 'Books', 't.br'),
       pg_temp.member('b5', 'manager', 'Manager Two', 't.br2');
select set_config('t.a0', (select id::text from members where business_id = current_setting('t.b')::uuid
                           and role = 'owner'), false);
select pg_temp.as_user('b1'); select set_my_pin(current_setting('t.b')::uuid, '1357');
select pg_temp.as_user('b5'); select set_my_pin(current_setting('t.b')::uuid, '8642');
select pg_temp.as_user('b2'); select set_my_pin(current_setting('t.b')::uuid, '9630');

-- 2. Branches: the accountant sees every branch; the others only the ones they were given.
select pg_temp.as_user('b4');
select ok(can_use_branch(current_setting('t.br2')::uuid), 'the accountant works in every branch');
select is((select count(*)::int from my_branch_ids()), 2, 'and reads both branches');
select pg_temp.as_user('b2');
select ok(not can_use_branch(current_setting('t.br2')::uuid), 'the front desk only in their own branch');
select pg_temp.as_user('b1');
select ok(not can_use_branch(current_setting('t.br2')::uuid), 'a manager only in their own branch');

-- 3. require_can follows the list and the branch.
select pg_temp.as_user('b2');
select lives_ok($$ select require_can(current_setting('t.br')::uuid, 'countCash') $$, 'the front desk counts the drawer');
select throws_ok($$ select require_can(current_setting('t.br')::uuid, 'approveClosing') $$, '42501', 'not_allowed',
  'but does not approve a close');
select pg_temp.as_user('b1');
select lives_ok($$ select require_can(current_setting('t.br')::uuid, 'approveClosing') $$, 'a manager approves closes');
select throws_ok($$ select require_can(current_setting('t.br2')::uuid, 'approveClosing') $$, '42501', 'not_allowed',
  'only in their own branch');
select throws_ok($$ select require_can_business(current_setting('t.b')::uuid, 'approvePayroll') $$, '42501',
  'not_allowed', 'and never payroll');
select pg_temp.as_user('b4');
select throws_ok($$ select require_can(current_setting('t.br')::uuid, 'sell') $$, '42501', 'not_allowed',
  'the accountant does not sell');
select lives_ok($$ select require_can_business(current_setting('t.b')::uuid, 'closePeriod') $$,
  'the accountant closes a month');
select pg_temp.as_user('a0');
select throws_ok($$ select require_can(current_setting('t.br')::uuid, 'noSuchThing') $$, '42501', 'not_allowed',
  'a capability not in the list is refused, even for the owner');

-- 4. Controls: the brief's defaults; only the owner changes them; each change is in the audit trail.
select pg_temp.as_user('b2');
select is(branch_controls(current_setting('t.br')::uuid) - 'staff_can_sell',
  '{"discount_limit_bps": 1000, "petty_cash_limit_minor": 20000, "cash_reason_minor": 500, "cash_notify_minor": 2000,
    "blind_count": true, "staff_see_phones": false, "staff_book_self": true}'::jsonb,
  'the front desk reads the defaults (AED 200 petty cash, 5 and 20 cash differences, 10% discount)');
select throws_ok($$ select save_controls(current_setting('t.br')::uuid, '{"discount_limit_bps": 5000}') $$, '42501',
  'not_allowed', 'the front desk cannot change them');
select pg_temp.as_user('b1');
select throws_ok($$ select save_controls(current_setting('t.br')::uuid, '{"discount_limit_bps": 5000}') $$, '42501',
  'not_allowed', 'nor can a manager');
select pg_temp.as_user('a0');
select is((save_controls(current_setting('t.br')::uuid,
  '{"discount_limit_bps": 1500, "blind_count": false, "staff_see_phones": false}') ->> 'changed')::int, 2,
  'the owner changes two (the third was already so)');
select is((select array_agg(summary order by summary) from audit_log where entity_type = 'control'
           and branch_id = current_setting('t.br')::uuid),
  array['Controls: blind_count true → false', 'Controls: discount_limit_bps 1000 → 1500'],
  'one audit line per change, with the old and new value');
select is(branch_controls(current_setting('t.br')::uuid) -> 'discount_limit_bps', '1500'::jsonb, 'the new limit holds');
select throws_ok($$ select save_controls(current_setting('t.br')::uuid, '{"surprise": 1}') $$, '22023', null,
  'an unknown control is refused');
select throws_ok($$ select save_controls(current_setting('t.br')::uuid, '{"discount_limit_bps": 12000}') $$, '22023',
  null, 'a discount limit above 100% is refused');
select throws_ok($$ select save_controls(current_setting('t.br')::uuid, '{"petty_cash_limit_minor": -1}') $$, '22023',
  null, 'a negative limit is refused');
select throws_ok($$ select save_controls(current_setting('t.br')::uuid, '{"cash_reason_minor": 12.5}') $$, '22023',
  null, 'money is whole minor units');
select throws_ok($$ select save_controls(current_setting('t.br')::uuid, '{"blind_count": 1}') $$, '22023', null,
  'an on/off control takes true or false');

-- 5. Who can approve: the owner and the branch's managers with a PIN, never yourself.
select pg_temp.as_user('b2');
select is((select array_agg(name order by name) from approvers(current_setting('t.br')::uuid)),
  array['Manager One', 'Owner'], 'the front desk sees the owner and their branch''s manager');
select pg_temp.as_user('b1');
select is((select array_agg(name) from approvers(current_setting('t.br')::uuid)), array['Owner'],
  'a manager sees only the owner');

-- 6. Approving with a PIN.
select pg_temp.as_user('b2');
select is(approve_with_pin(current_setting('t.br')::uuid, current_setting('t.b1')::uuid, '0000', 'discount', 2500),
  '{"ok": false, "error": "wrong_pin", "tries_left": 4}'::jsonb, 'a wrong PIN says how many tries are left');
select throws_ok($$ select approve_with_pin(current_setting('t.br')::uuid, current_setting('t.b5')::uuid, '8642',
  'discount', 2500) $$, '42501', 'not_an_approver', 'another branch''s manager cannot approve here');
select throws_ok($$ select approve_with_pin(current_setting('t.br')::uuid, current_setting('t.b2')::uuid, '9630',
  'discount', 2500) $$, '42501', 'not_an_approver', 'nobody approves their own request');
select set_config('t.ap', approve_with_pin(current_setting('t.br')::uuid, current_setting('t.b1')::uuid, '1357',
  'discount', 2500, null, '{"sale": "test"}') ->> 'approval_id', false);
select pg_temp.as_admin();
select is((select approved_name || ' for ' || requested_name from approvals where id = current_setting('t.ap')::uuid),
  'Manager One for Desk', 'the right PIN gives an approval with both names');

create function pg_temp.use(p_member text, p_action text, p_amount bigint) returns void language sql as $$
  select null::void from use_approval(current_setting('t.ap')::uuid, current_setting('t.' || p_member)::uuid,
    current_setting('t.br')::uuid, p_action, p_amount, 1000, 'sale', null)
$$;
select throws_ok($$ select pg_temp.use('b2', 'discount', 2600) $$, '42501', 'approval_needed',
  'a 25% approval does not cover 26%');
select throws_ok($$ select pg_temp.use('b3', 'discount', 2000) $$, '42501', 'approval_needed',
  'nor someone else''s sale');
select throws_ok($$ select pg_temp.use('b2', 'refund', 2000) $$, '42501', 'approval_needed', 'nor another action');
select lives_ok($$ select pg_temp.use('b2', 'discount', 2000) $$, 'it covers 20%');
select is((select limit_amount from approvals where id = current_setting('t.ap')::uuid and used_at is not null), 1000::bigint,
  'and is used up, with the limit it went over');
select throws_ok($$ select pg_temp.use('b2', 'discount', 2000) $$, '42501', 'approval_needed', 'only once');
select pg_temp.as_user('b2');
select set_config('t.ap', approve_with_pin(current_setting('t.br')::uuid, current_setting('t.a0')::uuid, '2580',
  'petty_cash', 30000) ->> 'approval_id', false);
select pg_temp.as_admin();
update approvals set expires_at = now() - interval '1 second' where id = current_setting('t.ap')::uuid;
select throws_ok($$ select null::void from use_approval(current_setting('t.ap')::uuid, current_setting('t.b2')::uuid,
  current_setting('t.br')::uuid, 'petty_cash', 30000, 20000, 'expense', null) $$, '42501', 'approval_needed',
  'an approval lasts 5 minutes');

-- 7. Five wrong PINs lock it for 15 minutes, for approvals and quick-switch alike.
select pg_temp.as_user('b2');
select approve_with_pin(current_setting('t.br')::uuid, current_setting('t.b1')::uuid, '0000', 'refund', 100)
from generate_series(1, 4);
select is(approve_with_pin(current_setting('t.br')::uuid, current_setting('t.b1')::uuid, '0001', 'refund', 100) ->> 'error',
  'pin_locked', 'the fifth wrong PIN locks it');
select pg_temp.as_admin();
select ok((select locked_until between now() + interval '14 minutes' and now() + interval '16 minutes'
           from member_pins where member_id = current_setting('t.b1')::uuid), 'for 15 minutes');
select pg_temp.as_user('b2');
select is(approve_with_pin(current_setting('t.br')::uuid, current_setting('t.b1')::uuid, '1357', 'refund', 100) ->> 'error',
  'pin_locked', 'even the right PIN waits');
select throws_ok($$ select check_pin(current_setting('t.b1')::uuid, '1357') $$, '22023', 'pin_locked',
  'and quick-switch to them waits too');

-- 8. The Approvals list: the owner, and managers for their own branch.
select pg_temp.as_admin();
select log_approval(current_setting('t.a0')::uuid, current_setting('t.br')::uuid, 'refund', 4000, null,
  'Client unhappy', 'sale', null);
select pg_temp.as_user('a0');
select is((select count(*)::int from approvals where branch_id = current_setting('t.br')::uuid), 3,
  'the owner sees every approval, theirs with its reason');
select pg_temp.as_user('b1');
select is((select count(*)::int from approvals), 3, 'Manager One sees their branch''s');
select pg_temp.as_user('b5');
select is((select count(*)::int from approvals), 0, 'Manager Two, in another branch, sees none of them');
select pg_temp.as_user('b2');
select is((select count(*)::int from approvals), 0, 'the front desk sees none');
select pg_temp.as_user('b4');
select is((select count(*)::int from approvals), 0, 'nor does the accountant');
select ok(not has_function_privilege('authenticated', 'public.use_approval(uuid, uuid, uuid, text, bigint, bigint, text, uuid)',
                                     'execute')
          and not has_function_privilege('authenticated', 'public.log_approval(uuid, uuid, text, bigint, bigint, text, text, uuid, jsonb)', 'execute')
          and not has_function_privilege('authenticated', 'public.pin_attempt(uuid, text)', 'execute')
          and not has_function_privilege('authenticated', 'public.branch_control(uuid, text)', 'execute'),
  'the app cannot use up, write or test approvals and PINs directly');

select * from finish();
rollback;
