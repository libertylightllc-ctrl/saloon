-- Commission is never taken on a tip (owner, 2026-10-01): it is a share of the services after discount and without
-- VAT; the whole tip goes to the staff member. A partial refund (pro-rata over services, VAT and tip) lowers the
-- commission by the same share.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(5);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000020' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'tip-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1']) n;

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

select pg_temp.as_user('00000000-0000-0000-0000-0000000020a0');
select set_config('t.b', (create_business('{"business_name":"Tip Salon","owner_name":"Owner","mode":"gents",
  "opening_cash_minor":100000}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_service();
select set_config('t.emp', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'user_id', '00000000-0000-0000-0000-0000000020b1', 'username', 'tipbarber',
  'display_name', 'Tip Barber', 'role', 'staff', 'commission_bps', 4000)) ->> 'employee_id'), false);
select pg_temp.as_user('00000000-0000-0000-0000-0000000020a0');

-- Beard colour AED 45.00 with a AED 10.00 tip, barber on 40%.
select set_config('t.sale', (create_sale(jsonb_build_object('branch_id', current_setting('t.br'),
  'employee_id', current_setting('t.emp'), 'tip_minor', 1000,
  'lines', jsonb_build_array(jsonb_build_object('kind', 'custom', 'name', 'Beard colour', 'unit_price_minor', 4500,
                                                'employee_id', current_setting('t.emp'))),
  'payments', '[{"method":"cash","amount_minor":5500}]'::jsonb)) ->> 'sale_id'), false);
select is((select commission_minor from sale_lines where sale_id = current_setting('t.sale')::uuid), 1800::bigint,
  '40% of the AED 45.00 service = AED 18.00, nothing on the AED 10.00 tip');
select pg_temp.as_admin();
select is(commission_for(current_setting('t.emp')::uuid, to_char(branch_today(current_setting('t.br')::uuid), 'YYYY-MM')),
  1800::bigint, 'the month''s commission is the same AED 18.00');
select pg_temp.as_user('00000000-0000-0000-0000-0000000020a0');
select lives_ok(format($$ select generate_payroll('%s', to_char(branch_today('%s'), 'YYYY-MM')) $$,
  current_setting('t.b'), current_setting('t.br')), 'payroll worked out');
select is((select commission_minor from payroll_lines where employee_id = current_setting('t.emp')::uuid), 1800::bigint,
  'and the payslip shows AED 18.00 commission');

-- Half the sale refunded (AED 27.50: half the service and half the tip): half the commission goes.
select refund_sale(jsonb_build_object('sale_id', current_setting('t.sale'), 'amount_minor', 2750, 'method', 'cash',
  'reason', 'Half the colour redone'));
select pg_temp.as_admin();
select is(commission_for(current_setting('t.emp')::uuid, to_char(branch_today(current_setting('t.br')::uuid), 'YYYY-MM')),
  900::bigint, 'a half refund leaves AED 9.00 (half the service), still nothing from the tip');

select * from finish();
rollback;
