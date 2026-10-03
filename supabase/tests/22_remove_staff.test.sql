-- Removing someone from the staff (owner, 2026-10-03): nothing on record → removed completely, login included;
-- anything on record → archived (hidden, login off, records kept), and can be brought back.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(12);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000022' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'remove-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1', 'c2']) n;

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

select pg_temp.as_user('00000000-0000-0000-0000-0000000022a0');
select set_config('t.b', (create_business('{"business_name":"Remove Salon","owner_name":"Owner","mode":"gents"}')
  ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select set_config('t.owner', (select id::text from members where business_id = current_setting('t.b')::uuid and role = 'owner'), false);
-- Added by mistake: never worked.
select set_config('t.oops', save_employee(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'full_name', 'Typo Name'))::text, false);
select pg_temp.as_service();
-- A login that never did anything.
select set_config('t.idle', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'user_id', '00000000-0000-0000-0000-0000000022b1', 'username', 'idlebarber',
  'display_name', 'Idle Barber', 'role', 'staff')) ->> 'employee_id'), false);
-- A barber who sold.
select set_config('t.work', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'user_id', '00000000-0000-0000-0000-0000000022c2', 'username', 'workbarber',
  'display_name', 'Work Barber', 'role', 'staff', 'commission_bps', 1000)) ->> 'employee_id'), false);
select pg_temp.as_user('00000000-0000-0000-0000-0000000022a0');
select create_sale(jsonb_build_object('branch_id', current_setting('t.br'), 'employee_id', current_setting('t.work'),
  'lines', jsonb_build_array(jsonb_build_object('kind', 'custom', 'name', 'Cut', 'unit_price_minor', 3000,
                                                'employee_id', current_setting('t.work'))),
  'payments', '[{"method":"cash","amount_minor":3000}]'::jsonb));

select throws_ok(format($$ select remove_staff(%L, %L) $$, current_setting('t.oops'), current_setting('t.owner')),
  '42501', null, 'only the server can remove staff (through the owner''s request)');

select pg_temp.as_service();
select is(remove_staff(current_setting('t.oops')::uuid, current_setting('t.owner')::uuid) ->> 'mode', 'removed',
  'someone added by mistake is removed completely');
select is((select count(*)::int from employees where id = current_setting('t.oops')::uuid), 0, 'no record left');
select results_eq(format($$ select r ->> 'mode', r ->> 'user_id' from (select remove_staff(%L, %L) r) x $$,
  current_setting('t.idle'), current_setting('t.owner')),
  $$ values ('removed', '00000000-0000-0000-0000-0000000022b1') $$, 'an unused login goes too (its user handed back)');
select is((select count(*)::int from members where username = 'idlebarber' and business_id = current_setting('t.b')::uuid), 0,
  'and its member row');

select is(remove_staff(current_setting('t.work')::uuid, current_setting('t.owner')::uuid) ->> 'mode', 'archived',
  'a barber with sales is archived, not deleted');
select results_eq(format($$ select e.active, m.active from employees e join members m on m.id = e.member_id where e.id = %L $$,
  current_setting('t.work')), $$ values (false, false) $$, 'hidden and the login off');
select is((select count(*)::int from sale_lines where employee_id = current_setting('t.work')::uuid), 1, 'the sale keeps its barber');

select is(restore_staff(current_setting('t.work')::uuid, current_setting('t.owner')::uuid) ->> 'mode', 'restored', 'brought back');
select results_eq(format($$ select e.active, m.active from employees e join members m on m.id = e.member_id where e.id = %L $$,
  current_setting('t.work')), $$ values (true, true) $$, 'on the staff and the login on again');

select throws_ok(format($$ select remove_staff(%L, %L) $$, current_setting('t.work'), gen_random_uuid()),
  '42501', 'not_allowed', 'only an active owner of that salon');
select throws_ok($$ select remove_staff(gen_random_uuid(), current_setting('t.owner')::uuid) $$, 'P0002', 'not_found',
  'nobody to remove');

select * from finish();
rollback;
