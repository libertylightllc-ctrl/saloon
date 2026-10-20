-- Card payments for the plan (Creem, 2026-10-20): off until switched on; in test only platform admins may pay; only
-- the owner starts one; the amount covers the months and the extra people at the US-dollar price; Creem's paid event
-- extends the plan once (the same event again, or its order again, changes nothing); a refund is marked, the plan is
-- not cut; a plain payment link is matched by the salon code, else kept for review; the server's steps are the
-- server's only.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(16);
grant execute on function public.branch_today(uuid), public.business_today(uuid), public.unique_business_code(text),
  public.branch_setting(uuid, text, jsonb) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000044' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'card-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1', 'c2', 'd3', 'e4', 'f5']) n;

create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end $$;

-- A salon with 6 people (the owner and 5 logins): 2 over the 4 included.
select pg_temp.as_user('00000000-0000-0000-0000-0000000044a0');
select set_config('t.b', (create_business('{"business_name":"Card Salon","owner_name":"Owner","mode":"gents"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', ('00000000-0000-0000-0000-0000000044' || n)::uuid, 'username', 'cardstaff' || n, 'display_name', 'Staff ' || n,
  'role', case when n = 'b1' then 'cashier' else 'staff' end))
from unnest(array['b1', 'c2', 'd3', 'e4', 'f5']) n;
select pg_temp.as_admin();
select set_config('t.until', (select paid_until::text from subscriptions where business_id = current_setting('t.b')::uuid), false);
select set_config('t.code', (select code from businesses where id = current_setting('t.b')::uuid), false);

-- Off: nobody. Test: platform admins only. Only the owner.
select pg_temp.as_user('00000000-0000-0000-0000-0000000044a0');
select throws_ok(format($$ select card_checkout_start('%s', 1) $$, current_setting('t.b')), '22023', 'card_unavailable', 'off: no card payments');
select pg_temp.as_admin();
update platform_settings set card_payments = 'test';
select pg_temp.as_user('00000000-0000-0000-0000-0000000044a0');
select throws_ok(format($$ select card_checkout_start('%s', 1) $$, current_setting('t.b')), '22023', 'card_unavailable',
  'test: not for salon owners');
select pg_temp.as_admin();
insert into platform_admins (user_id) values ('00000000-0000-0000-0000-0000000044a0');
select pg_temp.as_user('00000000-0000-0000-0000-0000000044b1');
select throws_ok(format($$ select card_checkout_start('%s', 1) $$, current_setting('t.b')), '42501', null, 'a cashier cannot pay for the plan');

-- The owner (a platform admin while in test): 3 months for 6 people = (13.99 + 2 × 2.99) × 3 = USD 59.91.
select pg_temp.as_user('00000000-0000-0000-0000-0000000044a0');
select set_config('t.start', card_checkout_start(current_setting('t.b')::uuid, 3)::text, false);
select is((current_setting('t.start')::jsonb ->> 'amount_minor')::bigint, 5991::bigint, 'months and extra people in one amount');
select is(current_setting('t.start')::jsonb ->> 'mode', 'test', 'in test mode');
select set_config('t.req', current_setting('t.start')::jsonb ->> 'request_id', false);
select throws_ok($$ select card_payment_completed('{}') $$, '42501', null, 'only the server marks a payment paid');

-- Creem says it is paid: the plan runs 3 months longer, once.
select pg_temp.as_service();
select is(card_payment_completed(jsonb_build_object('request_id', current_setting('t.req'), 'checkout_id', 'ch_1', 'order_id', 'ord_1',
  'mode', 'test', 'paid_minor', 6291, 'paid_currency', 'USD', 'email', 'card-a0@test.local')) ->> 'result', 'paid', 'paid');
select pg_temp.as_admin();
select is((select paid_until from subscriptions where business_id = current_setting('t.b')::uuid),
  (current_setting('t.until')::date + interval '3 months')::date, 'the plan runs 3 months longer than the trial');
select is((select row(status, paid_minor, order_id)::text from card_payments where id = current_setting('t.req')::uuid),
  '(paid,6291,ord_1)', 'the payment is paid, with what Creem charged');
select ok(exists (select 1 from plan_events where business_id = current_setting('t.b')::uuid and kind = 'activate'
                  and note like 'Card payment (Creem, test) ord_1'), 'in the plan history');
select pg_temp.as_service();
select is(card_payment_completed(jsonb_build_object('request_id', current_setting('t.req'), 'checkout_id', 'ch_1', 'order_id', 'ord_1')) ->> 'result',
  'duplicate', 'the same event again changes nothing');
select pg_temp.as_admin();
select is((select paid_until from subscriptions where business_id = current_setting('t.b')::uuid),
  (current_setting('t.until')::date + interval '3 months')::date, 'not extended twice');

-- A refund is marked for review; the plan stays.
select pg_temp.as_service();
select is(card_payment_refunded(jsonb_build_object('checkout_id', 'ch_1', 'refund_minor', 6291, 'refund_currency', 'USD')) ->> 'result',
  'refunded', 'a refund is marked');
select pg_temp.as_admin();
select is((select paid_until from subscriptions where business_id = current_setting('t.b')::uuid),
  (current_setting('t.until')::date + interval '3 months')::date, 'the plan is not cut on its own');

-- A plain payment link: the salon code typed at checkout; otherwise kept for review.
select pg_temp.as_service();
select is(card_payment_completed(jsonb_build_object('checkout_id', 'ch_2', 'order_id', 'ord_2', 'months', 1,
  'salon_code', upper(current_setting('t.code')), 'mode', 'test', 'paid_minor', 1469, 'paid_currency', 'USD')) ->> 'result',
  'paid', 'a payment link with the salon code switches the plan on');
select is(card_payment_completed(jsonb_build_object('checkout_id', 'ch_3', 'order_id', 'ord_3', 'months', 1,
  'salon_code', 'nosuchsalon', 'mode', 'test', 'paid_minor', 1469, 'paid_currency', 'USD')) ->> 'result',
  'review', 'an unknown salon code is kept for review');

select * from finish();
rollback;
