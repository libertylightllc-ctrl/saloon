-- One person, one staff record (owner, 2026-09-30): a login joins the person's existing Staff & payroll record
-- instead of adding a second one; people already recorded twice are merged when one record has no history.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000017' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'one-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1', 'b2', 'b3', 'b4', 'b5']) n;

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
create function pg_temp.login(p_user text, p_username text, p_name text, p_role text, p_employee text default null)
returns jsonb language sql as $$
  select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
    'user_id', ('00000000-0000-0000-0000-0000000017' || p_user)::uuid, 'username', p_username, 'display_name', p_name,
    'role', p_role, 'commission_bps', 1000, 'employee_id', p_employee))
$$;
create function pg_temp.records(p_name text) returns int language sql as $$
  select count(*)::int from employees where business_id = current_setting('t.b')::uuid and lower(full_name) = lower(p_name)
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000017a0');
select set_config('t.b', (create_business('{"business_name":"One Record Salon","owner_name":"Owner","mode":"gents"}')
  ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select set_config('t.sameer', save_employee(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'full_name', 'Sameer Khan', 'role_title', 'staff', 'base_salary_minor', 300000,
  'employee_code', 'E-01', 'wps_required', true))::text, false);
select set_config('t.omar', save_employee(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'full_name', 'Omar', 'role_title', 'cashier', 'base_salary_minor', 250000))::text, false);

-- ── A login for someone picked from the staff list ───────────────────────────────────────
select pg_temp.as_service();
select is((pg_temp.login('b1', 'sameer', 'Sameer Khan', 'staff', current_setting('t.sameer')) ->> 'employee_id'),
  current_setting('t.sameer'), 'the login joins Sameer''s staff record');
select pg_temp.as_admin();
select is(pg_temp.records('Sameer Khan'), 1, 'Sameer is recorded once');
select results_eq(format($$ select base_salary_minor, employee_code, wps_required, commission_bps, m.username
  from employees e join members m on m.id = e.member_id where e.id = '%s' $$, current_setting('t.sameer')),
  $$ values (300000::bigint, 'E-01'::text, true, 1000, 'sameer'::text) $$,
  'with his salary, code and WPS, the commission from the login form and the username');
select pg_temp.as_service();
select throws_ok($$ select pg_temp.login('b2', 'sameer2', 'Sameer Khan', 'staff', current_setting('t.sameer')) $$,
  '22023', 'employee_has_login', 'a person cannot get a second login');

-- ── A login typed for a name already on the list (no one picked) ─────────────────────────
select lives_ok($$ select pg_temp.login('b2', 'omar', 'omar ', 'cashier') $$, 'a cashier login typed as "omar"');
select pg_temp.as_admin();
select is(pg_temp.records('Omar'), 1, 'joins Omar''s record rather than adding another');
select is((select base_salary_minor from employees where id = current_setting('t.omar')::uuid), 250000::bigint,
  'which keeps his salary');

-- ── Someone new gets a new record; an accountant gets none ───────────────────────────────
select pg_temp.as_service();
select isnt((pg_temp.login('b3', 'rafiq', 'Rafiq', 'staff') ->> 'employee_id'), null, 'a new barber gets a record');
select is((pg_temp.login('b4', 'books', 'Omar', 'accountant') ->> 'employee_id'), null,
  'an accountant is not put on the staff list by name');

-- ── People already recorded twice are merged once ────────────────────────────────────────
select pg_temp.as_admin();
-- Before this change: Aisha added in Staff & payroll, then a login made a second, empty record.
insert into employees (business_id, branch_id, full_name, role_title, base_salary_minor, employee_code, wps_required)
values (current_setting('t.b')::uuid, current_setting('t.br')::uuid, 'Aisha', 'staff', 280000, 'E-07', true);
select set_config('t.aisha', (select id::text from employees where business_id = current_setting('t.b')::uuid
  and full_name = 'Aisha'), false);
insert into members (business_id, user_id, role, display_name, username)
values (current_setting('t.b')::uuid, '00000000-0000-0000-0000-0000000017b5', 'staff', 'Aisha', 'aisha');
insert into employees (business_id, branch_id, member_id, full_name, role_title, commission_bps)
select current_setting('t.b')::uuid, current_setting('t.br')::uuid, id, 'Aisha', 'staff', 1500 from members
where username = 'aisha' and business_id = current_setting('t.b')::uuid;
insert into rosters (employee_id, business_id, weekday, start_time, end_time)
values (current_setting('t.aisha')::uuid, current_setting('t.b')::uuid, 1, '10:00', '19:00');
select is(pg_temp.records('Aisha'), 2, 'Aisha starts out recorded twice');
select ok(merge_duplicate_employees() >= 1, 'the repair merges her');
select is(pg_temp.records('Aisha'), 1, 'one record left');
select results_eq(format($$ select e.id, e.base_salary_minor, e.employee_code, e.commission_bps, m.username,
  (select count(*)::int from rosters r where r.employee_id = e.id)
  from employees e join members m on m.id = e.member_id where e.id = '%s' $$, current_setting('t.aisha')),
  format($$ values ('%s'::uuid, 280000::bigint, 'E-07'::text, 1500, 'aisha'::text, 1) $$, current_setting('t.aisha')),
  'her login, salary, code, commission and roster are all on it');
select lives_ok('select merge_duplicate_employees()', 'running it again is harmless');

select * from finish();
rollback;
