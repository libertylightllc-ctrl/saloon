-- Security review (owner's platform audit, 2026-10-04): what the three reviewers found, each tried and refused.
-- Salon A's owner is the attacker; salon B is the target.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(13);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000026' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'sec-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1', 'b2', 'b3']) n;

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

-- Salon B with a barber (b2) and a cashier (b3); salon A (a0) is someone else's.
select pg_temp.as_user('00000000-0000-0000-0000-0000000026b1');
select set_config('t.b', (create_business('{"business_name":"Target Salon","owner_name":"B","mode":"gents","is_demo":true}') ->> 'business_id'), false);
select set_config('t.bbr', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_service();
select set_config('t.bemp', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.bbr'), 'user_id', '00000000-0000-0000-0000-0000000026b2', 'username', 'targetbarber',
  'display_name', 'Target Barber', 'role', 'staff', 'commission_bps', 5000)) ->> 'employee_id'), false);
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.bbr'),
  'user_id', '00000000-0000-0000-0000-0000000026b3', 'username', 'targetcash', 'display_name', 'Target Cashier', 'role', 'cashier'));
select pg_temp.as_user('00000000-0000-0000-0000-0000000026a0');
select set_config('t.a', (create_business('{"business_name":"Attacker Salon","owner_name":"A","mode":"gents"}') ->> 'business_id'), false);
select set_config('t.abr', (select id::text from branches where business_id = current_setting('t.a')::uuid), false);

select pg_temp.as_service();
select is((select is_demo from businesses where id = current_setting('t.b')::uuid), false,
  'a new salon cannot mark itself a demo (and hide from the platform owner)');
select pg_temp.as_user('00000000-0000-0000-0000-0000000026a0');

-- Internal helpers cannot be called at all.
select throws_ok(format($$ select post_journal('%s', '%s', current_date, 'x', null, 'fake', null,
  '[{"account":"cash","debit":100},{"account":"owner_equity","credit":100}]') $$, current_setting('t.b'), current_setting('t.bbr')),
  '42501', null, 'post_journal into another salon is refused');
select throws_ok(format($$ select write_audit('%s', null, null, 'x', 'x', null, 'forged', null, null) $$, current_setting('t.b')),
  '42501', null, 'write_audit into another salon is refused');
select throws_ok(format($$ select seed_system_accounts('%s') $$, current_setting('t.b')), '42501', null, 'seeding another salon is refused');
select throws_ok(format($$ select branch_setting('%s', 'receipt_mode', 'null') $$, current_setting('t.bbr')), '42501', null,
  'reading another salon''s settings is refused');

-- Quick sale: salon B's barber cannot be put on salon A's sale (line or tip).
select throws_ok(format($$ select create_sale(jsonb_build_object('branch_id', '%s',
  'lines', jsonb_build_array(jsonb_build_object('kind', 'custom', 'name', 'x', 'unit_price_minor', 1000, 'employee_id', '%s')),
  'payments', '[{"method":"cash","amount_minor":1000}]'::jsonb)) $$, current_setting('t.abr'), current_setting('t.bemp')),
  'P0002', 'not_found', 'another salon''s barber on a sale line is refused');
select throws_ok(format($$ select create_sale(jsonb_build_object('branch_id', '%s', 'tip_minor', 500, 'tip_employee_id', '%s',
  'lines', '[{"kind":"custom","name":"x","unit_price_minor":1000}]'::jsonb,
  'payments', '[{"method":"cash","amount_minor":1500}]'::jsonb)) $$, current_setting('t.abr'), current_setting('t.bemp')),
  'P0002', 'not_found', 'and as the tip''s receiver');
select pg_temp.as_service();
select is(commission_for(current_setting('t.bemp')::uuid, to_char(current_date, 'YYYY-MM')), 0::bigint,
  'salon B''s payroll has no commission from salon A');

-- Inside salon B: staff add walk-ins only; cashiers see no commission.
select pg_temp.as_user('00000000-0000-0000-0000-0000000026b2');
select throws_ok(format($$ select create_appointment(jsonb_build_object('branch_id', '%s', 'kind', 'booking',
  'scheduled_at', now() + interval '1 day', 'service_ids', (select jsonb_agg(id) from services where business_id = '%s' limit 1))) $$,
  current_setting('t.bbr'), current_setting('t.b')), '42501', 'not_allowed', 'a barber cannot make a booking');
select lives_ok(format($$ select create_appointment(jsonb_build_object('branch_id', '%s', 'kind', 'walk_in', 'service_ids', '[]'::jsonb)) $$,
  current_setting('t.bbr')), 'but adds a walk-in');
select pg_temp.as_user('00000000-0000-0000-0000-0000000026b3');
select is((select bool_and(x ->> 'commission_minor' is null) from jsonb_array_elements(dashboard_today(current_setting('t.bbr')::uuid) -> 'staff_today') x),
  true, 'a cashier''s Home shows no staff commission');
select pg_temp.as_user('00000000-0000-0000-0000-0000000026b1');
select is((select bool_and(x ->> 'commission_minor' is not null) from jsonb_array_elements(dashboard_today(current_setting('t.bbr')::uuid) -> 'staff_today') x),
  true, 'the owner''s does');

-- A phone's push token cannot be taken by another salon.
select register_push_token(current_setting('t.b')::uuid, 'ExponentPushToken[target-phone]', 'ios');
select pg_temp.as_user('00000000-0000-0000-0000-0000000026a0');
select register_push_token(current_setting('t.a')::uuid, 'ExponentPushToken[target-phone]', 'ios');
select pg_temp.as_service();
select is((select m.business_id::text from push_tokens t join members m on m.id = t.member_id where t.token = 'ExponentPushToken[target-phone]'),
  current_setting('t.b'), 'the token stays with salon B');

select * from finish();
rollback;
