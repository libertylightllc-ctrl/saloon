-- Undo a no-show marked by mistake (owner, 2026-10-01): the visit returns to the queue, the customer's no-show count
-- drops, and a deposit that was kept is held again through a reversing entry; the books end where they started.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(10);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000021a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'undo-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.balance(p_key text) returns bigint language sql as $$
  select coalesce(sum(l.debit_minor - l.credit_minor), 0)::bigint
  from journal_lines l join journal_entries e on e.id = l.entry_id join accounts a on a.id = l.account_id
  where e.business_id = current_setting('t.b')::uuid and a.system_key = p_key
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000021a0');
select set_config('t.b', (create_business('{"business_name":"Undo Salon","owner_name":"Owner","mode":"ladies"}')
  ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select set_config('t.svc', (save_service(jsonb_build_object('business_id', current_setting('t.b'), 'name', 'Gel nails',
  'price_minor', 12000, 'duration_min', 45,
  'category_id', (select id from service_categories where business_id = current_setting('t.b')::uuid limit 1))))::text, false);
insert into customers (business_id, name, phone) values (current_setting('t.b')::uuid, 'Sara Undo', '+971501112233');
select set_config('t.cust', (select id::text from customers where business_id = current_setting('t.b')::uuid), false);

-- A booking later today with a AED 50 deposit, marked no-show by mistake.
select set_config('t.book', create_appointment(jsonb_build_object('branch_id', current_setting('t.br'), 'kind', 'booking',
  'customer_id', current_setting('t.cust'), 'scheduled_at', now() + interval '1 minute',
  'service_ids', jsonb_build_array(current_setting('t.svc')), 'deposit_minor', 5000, 'deposit_method', 'cash'))::text, false);
select mark_no_show(current_setting('t.book')::uuid);
select is(pg_temp.balance('other_income'), -5000::bigint, 'the no-show kept the AED 50 deposit as income');

select lives_ok(format($$ select undo_no_show(%L) $$, current_setting('t.book')), 'undo the no-show');
select results_eq(format($$ select status::text, deposit_status::text from appointments where id = %L $$, current_setting('t.book')),
  $$ values ('booked', 'held') $$, 'the booking is back, its deposit held again');
select is(pg_temp.balance('other_income'), 0::bigint, 'the income is reversed');
select is(pg_temp.balance('deposits_held'), -5000::bigint, 'and the deposit is owed to the customer again');
select is((select count(*)::int from journal_entries where business_id = current_setting('t.b')::uuid
  and source_type = 'deposit_forfeit_reversal'), 1, 'by a reversing entry (nothing deleted)');
select is((select no_show_count from customers where id = current_setting('t.cust')::uuid), 0, 'the customer''s count is back');
select throws_ok(format($$ select undo_no_show(%L) $$, current_setting('t.book')), '22023', 'invalid_status',
  'only a no-show can be undone');

-- A walk-in returns to waiting.
select set_config('t.walk', create_appointment(jsonb_build_object('branch_id', current_setting('t.br'), 'kind', 'walk_in',
  'guest_name', 'Mona', 'service_ids', jsonb_build_array(current_setting('t.svc'))))::text, false);
select mark_no_show(current_setting('t.walk')::uuid);
select lives_ok(format($$ select undo_no_show(%L) $$, current_setting('t.walk')), 'undo a walk-in''s no-show');
select is((select status::text from appointments where id = current_setting('t.walk')::uuid), 'waiting', 'back in the waiting line');

select * from finish();
rollback;
