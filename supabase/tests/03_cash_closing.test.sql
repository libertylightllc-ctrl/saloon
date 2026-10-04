-- Cash closing and tip payouts: expected cash, short by AED 5 → cashier submits → owner approves → locked,
-- over/short and cash taken out posted, next day's opening; tips owed and paid from the drawer.
begin;
create extension if not exists pgtap with schema extensions;
-- Paid plans are tested in 14_plans; here every salon may work.
select set_config('salon.plan_check', 'off', false);
select plan(53);
-- The checks below work out dates and codes with internal helpers that the app's sign-in roles cannot call (migration
-- 33); they are allowed here, inside this test's transaction only (rolled back at the end).
grant execute on function public.branch_today(uuid), public.branch_tz(uuid), public.business_today(uuid),
  public.compliance_readiness(uuid), public.plan_active(uuid), public.unique_business_code(text),
  public.post_journal(uuid, uuid, date, text, uuid, text, uuid, jsonb), public.branch_setting(uuid, text, jsonb)
  to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000020a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'cc-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000020c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'cc-cashier@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000020d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'cc-staff@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

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
create function pg_temp.balanced() returns boolean language sql as $$
  select coalesce(bool_and(d = c), true) from (
    select sum(debit_minor) d, sum(credit_minor) c from journal_lines group by entry_id) x
$$;
create function pg_temp.account_balance(p_key text) returns bigint language sql as $$
  select coalesce(sum(l.debit_minor - l.credit_minor), 0)::bigint from journal_lines l
  join accounts a on a.id = l.account_id where a.business_id = current_setting('t.b')::uuid and a.system_key = p_key
$$;
create function pg_temp.sale(p_cash bigint, p_card bigint, p_tip bigint) returns jsonb language sql as $$
  select create_sale(jsonb_build_object('branch_id', current_setting('t.br'),
    'employee_id', current_setting('t.emp'),
    'lines', jsonb_build_array(jsonb_build_object('kind', 'custom', 'name', 'Haircut',
                                                  'unit_price_minor', p_cash + p_card - p_tip)),
    'tip_minor', p_tip,
    'payments', (select coalesce(jsonb_agg(x), '[]') from (
        select jsonb_build_object('method', 'cash', 'amount_minor', p_cash) x where p_cash > 0
        union all select jsonb_build_object('method', 'card', 'amount_minor', p_card) where p_card > 0) y)))
$$;
create function pg_temp.preview() returns jsonb language sql as $$
  select closing_preview(current_setting('t.br')::uuid)
$$;

-- ── Setup: owner with AED 200.00 opening cash (posted yesterday), a cashier and a barber ──────
select pg_temp.as_user('00000000-0000-0000-0000-00000000020a');
select set_config('t.b', (create_business('{"business_name":"Closing Salon","owner_name":"Owner","mode":"gents",
  "vat_mode":"off","opening_cash_minor":20000}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select set_config('t.owner', (select id::text from members where user_id = '00000000-0000-0000-0000-00000000020a'), false);
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-00000000020c', 'username', 'cccash', 'display_name', 'Noor', 'role', 'cashier'));
select set_config('t.emp', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'user_id', '00000000-0000-0000-0000-00000000020d', 'username', 'ccstaff',
  'display_name', 'Rafiq', 'role', 'staff')) ->> 'employee_id'), false);
select set_config('t.cashier', (select id::text from members where user_id = '00000000-0000-0000-0000-00000000020c'), false);
select pg_temp.as_admin();
-- The opening cash belongs to yesterday, so today starts with it as the opening balance.
update journal_entries set business_date = business_date - 1 where source_type = 'opening_cash'
  and business_id = current_setting('t.b')::uuid;

-- ── Today's cash: sales, a card sale with a tip, a cash expense ────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000020c');
select lives_ok($$ select pg_temp.sale(5000, 0, 0) $$, 'cashier sells AED 50.00 cash');
select lives_ok($$ select pg_temp.sale(0, 3500, 500) $$, 'cashier sells AED 35.00 on card including a AED 5.00 tip');
select lives_ok($$ select pg_temp.sale(2500, 0, 1000) $$, 'cashier sells AED 25.00 cash including a AED 10.00 tip');
select lives_ok(format($$ select record_expense('{"branch_id":"%s","category_id":"%s","amount_minor":1500,"method":"cash"}') $$,
  current_setting('t.br'), (select id from expense_categories where business_id = current_setting('t.b')::uuid and key = 'tea_food')),
  'cashier pays AED 15.00 for tea from the drawer');

select is((pg_temp.preview() ->> 'opening_cash_minor')::bigint, 20000::bigint, 'opening cash is yesterday''s balance');
select is((pg_temp.preview() ->> 'expected_cash_minor')::bigint, 26000::bigint,
  'expected = 200 + 50 + 25 − 15 = 260.00 (card is not cash)');
select is((select (x ->> 'amount_minor')::bigint from jsonb_array_elements(pg_temp.preview() -> 'lines') x
           where x ->> 'kind' = 'sale'), 7500::bigint, 'the calculation lists cash sales');
select is((select (x ->> 'amount_minor')::bigint from jsonb_array_elements(pg_temp.preview() -> 'lines') x
           where x ->> 'kind' = 'expense'), -1500::bigint, 'the calculation lists cash expenses');

-- ── Tips ─────────────────────────────────────────────────────────────────────────────────
select is((select owed_minor from tips_owed(current_setting('t.br')::uuid) where employee_id = current_setting('t.emp')::uuid),
  1500::bigint, 'Rafiq is owed AED 15.00 in tips (card and cash)');
select throws_ok(format($$ select pay_tips('{"branch_id":"%s","employee_id":"%s","amount_minor":1600}') $$,
  current_setting('t.br'), current_setting('t.emp')), '22023', 'invalid_amount', 'cannot pay more tips than owed');
select is((pay_tips(jsonb_build_object('branch_id', current_setting('t.br'), 'employee_id', current_setting('t.emp'),
  'amount_minor', 1000, 'client_ref', 'tip-1')) ->> 'repeated')::boolean, false, 'cashier pays out AED 10.00 of tips');
select is((pay_tips(jsonb_build_object('branch_id', current_setting('t.br'), 'employee_id', current_setting('t.emp'),
  'amount_minor', 1000, 'client_ref', 'tip-1')) ->> 'repeated')::boolean, true, 'the same payout sent twice is paid once');
select is((select owed_minor from tips_owed(current_setting('t.br')::uuid) where employee_id = current_setting('t.emp')::uuid),
  500::bigint, 'AED 5.00 of tips still owed');
select is((pg_temp.preview() ->> 'expected_cash_minor')::bigint, 25000::bigint, 'tip payouts lower expected cash');
select is((select (x ->> 'amount_minor')::bigint from jsonb_array_elements(pg_temp.preview() -> 'lines') x
           where x ->> 'kind' = 'tip_payout'), -1000::bigint, 'the calculation lists tip payouts');

select pg_temp.as_user('00000000-0000-0000-0000-00000000020d');
select throws_ok(format($$ select pay_tips('{"branch_id":"%s","employee_id":"%s","amount_minor":100}') $$,
  current_setting('t.br'), current_setting('t.emp')), '42501', null, 'staff cannot pay tips');
select throws_ok(format($$ select closing_preview('%s') $$, current_setting('t.br')), '42501', null,
  'staff cannot see the cash closing');

-- ── Cashier counts: draft, then submit short by AED 5.00 ─────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000020c');
select lives_ok(format($$ select submit_cash_count('{"branch_id":"%s","counted_cash_minor":24500,
  "denominations":{"10000":2,"2000":2,"500":1}}') $$, current_setting('t.br')), 'cashier saves a draft count');
select is((pg_temp.preview() -> 'closing' ->> 'status'), 'draft', 'the draft is saved');
select pg_temp.as_user('00000000-0000-0000-0000-00000000020d');
select is((select count(*)::int from cash_closings), 0, 'staff cannot read closings');
select pg_temp.as_user('00000000-0000-0000-0000-00000000020c');
select lives_ok($$ select pg_temp.sale(1000, 0, 0) $$, 'a draft does not stop cash sales');

-- Yesterday (the opening cash) was never closed: Home asks for it, and days close in order.
select is((dashboard_today(current_setting('t.br')::uuid) -> 'closing' -> 'unclosed_days') ->> 0,
  (branch_today(current_setting('t.br')::uuid) - 1)::text, 'Home lists yesterday as not closed');
select lives_ok(format($$ select submit_cash_count('{"branch_id":"%s","business_date":"%s","counted_cash_minor":20000,
  "submit":true,"drawer_closed_confirmed":true}') $$, current_setting('t.br'), branch_today(current_setting('t.br')::uuid) - 1),
  'cashier closes yesterday: AED 200.00 counted, no difference');
select throws_ok(format($$ select submit_cash_count('{"branch_id":"%s","counted_cash_minor":26000,"submit":true,
  "drawer_closed_confirmed":true}') $$, current_setting('t.br')), '22023', 'previous_close_pending',
  'today cannot be submitted while yesterday waits for approval');
select pg_temp.as_user('00000000-0000-0000-0000-00000000020a');
select lives_ok(format($$ select approve_cash_closing('%s') $$, (select id from cash_closings
  where branch_id = current_setting('t.br')::uuid and business_date = branch_today(current_setting('t.br')::uuid) - 1)),
  'owner approves yesterday');
select is(jsonb_array_length(dashboard_today(current_setting('t.br')::uuid) -> 'closing' -> 'unclosed_days'), 0,
  'nothing left to close before today');
select throws_ok(format($$ select submit_cash_count('{"branch_id":"%s","business_date":"%s","counted_cash_minor":0,
  "submit":true,"drawer_closed_confirmed":true}') $$, current_setting('t.br'), branch_today(current_setting('t.br')::uuid) - 2),
  '22023', 'invalid_date', 'a day before a closed day can no longer be closed');
select throws_ok(format($$ select submit_cash_count('{"branch_id":"%s","business_date":"%s","counted_cash_minor":0}') $$,
  current_setting('t.br'), branch_today(current_setting('t.br')::uuid) + 1), '22023', 'invalid_date',
  'tomorrow cannot be closed');
select pg_temp.as_user('00000000-0000-0000-0000-00000000020c');
select throws_ok(format($$ select submit_cash_count('{"branch_id":"%s","counted_cash_minor":25500,"submit":true,
  "drawer_closed_confirmed":true}') $$, current_setting('t.br')), '22023', 'reason_required',
  'a count that does not match needs a reason');
select throws_ok(format($$ select submit_cash_count('{"branch_id":"%s","counted_cash_minor":25500,"submit":true,
  "reason":"Change given twice"}') $$, current_setting('t.br')), '22023', 'confirm_required',
  'the drawer-closed confirmation is required');
select throws_ok(format($$ select submit_cash_count('{"branch_id":"%s","submit":true,"drawer_closed_confirmed":true}') $$,
  current_setting('t.br')), '22023', 'count_required', 'a count is required to submit');
select throws_ok(format($$ select submit_cash_count('{"branch_id":"%s","counted_cash_minor":25500,"submit":true,
  "approve":true,"drawer_closed_confirmed":true,"reason":"Change given twice"}') $$, current_setting('t.br')),
  '42501', null, 'a cashier cannot approve');
select lives_ok(format($$ select submit_cash_count('{"branch_id":"%s","counted_cash_minor":25500,"submit":true,
  "drawer_closed_confirmed":true,"reason":"Change given twice","counted_by":"%s",
  "taken_out_minor":20000,"taken_out_to":"bank"}') $$, current_setting('t.br'), current_setting('t.cashier')),
  'cashier submits AED 255.00 counted (expected 260.00) and AED 200.00 to go to the bank');
select results_eq(format($$ select status, opening_cash_minor, expected_cash_minor, counted_cash_minor, variance_minor
  from cash_closings where branch_id = %L and business_date = branch_today(%L::uuid) $$, current_setting('t.br'), current_setting('t.br')),
  $$ values ('pending_approval'::text, 20000::bigint, 26000::bigint, 25500::bigint, -500::bigint) $$,
  'submitted: expected 260.00, counted 255.00, short by 5.00');

-- The day is locked for cash.
select throws_ok($$ select pg_temp.sale(1000, 0, 0) $$, '22023', 'day_closed', 'no cash sales after the count is submitted');
select lives_ok($$ select pg_temp.sale(0, 2000, 0) $$, 'card sales still go through');
select throws_ok(format($$ select pay_tips('{"branch_id":"%s","employee_id":"%s","amount_minor":500}') $$,
  current_setting('t.br'), current_setting('t.emp')), '22023', 'day_closed', 'no tip payouts after the count');
select throws_ok(format($$ select submit_cash_count('{"branch_id":"%s","counted_cash_minor":26000}') $$,
  current_setting('t.br')), '22023', 'day_closed', 'a submitted count cannot be edited');

-- ── Owner sends it back, cashier resubmits, owner approves ─────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000020a');
select throws_ok(format($$ select return_cash_closing('%s', 'x') $$,
  (select id from cash_closings where branch_id = current_setting('t.br')::uuid and business_date = branch_today(current_setting('t.br')::uuid))), '22023', 'reason_required',
  'sending back needs a reason');
select lives_ok(format($$ select return_cash_closing('%s', 'Count the coins again') $$,
  (select id from cash_closings where branch_id = current_setting('t.br')::uuid and business_date = branch_today(current_setting('t.br')::uuid))), 'owner sends the count back');
select is((pg_temp.preview() -> 'closing' ->> 'returned_reason'), 'Count the coins again', 'the reason is kept');
select pg_temp.as_user('00000000-0000-0000-0000-00000000020c');
select lives_ok(format($$ select submit_cash_count('{"branch_id":"%s","counted_cash_minor":25500,"submit":true,
  "drawer_closed_confirmed":true,"reason":"Change given twice","taken_out_minor":20000,"taken_out_to":"bank"}') $$,
  current_setting('t.br')), 'cashier submits again, still short by AED 5.00');
select throws_ok(format($$ select approve_cash_closing('%s') $$,
  (select id from cash_closings where branch_id = current_setting('t.br')::uuid and business_date = branch_today(current_setting('t.br')::uuid))), '42501', null, 'the cashier cannot approve');

select pg_temp.as_user('00000000-0000-0000-0000-00000000020a');
select is((dashboard_today(current_setting('t.br')::uuid) -> 'closing' ->> 'pending_approval')::int, 1,
  'Home shows one close waiting for approval');
select lives_ok(format($$ select approve_cash_closing('%s') $$,
  (select id from cash_closings where branch_id = current_setting('t.br')::uuid and business_date = branch_today(current_setting('t.br')::uuid))), 'owner approves');
select is(pg_temp.account_balance('cash_over_short'), 500::bigint, 'AED 5.00 short posted to Cash over/short');
select is(pg_temp.account_balance('cash'), 5500::bigint, 'the cash account now holds what was counted, less the banked 200.00');
select is(pg_temp.account_balance('bank'), 20000::bigint, 'AED 200.00 taken out to the bank');
select is(expected_cash(current_setting('t.br')::uuid, branch_today(current_setting('t.br')::uuid) + 1), 5500::bigint,
  'next day''s opening = counted − taken out');
select throws_ok(format($$ select approve_cash_closing('%s') $$,
  (select id from cash_closings where branch_id = current_setting('t.br')::uuid and business_date = branch_today(current_setting('t.br')::uuid))), '22023', 'invalid_status',
  'an approved close cannot be approved twice');
select is((select status from closing_history(current_setting('t.br')::uuid) where business_date = branch_today(current_setting('t.br')::uuid)),
  'approved', 'history shows the day as approved');
select ok(pg_temp.balanced(), 'every journal entry balances');

select pg_temp.as_admin();
select is((select count(*)::int from audit_log where business_id = current_setting('t.b')::uuid
           and entity_type = 'cash_closing'), 6, 'every submit, send back and approval is in the audit log');

select * from finish();
rollback;
