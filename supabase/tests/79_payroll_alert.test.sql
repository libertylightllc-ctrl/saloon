-- Part C4 (owner's app check, 9 Nov 2026): "Payroll ready to approve" goes only to those who can approve (the owner) and
-- ends once the month is approved or worked out again.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000079' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'payroll-alert-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1']) n;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000079' || p)::uuid,
    'role', 'authenticated')::text, true);
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
-- The "ready to approve" alerts a person has: all of them, or only those still showing.
create function pg_temp.alerts(p_role text, p_showing boolean) returns int language sql security definer as $$
  select count(*)::int from public.notifications n join public.members m on m.id = n.member_id
  where n.business_id = current_setting('t.b')::uuid and m.role::text = p_role and n.type = 'payroll_generated'
    and (not p_showing or n.expires_at is null or n.expires_at > now())
$$;

select pg_temp.as_user('a0');
select set_config('t.b', (create_business('{"business_name":"Payroll Alert Salon","owner_name":"Owner","mode":"gents",
  "vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_admin();
select set_config('t.period', to_char(branch_today(current_setting('t.br')::uuid), 'YYYY-MM'), false);
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-0000000079b1'::uuid, 'username', 'booksseventynine', 'display_name', 'Books',
  'role', 'accountant'));
select pg_temp.as_user('a0');
select save_employee(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'full_name', 'Sami', 'base_salary_minor', 300000, 'started_on', current_setting('t.period') || '-01'));

-- The accountant works out the month: only the owner is asked to approve.
select pg_temp.as_user('b1');
select set_config('t.run', generate_payroll(current_setting('t.b')::uuid, current_setting('t.period'))::text, false);
select pg_temp.as_admin();
select is(pg_temp.alerts('owner', true), 1, 'the owner is told it is ready to approve');
select is(pg_temp.alerts('accountant', false), 0, 'the accountant, who cannot approve, is not');

-- Worked out again (a later time): the earlier alert ends and one new alert shows.
update payroll_runs set generated_at = generated_at + interval '1 minute' where id = current_setting('t.run')::uuid;
select is(pg_temp.alerts('owner', false), 2, 'a new alert for the new figures');
select is(pg_temp.alerts('owner', true), 1, 'and only that one still shows');

-- Approved: the alert ends; nothing is deleted.
select pg_temp.as_user('a0');
select approve_payroll(current_setting('t.run')::uuid, 'Approved early in a test');
select pg_temp.as_admin();
select is(pg_temp.alerts('owner', true), 0, 'once approved, no "ready to approve" shows');
select is(pg_temp.alerts('owner', false), 2, 'the ended alerts are kept');

select * from finish();
rollback;
