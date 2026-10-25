-- The online booking link: the owner switches the page on (a link made from the salon's name); visitors see the
-- services and free times and book with a name and phone number; the booking lands in the queue as booked by the
-- customer, the owner is told, the customer is found or added; the customer can cancel before the cut-off; floods
-- and bad input are refused; a page that is off, or a salon without a plan, takes no bookings.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(28);
grant execute on function public.branch_today(uuid), public.business_today(uuid), public.unique_business_code(text),
  public.branch_setting(uuid, text, jsonb) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000042' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'book-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1', 'c2']) n;

create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_visitor() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
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
-- Books noon, two days from now, for the first service, with this name and phone.
create function pg_temp.book(p_name text, p_phone text, p_slot text default '12:00', p_days int default 2) returns jsonb language sql as $$
  select public_book(jsonb_build_object('slug', current_setting('t.slug'), 'service_ids', jsonb_build_array(current_setting('t.svc')),
    'starts_at', (current_setting('t.today')::date + p_days + p_slot::time) at time zone 'Asia/Dubai', 'name', p_name, 'phone', p_phone))
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000042a0');
select set_config('t.b', (create_business('{"business_name":"Booking Salon","owner_name":"Owner","mode":"gents"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select set_config('t.today', branch_today(current_setting('t.br')::uuid)::text, false);
select pg_temp.as_admin();
insert into subscriptions (business_id, paid_until) values (current_setting('t.b')::uuid, current_date + 60)
on conflict (business_id) do update set paid_until = excluded.paid_until;
select set_config('t.svc', (select id::text from services where business_id = current_setting('t.b')::uuid and status = 'active'
                            order by name limit 1), false);
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-0000000042b1', 'username', 'bookcash', 'display_name', 'Book Cashier', 'role', 'cashier'));

-- The owner switches it on; the link comes from the salon's name.
select pg_temp.as_user('00000000-0000-0000-0000-0000000042b1');
select throws_ok(format($$ select set_online_booking('%s', true) $$, current_setting('t.br')), '42501', null, 'a cashier cannot');
select pg_temp.as_user('00000000-0000-0000-0000-0000000042a0');
select set_config('t.slug', set_online_booking(current_setting('t.br')::uuid, true), false);
select is(current_setting('t.slug'), 'booking-salon', 'the link is made from the salon''s name');
select throws_ok(format($$ select set_online_booking('%s', true, 'No Spaces!') $$, current_setting('t.br')), '22023',
  'invalid_booking_link', 'a link is letters, digits and dashes');
select pg_temp.as_user('00000000-0000-0000-0000-0000000042c2');
select set_config('t.b2', (create_business('{"business_name":"Booking Salon","owner_name":"Other","mode":"ladies"}') ->> 'business_id'), false);
select is(set_online_booking((select id from branches where business_id = current_setting('t.b2')::uuid), true), 'booking-salon-2',
  'a second salon of the same name gets the next free link');
select throws_ok(format($$ select set_online_booking('%s', true, 'booking-salon') $$,
  (select id from branches where business_id = current_setting('t.b2')::uuid)), '23505', 'link_taken', 'nor another salon''s link');

-- A visitor sees the salon, its services and free times; no full staff names, nothing private.
select pg_temp.as_visitor();
select is(public_booking_page(current_setting('t.slug')) -> 'salon' ->> 'business_name', 'Booking Salon', 'the page opens for a visitor');
select ok(jsonb_array_length(public_booking_page(current_setting('t.slug')) -> 'services') > 0, 'with the salon''s services');
select is(public_booking_page('no-such-salon'), null, 'an unknown link shows nothing');
select ok((select count(*) from public_booking_slots(current_setting('t.slug'), current_setting('t.today')::date + 2,
  array[current_setting('t.svc')::uuid])) > 0, 'free times two days ahead');
select is((select min(slot) || '–' || max(slot) from public_booking_slots(current_setting('t.slug'), current_setting('t.today')::date + 2,
  array[current_setting('t.svc')::uuid])), '09:00–23:30', 'without rosters: 09:00 to 23:30, not the night');
select is((select count(*)::int from public_booking_slots(current_setting('t.slug'), current_setting('t.today')::date + 31,
  array[current_setting('t.svc')::uuid])), 0, 'none beyond 30 days');
select throws_ok($$ select book_slots(current_setting('t.br')::uuid, current_date, 30) $$, '42501', null,
  'a visitor cannot read the salon''s schedule directly');

-- A visitor books; it lands in the queue, booked by the customer; the owner is told; the customer is added.
select set_config('t.token', pg_temp.book('Omar Visitor', '050 123 4567') ->> 'token', false);
select pg_temp.as_admin();
select is((select row(source, status, customer_name)::text from appointments where booking_token = current_setting('t.token')),
  '(app,booked,"Omar Visitor")', 'booked by the customer, in the queue');
select is((select count(*)::int from customers where business_id = current_setting('t.b')::uuid and phone = '050 123 4567'), 1,
  'the customer is added with the phone number');
select ok(exists (select 1 from notifications where business_id = current_setting('t.b')::uuid and type = 'online_booking'),
  'the owner is told: new online booking');

-- The same time again (one at a time: nobody else to book); the same number is the same customer.
select pg_temp.as_visitor();
select throws_ok($$ select pg_temp.book('Someone Else', '055 999 0000') $$, '23P01', 'slot_taken', 'a taken time cannot be booked');
select lives_ok($$ select pg_temp.book('Omar V', '+971 50 123 4567', '13:00') $$, 'the same customer books again');
select pg_temp.as_admin();
select is((select count(*)::int from customers where business_id = current_setting('t.b')::uuid
           and right(regexp_replace(phone, '\D', '', 'g'), 9) = '501234567'), 1, 'found by number, not added twice');

-- Bad input and floods.
select pg_temp.as_visitor();
select throws_ok($$ select pg_temp.book('X', '050 123 4567', '14:00') $$, '22023', 'name_required', 'a name is needed');
select throws_ok($$ select pg_temp.book('Omar Visitor', 'call me', '14:00') $$, '22023', 'invalid_phone', 'and a phone number');
select lives_ok($$ select pg_temp.book('Omar Visitor', '0501234567', '15:00') $$, 'a third upcoming booking');
select throws_ok($$ select pg_temp.book('Omar Visitor', '0501234567', '16:00') $$, '22023', 'too_many_bookings',
  'not a fourth from the same number');

-- The customer cancels from their link; the salon is told.
select lives_ok(format($$ select public_booking_cancel('%s') $$, current_setting('t.token')), 'the customer cancels');
select pg_temp.as_admin();
select is((select status::text from appointments where booking_token = current_setting('t.token')), 'cancelled', 'cancelled in the queue');

select pg_temp.as_visitor();
select throws_ok(format($$ select public_booking_cancel('%s') $$, current_setting('t.token')), '22023', 'invalid_status',
  'a cancelled booking cannot be cancelled again');

-- Switched off, or no plan: no page, no bookings.
select pg_temp.as_user('00000000-0000-0000-0000-0000000042a0');
select set_online_booking(current_setting('t.br')::uuid, false);
select pg_temp.as_visitor();
select is(public_booking_page(current_setting('t.slug')), null, 'switched off: the page shows nothing');
select throws_ok($$ select pg_temp.book('Late Visitor', '052 222 3333', '17:00') $$, 'P0002', 'booking_unavailable',
  'and takes no bookings');
select pg_temp.as_user('00000000-0000-0000-0000-0000000042a0');
select set_online_booking(current_setting('t.br')::uuid, true);
select pg_temp.as_admin();
-- With billing on (full update, Phase 6), the plan and the free period both over.
update platform_settings set billing_enabled = true where true;
update subscriptions set paid_until = current_date - 2, free_until = current_date - 2 where business_id = current_setting('t.b')::uuid;
select pg_temp.as_visitor();
select is(public_booking_page(current_setting('t.slug')), null, 'a salon whose plan ended takes no online bookings');

select * from finish();
rollback;
