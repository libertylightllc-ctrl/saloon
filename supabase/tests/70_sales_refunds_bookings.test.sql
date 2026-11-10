-- Part B, step 2 (owner's app check, 9 Nov 2026; brief B2 "Bookings and queue" and "Sales"): each of the five login
-- types tried on every row. Allowed actions go through, blocked ones are refused, PIN rows go through only with a
-- manager's or the owner's PIN, and reason rows only with a reason.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(42);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000070' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'sales-roles-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(),
       '{}', '{}'
from unnest(array['a0', 'b1', 'b2', 'b3', 'b4']) n;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000070' || p)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

select pg_temp.as_user('a0');
select set_config('t.b', (create_business('{"business_name":"Sales Roles Salon","owner_name":"Owner","mode":"gents",
  "vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select set_my_pin(current_setting('t.b')::uuid, '2580');
select set_config('t.svc', (select id::text from services where business_id = current_setting('t.b')::uuid
                            and status = 'active' order by price_minor desc limit 1), false);
select set_config('t.price', (select price_minor::text from services where id = current_setting('t.svc')::uuid), false);

-- Manager (b1), front desk (b2), stylist (b3) work in the branch, each on the staff list; the accountant (b4).
select pg_temp.as_admin();
create function pg_temp.member(p_user text, p_role text, p_name text) returns void language plpgsql as $$
declare v uuid;
begin
  insert into members (business_id, user_id, role, display_name, username)
  values (current_setting('t.b')::uuid, ('00000000-0000-0000-0000-0000000070' || p_user)::uuid, p_role::member_role,
          p_name, lower(p_name) || 'seventy') returning id into v;
  insert into member_branches (member_id, branch_id) values (v, current_setting('t.br')::uuid);
  perform set_config('t.' || p_user, v::text, false);
  if p_role <> 'accountant' then
    insert into employees (business_id, branch_id, member_id, full_name, role_title)
    values (current_setting('t.b')::uuid, current_setting('t.br')::uuid, v, p_name,
            case p_role when 'cashier' then 'cashier' when 'manager' then 'manager' else 'staff' end);
  end if;
end $$;
select pg_temp.member('b1', 'manager', 'Mona'), pg_temp.member('b2', 'cashier', 'Dina'),
       pg_temp.member('b3', 'staff', 'Sami'), pg_temp.member('b4', 'accountant', 'Books');
select set_config('t.a0', (select id::text from members where business_id = current_setting('t.b')::uuid
                           and role = 'owner'), false);
select set_config('t.e3', (select id::text from employees where member_id = current_setting('t.b3')::uuid), false);
select pg_temp.as_user('b1'); select set_my_pin(current_setting('t.b')::uuid, '1357');

-- A sale of one custom line at 100.00, paid in cash; p_extra adds a discount, approvals, reasons.
create function pg_temp.sale(p_discount bigint, p_extra jsonb default '{}') returns jsonb language sql as $$
  select create_sale(jsonb_build_object('branch_id', current_setting('t.br'),
    'lines', '[{"kind":"custom","name":"Cut","unit_price_minor":10000}]'::jsonb, 'discount_minor', p_discount,
    'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_minor', 10000 - p_discount))) || p_extra)
$$;
-- A sale of the dearest service at a changed price.
create function pg_temp.priced(p_price bigint, p_extra jsonb default '{}') returns jsonb language sql as $$
  select create_sale(jsonb_build_object('branch_id', current_setting('t.br'),
    'lines', jsonb_build_array(jsonb_build_object('kind', 'service', 'service_id', current_setting('t.svc'),
                                                  'price_minor', p_price)),
    'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_minor', p_price))) || p_extra)
$$;
create function pg_temp.pin(p_approver text, p_pin text, p_action text, p_amount bigint) returns text language sql as $$
  select approve_with_pin(current_setting('t.br')::uuid, current_setting('t.' || p_approver)::uuid, p_pin, p_action,
                          p_amount) ->> 'approval_id'
$$;

-- 1. Checkout.
select pg_temp.as_user('b4');
select throws_ok($$ select pg_temp.sale(0) $$, '42501', 'not_allowed', 'the accountant does not sell');
select pg_temp.as_user('b3');
select throws_ok($$ select pg_temp.sale(0) $$, '42501', 'not_allowed',
  'a stylist does not sell while "Stylists take payments" is off');
select pg_temp.as_user('b1');
select lives_ok($$ select pg_temp.sale(0) $$, 'a manager sells');
select pg_temp.as_user('b2');
select lives_ok($$ select pg_temp.sale(1000) $$, 'the front desk sells, with a discount up to the 10% limit');

-- 2. Discounts above the limit.
select throws_ok($$ select pg_temp.sale(2500) $$, '42501', 'approval_needed', 'the front desk needs a PIN for 25%');
select set_config('t.ap', pg_temp.pin('b1', '1357', 'discount', 2500), false);
select set_config('t.s1', (pg_temp.sale(2500, jsonb_build_object('approvals', jsonb_build_object('discount',
  current_setting('t.ap')))) ->> 'sale_id'), false);
select pg_temp.as_admin();
select is((select ref_id::text || ' ' || limit_amount || ' ' || approved_name from approvals
           where id = current_setting('t.ap')::uuid), current_setting('t.s1') || ' 1000 Mona',
  'with Mona''s PIN it goes through, linked to the sale with the limit it went over');
update branches set settings = settings || '{"staff_can_sell": true}' where id = current_setting('t.br')::uuid;
select pg_temp.as_user('b3');
select throws_ok($$ select pg_temp.sale(2000) $$, '42501', 'approval_needed',
  'a stylist allowed to sell needs a PIN above the limit too');
select lives_ok($$ select pg_temp.sale(800) $$, 'and not under it');
select pg_temp.as_user('b1');
select throws_ok($$ select pg_temp.sale(3000) $$, '22023', 'reason_required', 'a manager gives a reason above the limit');
select lives_ok($$ select pg_temp.sale(3000, '{"discount_reason": "Regular client"}') $$, 'and then it goes through');
select pg_temp.as_user('a0');
select lives_ok($$ select pg_temp.sale(5000) $$, 'the owner gives any discount');

-- 3. Changing a service's price at checkout.
select pg_temp.as_user('b3');
select throws_ok(format($$ select pg_temp.priced(%s) $$, current_setting('t.price')::bigint - 500), '42501', 'not_allowed',
  'a stylist cannot change a price');
select lives_ok(format($$ select pg_temp.priced(%s) $$, current_setting('t.price')), 'but sells at the list price');
select pg_temp.as_user('b2');
select throws_ok(format($$ select pg_temp.priced(%s) $$, current_setting('t.price')::bigint - 500), '42501',
  'approval_needed', 'the front desk needs a PIN to change a price');
select set_config('t.ap', pg_temp.pin('a0', '2580', 'price_change', 500), false);
select lives_ok(format($$ select pg_temp.priced(%s, jsonb_build_object('approvals', jsonb_build_object('price_change', '%s'))) $$,
  current_setting('t.price')::bigint - 500, current_setting('t.ap')), 'with the owner''s PIN it goes through');
select pg_temp.as_user('b1');
select throws_ok(format($$ select pg_temp.priced(%s) $$, current_setting('t.price')::bigint + 1000), '22023',
  'reason_required', 'a manager gives a reason for a changed price');
select lives_ok(format($$ select pg_temp.priced(%s, '{"price_reason": "Long hair"}') $$,
  current_setting('t.price')::bigint + 1000), 'and then it goes through');

-- 4. Refunds.
create function pg_temp.refund(p_sale text, p_extra jsonb default '{}') returns jsonb language sql as $$
  select refund_sale(jsonb_build_object('sale_id', p_sale, 'amount_minor', 1000, 'method', 'cash',
                                        'reason', 'Client unhappy') || p_extra)
$$;
select pg_temp.as_user('b4');
select throws_ok($$ select pg_temp.refund(current_setting('t.s1')) $$, '42501', 'not_allowed',
  'the accountant does not refund');
select pg_temp.as_user('b3');
select throws_ok($$ select pg_temp.refund(current_setting('t.s1')) $$, '42501', 'not_allowed', 'nor does a stylist');
select pg_temp.as_user('b2');
select throws_ok($$ select pg_temp.refund(current_setting('t.s1')) $$, '42501', 'approval_needed',
  'the front desk refunds only with a PIN');
select set_config('t.ap', pg_temp.pin('b1', '1357', 'refund', 1000), false);
select lives_ok(format($$ select pg_temp.refund(current_setting('t.s1'), '{"approval_id": "%s"}') $$,
  current_setting('t.ap')), 'and with Mona''s PIN the refund goes through');
select pg_temp.as_user('b1');
select lives_ok($$ select pg_temp.refund(current_setting('t.s1')) $$,
  'a manager refunds the front desk''s sale with a reason');
select set_config('t.s2', (pg_temp.sale(0) ->> 'sale_id'), false);
select throws_ok($$ select pg_temp.refund(current_setting('t.s2')) $$, '42501', 'approval_needed',
  'but not a sale of their own');
select set_config('t.ap', pg_temp.pin('a0', '2580', 'refund', 1000), false);
select lives_ok(format($$ select pg_temp.refund(current_setting('t.s2'), '{"approval_id": "%s"}') $$,
  current_setting('t.ap')), 'without a second person''s PIN');
select pg_temp.as_user('a0');
select lives_ok($$ select pg_temp.refund(current_setting('t.s2')) $$, 'the owner refunds any sale');

-- 5. Bookings and the queue.
create function pg_temp.book(p_extra jsonb default '{}') returns uuid language sql as $$
  select create_appointment(jsonb_build_object('branch_id', current_setting('t.br'), 'kind', 'booking',
    'scheduled_at', now() + interval '1 hour' + (random() * interval '30 days'),
    'service_ids', jsonb_build_array(current_setting('t.svc'))) || p_extra)
$$;
select pg_temp.as_user('b4');
select throws_ok($$ select create_appointment(jsonb_build_object('branch_id', current_setting('t.br'), 'kind', 'walk_in')) $$,
  '42501', 'not_allowed', 'the accountant does not add walk-ins');
select pg_temp.as_user('b1');
select lives_ok($$ select pg_temp.book() $$, 'a manager books');
select pg_temp.as_user('b3');
select set_config('t.own', pg_temp.book(jsonb_build_object('employee_id',
  (select id from employees where member_id = current_setting('t.b1')::uuid)))::text, false);
select is((select employee_id::text from appointments where id = current_setting('t.own')::uuid), current_setting('t.e3'),
  'a stylist books for themselves (not for someone else)');
select throws_ok($$ select pg_temp.book('{"deposit_minor": 2000, "deposit_method": "cash"}') $$, '42501', 'not_allowed',
  'without a deposit');
select pg_temp.as_user('b2');
select set_config('t.other', pg_temp.book(jsonb_build_object('employee_id',
  (select id from employees where member_id = current_setting('t.b1')::uuid)))::text, false);
select pg_temp.as_user('b3');
select throws_ok($$ select check_in(current_setting('t.other')::uuid) $$, '42501', 'not_allowed',
  'a stylist checks in only their own clients');
select lives_ok($$ select check_in(current_setting('t.own')::uuid) $$, 'like their own');
select throws_ok($$ select cancel_appointment(current_setting('t.own')::uuid, 'Changed mind') $$, '42501', 'not_allowed',
  'cancelling is for the front desk');

-- 6. Deposits the rules keep (a cancel 1 hour before, a no-show) given back.
create function pg_temp.late(p_minutes int) returns uuid language sql as $$
  select create_appointment(jsonb_build_object('branch_id', current_setting('t.br'), 'kind', 'booking',
    'scheduled_at', now() + make_interval(mins => p_minutes), 'service_ids', jsonb_build_array(current_setting('t.svc')),
    'deposit_minor', 2000, 'deposit_method', 'cash'))
$$;
select pg_temp.as_user('b2');
select set_config('t.d1', pg_temp.late(60)::text, false);
select is(cancel_appointment(current_setting('t.d1')::uuid, 'Cannot come'), 'forfeit',
  'a late cancel keeps the deposit, as before');
select set_config('t.d2', pg_temp.late(70)::text, false);
select throws_ok($$ select cancel_appointment(current_setting('t.d2')::uuid, 'Cannot come', true) $$, '42501',
  'approval_needed', 'the front desk gives it back only with a PIN');
select set_config('t.ap', pg_temp.pin('b1', '1357', 'deposit_refund', 2000), false);
select is(cancel_appointment(current_setting('t.d2')::uuid, 'Cannot come', true, current_setting('t.ap')::uuid), 'refund',
  'and with Mona''s PIN it is given back');
select set_config('t.d3', pg_temp.late(80)::text, false);
select pg_temp.as_user('b1');
select throws_ok($$ select mark_no_show(current_setting('t.d3')::uuid, true) $$, '22023', 'reason_required',
  'a manager gives a reason to give back a no-show''s deposit');
select lives_ok($$ select mark_no_show(current_setting('t.d3')::uuid, true, null, 'Hospital, sent a note') $$,
  'and then it is given back');
select pg_temp.as_admin();
select is((select array_agg(deposit_status::text order by scheduled_at) from appointments
           where id in (current_setting('t.d1')::uuid, current_setting('t.d2')::uuid, current_setting('t.d3')::uuid)),
  array['forfeited', 'refunded', 'refunded'], 'the deposits are kept or given back as chosen');

-- 7. Reports → Approvals.
select pg_temp.as_user('a0');
select is((select array_agg(action || ':' || method || ':' || n order by action, method)
           from (select action, method, count(*) n from approvals group by 1, 2) x),
  array['deposit_refund:pin:1', 'deposit_refund:reason:1', 'discount:pin:1', 'discount:reason:2',
        'price_change:pin:1', 'price_change:reason:1', 'refund:pin:2', 'refund:reason:2'],
  'every refund, changed price, big discount and deposit given back is listed, with PIN or reason');
select is((select reason from approvals where action = 'discount' and method = 'reason' and requested_name = 'Mona'),
  'Regular client', 'with the reason given');
select pg_temp.as_user('b1');
select is((select count(*)::int from approvals), 11, 'the manager sees their branch''s list');
select pg_temp.as_user('b2');
select is((select count(*)::int from approvals), 0, 'the front desk does not');

select * from finish();
rollback;
