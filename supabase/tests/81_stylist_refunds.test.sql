-- Owner's app check E7: a stylist sees the refunds of their own sales (read only), not those of another stylist's sale;
-- the owner and the front desk still see them all, and nobody else's read rule changed.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(7);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000081' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'stylist-refunds-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1', 'c1', 'd1']) n;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000081' || p)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end $$;

select pg_temp.as_user('a0');
select set_config('t.b', (create_business('{"business_name":"Stylist Refunds Salon","owner_name":"Owner","mode":"ladies",
  "opening_cash_minor":100000}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_service();
select set_config('t.marie', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'user_id', '00000000-0000-0000-0000-0000000081b1', 'username', 'refmarie',
  'display_name', 'Marie', 'role', 'staff', 'commission_bps', 3500)) ->> 'employee_id'), false);
select set_config('t.lina', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'user_id', '00000000-0000-0000-0000-0000000081c1', 'username', 'reflina',
  'display_name', 'Lina', 'role', 'staff', 'commission_bps', 3500)) ->> 'employee_id'), false);
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-0000000081d1', 'username', 'refdesk', 'display_name', 'Desk', 'role', 'cashier'));

select pg_temp.as_user('a0');
create function pg_temp.sale(p_emp text) returns uuid language sql as $$
  select (create_sale(jsonb_build_object('branch_id', current_setting('t.br'), 'employee_id', p_emp,
    'tip_minor', 500, 'tip_employee_id', p_emp,
    'lines', jsonb_build_array(jsonb_build_object('kind', 'custom', 'name', 'Blow dry', 'unit_price_minor', 4000,
                                                  'employee_id', p_emp)),
    'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_minor', 4500)))) ->> 'sale_id')::uuid
$$;
select set_config('t.s_marie', pg_temp.sale(current_setting('t.marie'))::text, false);
select set_config('t.s_lina', pg_temp.sale(current_setting('t.lina'))::text, false);
select refund_sale(jsonb_build_object('sale_id', current_setting('t.s_marie'), 'amount_minor', 1000, 'method', 'cash',
  'reason', 'TEST partial refund'));
select refund_sale(jsonb_build_object('sale_id', current_setting('t.s_lina'), 'amount_minor', 1000, 'method', 'cash',
  'reason', 'Lina part redone'));

select is((select count(*)::int from refunds where business_id = current_setting('t.b')::uuid), 2, 'the owner sees both refunds');

select pg_temp.as_user('b1');
select results_eq($$ select amount_minor, reason from refunds $$, $$ values (1000::bigint, 'TEST partial refund') $$,
  'Marie sees the refund on her own sale, with its reason');
select is((select count(*)::int from refunds where sale_id = current_setting('t.s_lina')::uuid), 0,
  'but not the refund on Lina''s sale');
select is((select count(*)::int from sales where id = current_setting('t.s_lina')::uuid), 0,
  'whose sale she cannot open either (unchanged)');
select throws_ok($$ insert into refunds (sale_id, business_id, branch_id, business_date, amount_minor, method, reason)
  values (current_setting('t.s_marie')::uuid, current_setting('t.b')::uuid, current_setting('t.br')::uuid, current_date, 100,
          'cash', 'not allowed') $$, '42501', null, 'reading is all: she cannot write a refund');

select pg_temp.as_user('c1');
select results_eq($$ select reason from refunds $$, $$ values ('Lina part redone') $$, 'Lina sees only hers');

select pg_temp.as_user('d1');
select is((select count(*)::int from refunds), 2, 'the front desk still sees every refund at the branch');

select * from finish();
rollback;
