-- Part B, step 8 (owner's app check, 10 Nov 2026; brief B6 and E1): who gets which alert. Each login type gets only its
-- own alerts; an alert meant for a login type the branch does not have goes to the owner; nobody is alerted about what
-- they did themselves; booking, walk-in and arrival alerts end with the booking, the visit or the day.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(74);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000076' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'alert-roles-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(),
       '{}', '{}'
from unnest(array['a0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6']) n;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000076' || p)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

select pg_temp.as_user('a0');
select set_config('t.b', (create_business('{"business_name":"Alert Roles Salon","owner_name":"Owner","mode":"gents",
  "vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select set_config('t.svc', (select id::text from services where business_id = current_setting('t.b')::uuid
                            and status = 'active' order by price_minor desc limit 1), false);
select set_config('t.wax', save_item(jsonb_build_object('business_id', current_setting('t.b'), 'name', 'Hair Wax',
  'kind', 'retail', 'unit', 'pcs', 'reorder_level', 3, 'sell_price_minor', 3500))::text, false);
select set_config('t.sup', save_supplier(jsonb_build_object('business_id', current_setting('t.b'),
  'name', 'Gulf Barber Wholesale', 'terms_days', 2))::text, false);

-- Manager Mona (b1), front desk Dina (b2), stylists Sami (b3) and Rami (b5) in the branch; the accountant (b4); stylist
-- Zed (b6) in a second branch that has no manager and no front desk.
select pg_temp.as_admin();
select set_config('t.today', branch_today(current_setting('t.br')::uuid)::text, false);
select set_config('t.last', to_char(current_setting('t.today')::date - interval '1 month', 'YYYY-MM'), false);
select set_config('t.ma0', (select id::text from members where business_id = current_setting('t.b')::uuid
                            and role = 'owner'), false);
with b as (insert into branches (business_id, name, mode, created_at)
           values (current_setting('t.b')::uuid, 'Second branch', 'gents', clock_timestamp()) returning id)
select set_config('t.br2', id::text, false) from b;
create function pg_temp.member(p_user text, p_role text, p_name text, p_branch text default 't.br') returns void
language plpgsql as $$
declare v uuid;
begin
  insert into members (business_id, user_id, role, display_name, username)
  values (current_setting('t.b')::uuid, ('00000000-0000-0000-0000-0000000076' || p_user)::uuid, p_role::member_role,
          p_name, lower(p_name) || 'seventysix') returning id into v;
  perform set_config('t.m' || p_user, v::text, false);
  if p_role <> 'accountant' then
    insert into member_branches (member_id, branch_id) values (v, current_setting(p_branch)::uuid);
    insert into employees (business_id, branch_id, member_id, full_name, role_title)
    values (current_setting('t.b')::uuid, current_setting(p_branch)::uuid, v, p_name,
            case p_role when 'cashier' then 'cashier' when 'manager' then 'manager' else 'staff' end)
    returning id into v;
    perform set_config('t.e' || p_user, v::text, false);
  end if;
end $$;
select pg_temp.member('b1', 'manager', 'Mona'), pg_temp.member('b2', 'cashier', 'Dina'),
       pg_temp.member('b3', 'staff', 'Sami'), pg_temp.member('b4', 'accountant', 'Books'),
       pg_temp.member('b5', 'staff', 'Rami'), pg_temp.member('b6', 'staff', 'Zed', 't.br2');
select pg_temp.as_user('b1'); select set_my_pin(current_setting('t.b')::uuid, '1357');

-- Alerts someone has now (not ended), of one type, optionally about one thing.
create function pg_temp.n(p_user text, p_type text, p_entity text default null) returns int language sql as $$
  select count(*)::int from notifications
  where member_id = current_setting('t.m' || p_user)::uuid and type = p_type
    and (p_entity is null or entity_id = current_setting(p_entity)::uuid)
    and (expires_at is null or expires_at > now())
$$;
-- A booking from the online booking page (nobody signed in).
create function pg_temp.online(p_branch text, p_employee text, p_at timestamptz, p_token text default null) returns uuid
language sql as $$
  insert into appointments (business_id, branch_id, source, status, scheduled_at, business_date, customer_name,
                            employee_id, booking_token)
  values (current_setting('t.b')::uuid, current_setting(p_branch)::uuid, 'app', 'booked', p_at,
          (p_at at time zone 'Asia/Dubai')::date, 'Omar Online', current_setting(p_employee)::uuid, p_token)
  returning id
$$;
-- A booking made in the app.
create function pg_temp.book(p_employee text, p_at timestamptz, p_name text) returns uuid language sql as $$
  select create_appointment(jsonb_build_object('branch_id', current_setting('t.br'), 'kind', 'booking',
    'customer_name', p_name, 'employee_id', current_setting(p_employee), 'scheduled_at', p_at,
    'service_ids', jsonb_build_array(current_setting('t.svc'))))
$$;
-- A sale of one custom line at 100.00, paid in cash.
create function pg_temp.sale(p_discount bigint, p_extra jsonb default '{}') returns jsonb language sql as $$
  select create_sale(jsonb_build_object('branch_id', current_setting('t.br'),
    'lines', '[{"kind":"custom","name":"Cut","unit_price_minor":10000}]'::jsonb, 'discount_minor', p_discount,
    'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_minor', 10000 - p_discount))) || p_extra)
$$;

-- 1. A new online booking: the front desk and the stylist.
select pg_temp.as_admin();
select set_config('t.ap1', pg_temp.online('t.br', 't.eb3', now() + interval '2 days')::text, false);
select is(pg_temp.n('b2', 'online_booking', 't.ap1'), 1, 'an online booking: the front desk is told');
select is(pg_temp.n('b3', 'new_booking', 't.ap1'), 1, 'and so is Sami, the stylist it is with');
select is((select count(*)::int from notifications where entity_id = current_setting('t.ap1')::uuid
           and member_id not in (current_setting('t.mb2')::uuid, current_setting('t.mb3')::uuid)), 0,
  'nobody else: not the owner, the manager, the accountant or Rami');
select is((select expires_at from notifications where entity_id = current_setting('t.ap1')::uuid
           and member_id = current_setting('t.mb3')::uuid),
  (select scheduled_at from appointments where id = current_setting('t.ap1')::uuid), 'the alert ends at the booking time');
select set_config('t.ap7', pg_temp.online('t.br', 't.eb3', now() - interval '1 hour')::text, false);
select is((select count(*)::int from notifications where entity_id = current_setting('t.ap7')::uuid), 0,
  'a booking entered after its time alerts nobody');

-- 2. A booking the front desk makes: only the stylist.
select pg_temp.as_user('b2');
select set_config('t.ap2', pg_temp.book('t.eb5', now() + interval '3 days', 'Khalid')::text, false);
select pg_temp.as_admin();
select is(pg_temp.n('b5', 'new_booking', 't.ap2'), 1, 'a booking the front desk makes: Rami is told');
select is((select count(*)::int from notifications where entity_id = current_setting('t.ap2')::uuid), 1, 'and only Rami');

-- 3. Moved to another time, or to another stylist.
update appointments set scheduled_at = scheduled_at + interval '1 hour' where id = current_setting('t.ap1')::uuid;
select is(pg_temp.n('b3', 'booking_moved', 't.ap1'), 1, 'moved to another time: Sami is told');
select is(pg_temp.n('b3', 'new_booking', 't.ap1') + pg_temp.n('b2', 'online_booking', 't.ap1'), 0,
  'and the alerts with the old time end');
update appointments set employee_id = current_setting('t.eb3')::uuid where id = current_setting('t.ap2')::uuid;
select is(pg_temp.n('b5', 'booking_moved', 't.ap2'), 1, 'given to Sami instead: Rami is told it moved');
select is(pg_temp.n('b5', 'new_booking', 't.ap2'), 0, 'Rami''s new-booking alert ends');
select is(pg_temp.n('b3', 'new_booking', 't.ap2'), 1, 'and Sami gets it as a new booking');

-- 4. Cancelled by the manager; cancelled online by the client.
select pg_temp.as_user('b1');
select lives_ok(format($$ select cancel_appointment('%s', 'Client called') $$, current_setting('t.ap1')),
  'Mona cancels a booking');
select pg_temp.as_admin();
select is(pg_temp.n('b2', 'booking_cancelled', 't.ap1'), 1, 'the front desk is told');
select is(pg_temp.n('b3', 'booking_cancelled', 't.ap1'), 1, 'and so is Sami');
select is(pg_temp.n('b1', 'booking_cancelled', 't.ap1') + pg_temp.n('a0', 'booking_cancelled', 't.ap1'), 0,
  'not Mona, who cancelled it, nor the owner');
select is(pg_temp.n('b3', 'booking_moved', 't.ap1'), 0, 'the moved alert ends');
select set_config('t.ap3', pg_temp.online('t.br', 't.eb5', now() + interval '4 days', 'tok76tok76tok76tok76tok7')::text, false);
select lives_ok($$ select public_booking_cancel('tok76tok76tok76tok76tok7') $$, 'a client cancels online');
select is(pg_temp.n('b2', 'online_cancelled', 't.ap3'), 1, 'the front desk is told it was cancelled online');
select is(pg_temp.n('b5', 'booking_cancelled', 't.ap3'), 1, 'and so is Rami');
select is(pg_temp.n('b2', 'online_booking', 't.ap3') + pg_temp.n('b5', 'new_booking', 't.ap3'), 0,
  'the booking alerts end');

-- 5. Checked in, then the visit starts.
select pg_temp.as_user('b2');
select set_config('t.ap4', pg_temp.book('t.eb3', now() + interval '2 hours', 'Faisal')::text, false);
select pg_temp.as_user('b1');
select lives_ok(format($$ select check_in('%s') $$, current_setting('t.ap4')), 'Mona checks in a booked client');
select pg_temp.as_admin();
select is(pg_temp.n('b2', 'client_arrived', 't.ap4'), 1, 'the front desk is told the client arrived');
select is(pg_temp.n('b3', 'client_arrived', 't.ap4'), 1, 'and so is Sami');
select is(pg_temp.n('b1', 'client_arrived', 't.ap4'), 0, 'not Mona, who checked them in');
select is(pg_temp.n('b3', 'new_booking', 't.ap4'), 0, 'Sami''s booking alert ends');
select pg_temp.as_user('b1');
select lives_ok(format($$ select start_service('%s') $$, current_setting('t.ap4')), 'Mona starts the visit');
select pg_temp.as_admin();
select is(pg_temp.n('b2', 'client_arrived', 't.ap4') + pg_temp.n('b3', 'client_arrived', 't.ap4'), 0,
  'the arrival alerts end');

-- 6. A walk-in, waiting too long.
select pg_temp.as_user('b2');
select set_config('t.w1', create_appointment(jsonb_build_object('branch_id', current_setting('t.br'), 'kind', 'walk_in',
  'customer_name', 'Walk-in Saeed', 'employee_id', current_setting('t.eb5')))::text, false);
select pg_temp.as_admin();
select is(pg_temp.n('b5', 'client_arrived', 't.w1'), 1, 'a walk-in for Rami: Rami is told');
select is((select expires_at from notifications where entity_id = current_setting('t.w1')::uuid and type = 'client_arrived'),
  branch_day_end(current_setting('t.br')::uuid), 'until the end of the day');
select notify_long_waits(now() + interval '30 minutes');
select is(pg_temp.n('b2', 'long_wait', 't.w1'), 1, 'after a long wait the front desk is told');
select is(pg_temp.n('b1', 'long_wait', 't.w1') + pg_temp.n('a0', 'long_wait', 't.w1'), 0,
  'not the manager or the owner');
select pg_temp.as_user('b1');
select lives_ok(format($$ select start_service('%s') $$, current_setting('t.w1')), 'the visit starts');
select pg_temp.as_admin();
select is(pg_temp.n('b2', 'long_wait', 't.w1') + pg_temp.n('b5', 'client_arrived', 't.w1'), 0, 'and those alerts end');

-- 7. A no-show: the manager.
select pg_temp.as_user('b2');
select set_config('t.ap5', pg_temp.book('t.eb3', now() + interval '3 hours', 'Tariq')::text, false);
select lives_ok(format($$ select mark_no_show('%s') $$, current_setting('t.ap5')), 'the front desk marks a no-show');
select pg_temp.as_admin();
select is(pg_temp.n('b1', 'no_show', 't.ap5'), 1, 'the manager is told');
select is(pg_temp.n('a0', 'no_show', 't.ap5') + pg_temp.n('b2', 'no_show', 't.ap5'), 0,
  'not the owner, whose branch has a manager, nor the front desk');
select is(pg_temp.n('b3', 'new_booking', 't.ap5'), 0, 'Sami''s booking alert ends');

-- 8. A branch with no front desk: the owner gets its online bookings.
select set_config('t.ap6', pg_temp.online('t.br2', 't.eb6', now() + interval '2 days')::text, false);
select is(pg_temp.n('a0', 'online_booking', 't.ap6'), 1, 'a branch with no front desk: the owner gets its online bookings');
select is(pg_temp.n('b6', 'new_booking', 't.ap6'), 1, 'Zed, its stylist, is told too');
select is(pg_temp.n('b2', 'online_booking', 't.ap6'), 0, 'not the front desk of the other branch');

-- 9. Low on stock: the manager.
insert into stock_levels (item_id, branch_id, qty) values (current_setting('t.wax')::uuid, current_setting('t.br')::uuid, 10)
on conflict (item_id, branch_id) do update set qty = 10;
update stock_levels set qty = 2 where item_id = current_setting('t.wax')::uuid and branch_id = current_setting('t.br')::uuid;
select is(pg_temp.n('b1', 'low_stock'), 1, 'low on stock: the manager is told');
select is(pg_temp.n('a0', 'low_stock') + pg_temp.n('b2', 'low_stock'), 0, 'not the owner or the front desk');

-- 10. Every hour: missed clock-outs (manager), bills due (accountant), a month ready to close (accountant).
insert into attendance (business_id, branch_id, employee_id, business_date, clock_in)
values (current_setting('t.b')::uuid, current_setting('t.br')::uuid, current_setting('t.eb3')::uuid,
        current_setting('t.today')::date - 1, ((current_setting('t.today')::date - 1) + time '10:00') at time zone 'Asia/Dubai'),
       (current_setting('t.b')::uuid, current_setting('t.br2')::uuid, current_setting('t.eb6')::uuid,
        current_setting('t.today')::date - 1, ((current_setting('t.today')::date - 1) + time '10:00') at time zone 'Asia/Dubai');
select set_config('t.at1', (select id::text from attendance where employee_id = current_setting('t.eb3')::uuid), false);
select set_config('t.at2', (select id::text from attendance where employee_id = current_setting('t.eb6')::uuid), false);
insert into journal_entries (business_id, branch_id, business_date, source_type, memo)
values (current_setting('t.b')::uuid, current_setting('t.br')::uuid, (current_setting('t.last') || '-15')::date, 'manual',
        'Last month');
select pg_temp.as_user('b1');
select set_config('t.bill', (post_purchase_bill(jsonb_build_object('branch_id', current_setting('t.br'),
  'supplier_id', current_setting('t.sup'), 'lines', '[{"description":"Towels","qty":2,"unit_cost_minor":500}]'::jsonb))
  ->> 'bill_id'), false);
select pg_temp.as_admin();
select role_alerts();
select is(pg_temp.n('b1', 'missed_clock_out', 't.at1'), 1, 'a clock-out missed yesterday: the manager is told');
select is(pg_temp.n('a0', 'missed_clock_out', 't.at1'), 0, 'not the owner');
select is(pg_temp.n('a0', 'missed_clock_out', 't.at2'), 1, 'in the branch with no manager, the owner is');
select is(pg_temp.n('b4', 'bill_due', 't.bill'), 1, 'a supplier bill due in two days: the accountant is told');
select is(pg_temp.n('a0', 'bill_due', 't.bill') + pg_temp.n('b1', 'bill_due', 't.bill'), 0,
  'not the owner or the manager');
select is(pg_temp.n('b4', 'month_ready'), 1, 'last month is over: the accountant is told to close it');
select is(pg_temp.n('a0', 'month_ready'), 0, 'not the owner');
select role_alerts();
select is(pg_temp.n('b1', 'missed_clock_out', 't.at1') + pg_temp.n('b4', 'bill_due', 't.bill')
          + pg_temp.n('b4', 'month_ready'), 3, 'each alert is sent once');
select pg_temp.as_user('b1');
select lives_ok(format($$ select fix_clock_out('%s', '%s', 'Forgot to clock out') $$, current_setting('t.at1'),
  ((current_setting('t.today')::date - 1) + time '19:00') at time zone 'Asia/Dubai'), 'Mona fixes the clock-out');
select pg_temp.as_user('b4');
select lives_ok(format($$ select pay_supplier('{"branch_id":"%s","supplier_id":"%s","bill_id":"%s","method":"bank",
  "amount_minor":1000}') $$, current_setting('t.br'), current_setting('t.sup'), current_setting('t.bill')),
  'the accountant pays the bill');
select lives_ok(format($$ select close_period('%s', '%s') $$, current_setting('t.b'), current_setting('t.last')),
  'and closes last month');
select pg_temp.as_admin();
select is(pg_temp.n('b1', 'missed_clock_out', 't.at1'), 0, 'the missed clock-out alert ends once fixed');
select is(pg_temp.n('b4', 'bill_due', 't.bill'), 0, 'the bill alert once paid');
select is(pg_temp.n('b4', 'month_ready'), 0, 'the month alert once closed');

-- 11. A delivery waiting for prices: the manager and the accountant.
create function pg_temp.upload() returns text language sql as $$
  insert into storage.objects (bucket_id, name, owner, metadata)
  values ('receipts', current_setting('t.b') || '/deliveries/' || gen_random_uuid() || '.jpg', auth.uid(),
          '{"mimetype":"image/jpeg","size":1200}')
  returning name
$$;
select pg_temp.as_user('b2');
select set_config('t.d1', (receive_delivery(jsonb_build_object('branch_id', current_setting('t.br'),
  'supplier_id', current_setting('t.sup'), 'note_path', pg_temp.upload(),
  'lines', jsonb_build_array(jsonb_build_object('item_id', current_setting('t.wax'), 'packs', 2, 'pack_size', 12))))
  ->> 'delivery_id'), false);
select pg_temp.as_admin();
select is(pg_temp.n('b1', 'delivery_waiting', 't.d1'), 1, 'a delivery the front desk received: the manager is told');
select is(pg_temp.n('b4', 'delivery_waiting', 't.d1'), 1, 'and the accountant');
select is(pg_temp.n('a0', 'delivery_waiting', 't.d1') + pg_temp.n('b2', 'delivery_waiting', 't.d1'), 0,
  'not the owner or the front desk');
select pg_temp.as_user('b4');
select lives_ok(format($$ select price_delivery(jsonb_build_object('delivery_id', '%s', 'lines', jsonb_build_array(
  jsonb_build_object('line_id', (select id from delivery_lines where delivery_id = '%s'), 'unit_price_minor', 6000)))) $$,
  current_setting('t.d1'), current_setting('t.d1')), 'the accountant prices it');
select pg_temp.as_admin();
select is(pg_temp.n('b1', 'delivery_waiting', 't.d1') + pg_temp.n('b4', 'delivery_waiting', 't.d1'), 0,
  'and the alerts end');

-- 12. A refund, and a discount above the limit, approved by someone else: the owner.
select pg_temp.as_user('b2');
select set_config('t.s1', pg_temp.sale(0) ->> 'sale_id', false);
select set_config('t.pin', approve_with_pin(current_setting('t.br')::uuid, current_setting('t.mb1')::uuid, '1357',
  'discount', 2500) ->> 'approval_id', false);
select set_config('t.s2', pg_temp.sale(2500, jsonb_build_object('approvals', jsonb_build_object('discount',
  current_setting('t.pin')))) ->> 'sale_id', false);
select pg_temp.as_user('b1');
select lives_ok(format($$ select refund_sale(jsonb_build_object('sale_id', '%s', 'amount_minor', 1000, 'method', 'cash',
  'reason', 'Client unhappy')) $$, current_setting('t.s1')), 'Mona refunds 10.00, with a reason');
select pg_temp.as_admin();
select is((select title || ' · ' || body from notifications where member_id = current_setting('t.ma0')::uuid
           and type = 'discount_over_limit'), 'Discount 25% (limit 10%) · Dina · approved by Mona',
  'a 25% discount on Mona''s PIN: the owner is told, with the limit it went over');
select is((select title || ' · ' || body from notifications where member_id = current_setting('t.ma0')::uuid
           and type = 'refund_made'), 'Refund AED 10.00 · Mona · Client unhappy', 'a refund by the manager: the owner is told');
select is(pg_temp.n('b1', 'refund_made') + pg_temp.n('b4', 'refund_made') + pg_temp.n('b1', 'discount_over_limit')
          + pg_temp.n('b2', 'discount_over_limit'), 0, 'nobody else');
select pg_temp.as_user('a0');
select lives_ok(format($$ select refund_sale(jsonb_build_object('sale_id', '%s', 'amount_minor', 1000, 'method', 'cash',
  'reason', 'Client unhappy')) $$, current_setting('t.s2')), 'the owner refunds');
select pg_temp.as_admin();
select is(pg_temp.n('a0', 'refund_made'), 1, 'and is not told about their own refund');

-- 13. A licence expiring: the owner and the managers of that branch.
select pg_temp.as_user('a0');
select set_config('t.doc', save_document(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'doc_type', 'trade_licence', 'holder_type', 'company', 'number', 'CN-76',
  'issued_on', current_setting('t.today')::date - 300, 'expires_on', current_setting('t.today')::date + 30))::text, false);
select pg_temp.as_admin();
select notify_documents_due(current_setting('t.today')::date);
select is(pg_temp.n('a0', 'document_due', 't.doc'), 1, 'a licence due in 30 days: the owner is told');
select is(pg_temp.n('b1', 'document_due', 't.doc'), 1, 'and the branch''s manager');
select is(pg_temp.n('b2', 'document_due', 't.doc') + pg_temp.n('b4', 'document_due', 't.doc'), 0,
  'not the front desk or the accountant');

-- 14. Alerts that have ended are hidden, not deleted.
select pg_temp.as_user('b3');
select is((select string_agg(type, ',') from notifications where entity_id = current_setting('t.ap1')::uuid),
  'booking_cancelled', 'Sami now sees only the cancellation of that booking');
select pg_temp.as_admin();
select is((select count(*)::int from notifications where entity_id = current_setting('t.ap1')::uuid
           and member_id = current_setting('t.mb3')::uuid), 3, 'the ended alerts are kept');
insert into notifications (business_id, branch_id, member_id, type, title, body, expires_at)
values (current_setting('t.b')::uuid, current_setting('t.br')::uuid, current_setting('t.mb2')::uuid, 'long_wait',
        'Walk-in waiting', 'Yesterday', now() - interval '1 minute');
select pg_temp.as_user('b2');
select is((select count(*)::int from notifications where body = 'Yesterday'), 0, 'an alert past its end is hidden');

select * from finish();
rollback;
