-- Live updates: changes announce only "table X changed" on private topics, and only the right people may listen
-- (branch staff to branch:, members to business:, owner and accountant to owners:, each person to member:).
begin;
create extension if not exists pgtap with schema extensions;
-- Paid plans are tested in 14_plans; here every salon may work.
select set_config('salon.plan_check', 'off', false);
select plan(9);
-- The checks below work out dates and codes with internal helpers that the app's sign-in roles cannot call (migration
-- 33); they are allowed here, inside this test's transaction only (rolled back at the end).
grant execute on function public.branch_today(uuid), public.branch_tz(uuid), public.business_today(uuid),
  public.compliance_readiness(uuid), public.plan_active(uuid), public.unique_business_code(text),
  public.post_journal(uuid, uuid, date, text, uuid, text, uuid, jsonb), public.branch_setting(uuid, text, jsonb)
  to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000090a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'lb-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000090c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'lb-cashier@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000090e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'lb-other@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

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
-- What a listener on this topic may read (the check Realtime makes before joining a private channel).
create function pg_temp.may_listen(p_topic text) returns boolean language plpgsql as $$
declare
  n int;
begin
  perform set_config('realtime.topic', p_topic, true);
  select count(*) into n from realtime.messages where topic = p_topic and extension = 'broadcast';
  return n > 0;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000090e');
select set_config('t.other', (create_business('{"business_name":"Other","owner_name":"Other","mode":"gents","vat_mode":"off"}')
  ->> 'business_id'), false);
select pg_temp.as_user('00000000-0000-0000-0000-00000000090a');
select set_config('t.b', (create_business('{"business_name":"Live Salon","owner_name":"Owner","mode":"gents",
  "vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select set_config('t.owner', (select id::text from members where user_id = '00000000-0000-0000-0000-00000000090a'), false);
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-00000000090c', 'username', 'lbcash', 'display_name', 'Cashier', 'role', 'cashier'));

-- Changes: a sale (branch), a customer (business), payroll (owners), a notification (member).
select pg_temp.as_user('00000000-0000-0000-0000-00000000090a');
select create_sale(jsonb_build_object('branch_id', current_setting('t.br'),
  'lines', '[{"kind":"custom","name":"Fade","unit_price_minor":5000}]'::jsonb, 'payments', '[{"method":"card","amount_minor":5000}]'::jsonb));
select generate_payroll(current_setting('t.b')::uuid, to_char(branch_today(current_setting('t.br')::uuid), 'YYYY-MM'));
select pg_temp.as_admin();
select is((select payload ->> 'table' from realtime.messages where topic = 'branch:' || current_setting('t.br')
  and payload ->> 'table' = 'sales' limit 1), 'sales', 'a sale announces "sales changed" to its branch');
select is((select count(*)::int from realtime.messages where topic = 'branch:' || current_setting('t.br')
  and payload ? 'total_minor'), 0, 'no row data travels, only the table name');

select pg_temp.as_user('00000000-0000-0000-0000-00000000090c');
select ok(pg_temp.may_listen('branch:' || current_setting('t.br')), 'the cashier listens to the branch');
select ok(pg_temp.may_listen('business:' || current_setting('t.b')), 'and to the business');
select ok(not pg_temp.may_listen('owners:' || current_setting('t.b')), 'but not to payroll and compliance');
select ok(not pg_temp.may_listen('member:' || current_setting('t.owner')), 'nor to the owner''s notifications');
select pg_temp.as_user('00000000-0000-0000-0000-00000000090a');
select ok(pg_temp.may_listen('owners:' || current_setting('t.b')), 'the owner listens to payroll and compliance');
select pg_temp.as_user('00000000-0000-0000-0000-00000000090e');
select ok(not pg_temp.may_listen('branch:' || current_setting('t.br')), 'another salon hears nothing');
select ok(not pg_temp.may_listen('business:' || current_setting('t.b')), 'of this business at all');

select * from finish();
rollback;
