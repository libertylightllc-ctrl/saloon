-- Part C1 (owner's app check, 9 Nov 2026): base pay by the days someone was employed in the month, from their start
-- and leaving dates; approved months never change.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(19);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000077a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'pay-by-days@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');
create function pg_temp.as_owner() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000077a0',
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
-- The staff table is read through the app's functions; the test reads the two dates directly.
create function pg_temp.dates(p text) returns table (started_on date, left_on date) language sql security definer as $$
  select e.started_on, e.left_on from public.employees e where e.id = current_setting(p)::uuid
$$;
create function pg_temp.staff(p_name text, p_salary bigint, p_start text, p_left text default null) returns uuid
language sql as $$
  select save_employee(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
    'full_name', p_name, 'base_salary_minor', p_salary, 'started_on', p_start))
$$;

select pg_temp.as_owner();
select set_config('t.b', (create_business('{"business_name":"Pay By Days Salon","owner_name":"Owner","mode":"ladies",
  "vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_admin();
select set_config('t.today', business_today(current_setting('t.b')::uuid)::text, false);
select pg_temp.as_owner();

-- October 2026 has 31 days. Maxum joined on 9 Oct (23 days), Paru was there all month, Lina left on 10 Oct.
select set_config('t.maxum', pg_temp.staff('Maxum', 200000, '2026-10-09')::text, false);
select set_config('t.paru', pg_temp.staff('Paru', 50000, '2026-09-01')::text, false);
select set_config('t.lina', pg_temp.staff('Lina', 310000, '2026-09-01')::text, false);
select save_employee(jsonb_build_object('business_id', current_setting('t.b'), 'id', current_setting('t.lina'),
  'full_name', 'Lina', 'active', false, 'left_on', '2026-10-10'));
-- Omar was switched off before start and leaving dates existed: no leaving date, so no base pay (as before).
select set_config('t.omar', pg_temp.staff('Omar', 100000, '2026-09-01')::text, false);
select pg_temp.as_admin();
update employees set active = false, left_on = null where id = current_setting('t.omar')::uuid;
select pg_temp.as_owner();

select set_config('t.run', generate_payroll(current_setting('t.b')::uuid, '2026-10')::text, false);
create function pg_temp.line(p_emp text) returns payroll_lines language sql as $$
  select * from payroll_lines where run_id = current_setting('t.run')::uuid and employee_id = current_setting(p_emp)::uuid
$$;

select is((pg_temp.line('t.maxum')).base_minor, 148387::bigint, 'joined on 9 Oct: 2,000.00 × 23 ÷ 31 = 1,483.87');
select is(((pg_temp.line('t.maxum')).days_employed, (pg_temp.line('t.maxum')).days_in_month), (23, 31),
  'the line says 23 of 31 days');
select is((pg_temp.line('t.paru')).base_minor, 50000::bigint, 'there all month: the whole salary');
select is((pg_temp.line('t.paru')).days_employed, 31, 'and 31 of 31 days');
select is((pg_temp.line('t.lina')).base_minor, 100000::bigint, 'left on 10 Oct: 3,100.00 × 10 ÷ 31 = 1,000.00');
select is((select count(*)::int from payroll_lines where run_id = current_setting('t.run')::uuid
           and employee_id = current_setting('t.omar')::uuid), 0, 'switched off with no leaving date: no line');

-- September: Maxum had not started yet.
select pg_temp.as_admin();
select is((select count(*)::int from payroll_figures(current_setting('t.b')::uuid, '2026-09')
           where employee_id = current_setting('t.maxum')::uuid), 0, 'no pay for a month before the start date');
select pg_temp.as_owner();

-- The dates on the staff form.
select is((select started_on from pg_temp.dates('t.maxum')), date '2026-10-09',
  'the start date is kept');
select set_config('t.new', pg_temp.staff('Nadia', 100000, null)::text, false);
select is((select started_on::text from pg_temp.dates('t.new')), current_setting('t.today'),
  'with no date given, someone starts today');
select throws_ok(format($$ select save_employee('{"business_id":"%s","id":"%s","full_name":"Lina","active":false,
  "left_on":"2026-08-01"}') $$, current_setting('t.b'), current_setting('t.lina')), '22023', 'invalid_date',
  'a leaving date before the start is refused');
select is((select left_on from pg_temp.dates('t.lina')), date '2026-10-10',
  'and the leaving date stays');
select save_employee(jsonb_build_object('business_id', current_setting('t.b'), 'id', current_setting('t.lina'),
  'full_name', 'Lina', 'active', true));
select is((select left_on from pg_temp.dates('t.lina')), null::date,
  'switched back on: no leaving date');
select save_employee(jsonb_build_object('business_id', current_setting('t.b'), 'id', current_setting('t.lina'),
  'full_name', 'Lina', 'active', false));
select is((select left_on::text from pg_temp.dates('t.lina')), current_setting('t.today'),
  'switched off with no date: leaves today');
select is((select started_on from staff_directory(current_setting('t.b')::uuid)
           where employee_id = current_setting('t.maxum')::uuid), date '2026-10-09', 'the staff list shows the start date');

-- Archived from the staff list (records kept): leaves today; brought back: no leaving date.
select pg_temp.as_admin();
insert into attendance (business_id, branch_id, employee_id, business_date, clock_in)
values (current_setting('t.b')::uuid, current_setting('t.br')::uuid, current_setting('t.paru')::uuid,
        current_setting('t.today')::date, now());
select remove_staff(current_setting('t.paru')::uuid, (select id from members where business_id = current_setting('t.b')::uuid
  and role = 'owner'));
select is((select left_on::text from pg_temp.dates('t.paru')), current_setting('t.today'),
  'archived: leaves today');
select restore_staff(current_setting('t.paru')::uuid, (select id from members where business_id = current_setting('t.b')::uuid
  and role = 'owner'));
select is((select left_on from pg_temp.dates('t.paru')), null::date, 'brought back: no leaving date');

-- An approved month never changes, whatever happens to the dates afterwards.
select pg_temp.as_owner();
select throws_ok(format($$ select approve_payroll('%s') $$, current_setting('t.run')), '22023', 'payroll_changed',
  'after a leaving date changes, the draft must be worked out again');
select generate_payroll(current_setting('t.b')::uuid, '2026-10');
select approve_payroll(current_setting('t.run')::uuid);
select save_employee(jsonb_build_object('business_id', current_setting('t.b'), 'id', current_setting('t.maxum'),
  'full_name', 'Maxum', 'started_on', '2026-10-01'));
select is((pg_temp.line('t.maxum')).base_minor, 148387::bigint, 'approved October keeps 1,483.87');
select throws_ok(format($$ select generate_payroll('%s', '2026-10') $$, current_setting('t.b')), '22023', 'payroll_approved',
  'and is not worked out again');

select * from finish();
rollback;
