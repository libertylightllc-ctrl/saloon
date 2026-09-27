-- Notifications: who gets what (by role and branch), each event, the scheduled jobs (long waits, documents
-- due 30/7/0, the 08:00 digest) once each, refund requests, reading your own only, push tokens.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000080a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'nt-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000080c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'nt-cashier@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000080d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'nt-staff@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

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
-- Notifications of a type for a user (read as admin).
create function pg_temp.got(p_user uuid, p_type text) returns int language sql as $$
  select count(*)::int from notifications n join members m on m.id = n.member_id where m.user_id = p_user and n.type = p_type
$$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000080a');
select set_config('t.b', (create_business('{"business_name":"Notify Salon","owner_name":"Owner","mode":"gents",
  "vat_mode":"off","opening_cash_minor":10000,"opening_hours":{"open":"00:00","close":"23:59","days":[0,1,2,3,4,5,6]}}')
  ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-00000000080c', 'username', 'ntcash', 'display_name', 'Faisal', 'role', 'cashier'));
select set_config('t.emp', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'user_id', '00000000-0000-0000-0000-00000000080d', 'username', 'ntstaff',
  'display_name', 'Rafiq', 'role', 'staff')) ->> 'employee_id'), false);

-- ── Booking → owner and cashier ───────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000080d');
select create_appointment(jsonb_build_object('branch_id', current_setting('t.br'), 'kind', 'booking', 'guest_name', 'Omar',
  'scheduled_at', now() + interval '2 days', 'service_ids', jsonb_build_array((select id from services
  where business_id = current_setting('t.b')::uuid and status = 'active' limit 1))));
select pg_temp.as_admin();
select is(pg_temp.got('00000000-0000-0000-0000-00000000080a', 'new_booking'), 1, 'the owner hears about a new booking');
select is(pg_temp.got('00000000-0000-0000-0000-00000000080c', 'new_booking'), 1, 'so does the cashier');
select is(pg_temp.got('00000000-0000-0000-0000-00000000080d', 'new_booking'), 0, 'staff do not');
select is((select body from notifications where type = 'new_booking' limit 1) like 'Omar · %', true, 'the push text names the customer');

-- ── Walk-in waiting too long (target 20 min) ─────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000080c');
select set_config('t.walkin', (create_appointment(jsonb_build_object('branch_id', current_setting('t.br'), 'kind', 'walk_in',
  'guest_name', 'Yousef', 'service_ids', jsonb_build_array((select id from services
  where business_id = current_setting('t.b')::uuid and status = 'active' limit 1)))))::text, false);
select pg_temp.as_admin();
select notify_long_waits(now() + interval '10 minutes');
select is(pg_temp.got('00000000-0000-0000-0000-00000000080c', 'long_wait'), 0, 'not yet at 10 minutes');
select notify_long_waits(now() + interval '25 minutes');
select is(pg_temp.got('00000000-0000-0000-0000-00000000080c', 'long_wait'), 1, 'at 25 minutes the desk is told');
select notify_long_waits(now() + interval '40 minutes');
select is(pg_temp.got('00000000-0000-0000-0000-00000000080a', 'long_wait'), 1, 'the owner too, only once');

-- ── Close submitted → owner ──────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000080c');
select submit_cash_count(jsonb_build_object('branch_id', current_setting('t.br'), 'counted_cash_minor', 9500, 'submit', true,
  'drawer_closed_confirmed', true, 'reason', 'Short change'));
select pg_temp.as_admin();
select is(pg_temp.got('00000000-0000-0000-0000-00000000080a', 'close_submitted'), 1, 'the owner is asked to approve the close');
select is(pg_temp.got('00000000-0000-0000-0000-00000000080c', 'close_submitted'), 0, 'the cashier who sent it is not');

-- ── Low stock → owner and cashier, when an item crosses its reorder level ────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000080a');
select set_config('t.item', save_item(jsonb_build_object('business_id', current_setting('t.b'), 'name', 'Hair Wax',
  'kind', 'retail', 'sell_price_minor', 4500, 'reorder_level', 3))::text, false);
select set_opening_stock(current_setting('t.br')::uuid, jsonb_build_array(jsonb_build_object('item_id', current_setting('t.item'),
  'qty', 5, 'unit_cost_minor', 2000)));
select adjust_stock(jsonb_build_object('branch_id', current_setting('t.br'), 'item_id', current_setting('t.item'), 'qty_delta', -1,
  'reason', 'Tester opened'));
select pg_temp.as_admin();
select is(pg_temp.got('00000000-0000-0000-0000-00000000080a', 'low_stock'), 0, 'at 4 of reorder 3: nothing yet');
select pg_temp.as_user('00000000-0000-0000-0000-00000000080a');
select adjust_stock(jsonb_build_object('branch_id', current_setting('t.br'), 'item_id', current_setting('t.item'), 'qty_delta', -2,
  'reason', 'Damaged'));
select pg_temp.as_admin();
select is(pg_temp.got('00000000-0000-0000-0000-00000000080a', 'low_stock'), 1, 'crossing to 2 tells the owner');
select is(pg_temp.got('00000000-0000-0000-0000-00000000080c', 'low_stock'), 1, 'and the cashier');

-- ── Payroll worked out → owner ───────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000080a');
select save_employee(jsonb_build_object('business_id', current_setting('t.b'), 'id', current_setting('t.emp'), 'full_name', 'Rafiq',
  'base_salary_minor', 300000));
select generate_payroll(current_setting('t.b')::uuid, to_char(branch_today(current_setting('t.br')::uuid), 'YYYY-MM'));
select pg_temp.as_admin();
select is(pg_temp.got('00000000-0000-0000-0000-00000000080a', 'payroll_generated'), 1, 'payroll worked out tells the owner');
select is(pg_temp.got('00000000-0000-0000-0000-00000000080c', 'payroll_generated'), 0, 'never the cashier');

-- ── Refund request ──────────────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000080a');
select set_config('t.sale', (create_sale(jsonb_build_object('branch_id', current_setting('t.br'),
  'lines', '[{"kind":"custom","name":"Fade","unit_price_minor":5000}]'::jsonb,
  'payments', '[{"method":"card","amount_minor":5000}]'::jsonb)) ->> 'sale_id'), false);
select throws_ok(format($$ select request_refund('{"sale_id":"%s","amount_minor":1000,"reason":"Unhappy"}') $$, current_setting('t.sale')),
  '42501', null, 'the owner refunds directly; requests are for cashiers');
select pg_temp.as_user('00000000-0000-0000-0000-00000000080c');
select throws_ok(format($$ select request_refund('{"sale_id":"%s","amount_minor":9000,"reason":"Unhappy"}') $$, current_setting('t.sale')),
  '22023', 'invalid_amount', 'not more than the sale');
select lives_ok(format($$ select request_refund('{"sale_id":"%s","amount_minor":2000,"reason":"Customer unhappy with fade"}') $$,
  current_setting('t.sale')), 'the cashier asks for a AED 20 refund');
select throws_ok(format($$ select request_refund('{"sale_id":"%s","amount_minor":1000,"reason":"Again"}') $$, current_setting('t.sale')),
  '22023', 'already_requested', 'one open request per sale');
select pg_temp.as_admin();
select is(pg_temp.got('00000000-0000-0000-0000-00000000080a', 'refund_requested'), 1, 'the owner is told');
select pg_temp.as_user('00000000-0000-0000-0000-00000000080a');
select refund_sale(jsonb_build_object('sale_id', current_setting('t.sale'), 'amount_minor', 2000, 'method', 'card', 'reason', 'As asked'));
select is((select status from refund_requests), 'done', 'refunding settles the request');

-- ── Documents due and the digest ─────────────────────────────────────────────────────────
select save_document(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'doc_type', 'trade_licence', 'holder_type', 'company', 'expires_on', branch_today(current_setting('t.br')::uuid) + 30));
select pg_temp.as_admin();
select notify_documents_due(branch_today(current_setting('t.br')::uuid));
select is(pg_temp.got('00000000-0000-0000-0000-00000000080a', 'document_due'), 1, '30 days before: a reminder');
select notify_documents_due(branch_today(current_setting('t.br')::uuid) + 5);
select is(pg_temp.got('00000000-0000-0000-0000-00000000080a', 'document_due'), 1, '25 days before: none');
select notify_documents_due(branch_today(current_setting('t.br')::uuid) + 23);
select notify_documents_due(branch_today(current_setting('t.br')::uuid) + 30);
select is(pg_temp.got('00000000-0000-0000-0000-00000000080a', 'document_due'), 3, '7 days before and on the day');
select send_daily_digests(((branch_today(current_setting('t.br')::uuid) + 1) + time '08:05') at time zone 'Asia/Dubai');
select is(pg_temp.got('00000000-0000-0000-0000-00000000080a', 'daily_digest'), 1, 'the owner gets the morning digest at 08:05');
select send_daily_digests(((branch_today(current_setting('t.br')::uuid) + 1) + time '08:35') at time zone 'Asia/Dubai');
select is(pg_temp.got('00000000-0000-0000-0000-00000000080a', 'daily_digest'), 1, 'once a day');
select is(pg_temp.got('00000000-0000-0000-0000-00000000080c', 'daily_digest'), 0, 'the digest is for the owner');

-- ── Reading ─────────────────────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000080c');
select is((select count(*)::int from notifications), 3, 'a cashier reads only their own: booking, long wait, low stock');
select is(mark_notifications_read(), 3, 'mark all as read');
select is((select count(*)::int from notifications where read_at is null), 0, 'none left unread');
select throws_ok(format($$ select register_push_token('%s', 'not-a-token', 'ios') $$, current_setting('t.b')), '22023',
  'invalid_token', 'only Expo push tokens are accepted');

select * from finish();
rollback;
