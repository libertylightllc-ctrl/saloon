-- A staff member sells only in their own name: whatever employee the request names, the sale, its lines and the tip
-- go to the signed-in staff member; the owner still chooses who served.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(5);
grant execute on function public.branch_today(uuid), public.business_today(uuid), public.unique_business_code(text),
  public.branch_setting(uuid, text, jsonb) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000038' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'ss-' || x || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b0', 'c0']) x;

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
create function pg_temp.emp(p_user text) returns uuid language sql as $$
  select e.id from employees e join members m on m.id = e.member_id where m.user_id = ('00000000-0000-0000-0000-0000000038' || p_user)::uuid
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000038a0');
select set_config('t.b', (create_business('{"business_name":"Self Salon","owner_name":"Owner","mode":"gents","vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select update_branch(current_setting('t.br')::uuid, '{"settings":{"staff_can_sell":true}}');
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-0000000038b0', 'username', 'ssrafiq', 'display_name', 'Rafiq', 'role', 'staff'));
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-0000000038c0', 'username', 'sssameer', 'display_name', 'Sameer', 'role', 'staff'));

-- Rafiq sells but names Sameer for the sale, a line and the tip: it is all Rafiq's.
select pg_temp.as_user('00000000-0000-0000-0000-0000000038b0');
select set_config('t.s', (create_sale(jsonb_build_object('branch_id', current_setting('t.br'), 'client_ref', 'ss-1',
  'employee_id', pg_temp.emp('c0'), 'tip_minor', 500, 'tip_employee_id', pg_temp.emp('c0'),
  'lines', jsonb_build_array(jsonb_build_object('kind', 'custom', 'name', 'Fade', 'unit_price_minor', 5000, 'qty', 1,
                                                'employee_id', pg_temp.emp('c0'))),
  'payments', '[{"method":"cash","amount_minor":5500}]'::jsonb)) ->> 'sale_id'), false);
select pg_temp.as_service();
select is((select employee_id from sales where id = current_setting('t.s')::uuid), pg_temp.emp('b0'), 'the sale is the seller''s own');
select is((select employee_id from sale_lines where sale_id = current_setting('t.s')::uuid), pg_temp.emp('b0'), 'so is each line');
select is((select tip_employee_id from sales where id = current_setting('t.s')::uuid), pg_temp.emp('b0'), 'and the tip');

-- The owner still chooses who served.
select pg_temp.as_user('00000000-0000-0000-0000-0000000038a0');
select set_config('t.s2', (create_sale(jsonb_build_object('branch_id', current_setting('t.br'), 'client_ref', 'ss-2',
  'employee_id', pg_temp.emp('c0'),
  'lines', '[{"kind":"custom","name":"Shave","unit_price_minor":3000,"qty":1}]'::jsonb,
  'payments', '[{"method":"cash","amount_minor":3000}]'::jsonb)) ->> 'sale_id'), false);
select pg_temp.as_service();
select is((select employee_id from sales where id = current_setting('t.s2')::uuid), pg_temp.emp('c0'), 'the owner chooses who served');

-- Rafiq sees his own sale (to send its receipt again), not Sameer's.
select pg_temp.as_user('00000000-0000-0000-0000-0000000038b0');
select is((select array_agg(id) from sales), array[current_setting('t.s')::uuid], 'a staff member reads only their own sales');

select * from finish();
rollback;
