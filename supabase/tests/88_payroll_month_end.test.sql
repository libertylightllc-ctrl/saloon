-- Platform console, Part A, A10 (owner's brief, 24 Nov 2026; migration 113): a month's payroll can be worked out early,
-- but it is approved from the month's last day; before that only the owner, with a reason, which is kept on the run and
-- in Activity. (On the last day of a month the checks for the current month see a month that is over.)
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000088a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'month-end-a0@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');
create function pg_temp.as_owner() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000088a0'::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

select pg_temp.as_owner();
select set_config('t.b', (create_business('{"business_name":"Month End Salon","owner_name":"Owner","mode":"gents",
  "vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_admin();
select set_config('t.today', branch_today(current_setting('t.br')::uuid)::text, false);
select set_config('t.this', to_char(current_setting('t.today')::date, 'YYYY-MM'), false);
select set_config('t.prev', to_char(current_setting('t.today')::date - interval '1 month', 'YYYY-MM'), false);
select set_config('t.over', (current_setting('t.today')::date
  = (date_trunc('month', current_setting('t.today')::date) + interval '1 month - 1 day')::date)::text, false);
select pg_temp.as_owner();
select save_employee(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'full_name', 'Sami', 'base_salary_minor', 300000, 'started_on', current_setting('t.prev') || '-01'));
select set_config('t.prev_run', generate_payroll(current_setting('t.b')::uuid, current_setting('t.prev'))::text, false);
select set_config('t.this_run', generate_payroll(current_setting('t.b')::uuid, current_setting('t.this'))::text, false);

-- Last month is over: approved as before, no reason asked.
select lives_ok(format($$ select approve_payroll(%L) $$, current_setting('t.prev_run')), 'a month that is over is approved as before');

-- This month, before its last day: not without a reason, and a reason is a few words.
select case when current_setting('t.over')::boolean then pass('(today is the month''s last day: approving needs no reason)')
  else throws_ok(format($$ select approve_payroll(%L) $$, current_setting('t.this_run')), '22023', 'month_not_over',
    'this month is not over: approving waits for its last day') end;
select case when current_setting('t.over')::boolean then pass('(today is the month''s last day)')
  else throws_ok(format($$ select approve_payroll(%L, 'ok') $$, current_setting('t.this_run')), '22023', 'reason_required',
    'a reason of a few words') end;
select lives_ok(format($$ select approve_payroll(%L, 'Staff travelling next week') $$, current_setting('t.this_run')),
  'the owner approves early with a reason');

select pg_temp.as_admin();
select is((select array_agg(coalesce(approved_early_reason, '-') order by period) from payroll_runs where business_id = current_setting('t.b')::uuid),
  array['-', case when current_setting('t.over')::boolean then '-' else 'Staff travelling next week' end],
  'the reason is kept on the early run only');
select is((select summary from audit_log where business_id = current_setting('t.b')::uuid and entity_id = current_setting('t.this_run')::uuid
           and action = 'approve'),
  'Approved payroll ' || current_setting('t.this')
    || case when current_setting('t.over')::boolean then '' else ' before the month ended (Staff travelling next week)' end
    || ': net AED 3,000.00',
  'and in Activity');

select * from finish();
rollback;
