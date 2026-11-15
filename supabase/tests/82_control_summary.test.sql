-- Owner's app check E8 (d): the control summary names the days before today that still need a cash close, and
-- managers read it for their branch (the front desk still cannot).
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(7);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000082' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'control-summary-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1', 'c1']) n;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000082' || p)::uuid,
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
create function pg_temp.sale() returns uuid language sql as $$
  select (create_sale(jsonb_build_object('branch_id', current_setting('t.br'),
    'lines', jsonb_build_array(jsonb_build_object('kind', 'custom', 'name', 'Cut', 'unit_price_minor', 4000)),
    'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_minor', 4000)))) ->> 'sale_id')::uuid
$$;
-- Moves a sale's books entries to an earlier day.
create function pg_temp.on_day(p_sale uuid, p_days_ago int) returns void language sql as $$
  update journal_entries set business_date = current_setting('t.d' || p_days_ago)::date where source_id = p_sale;
$$;
create function pg_temp.unclosed() returns jsonb language sql as $$
  select owner_control(current_setting('t.br')::uuid) -> 'unclosed_days'
$$;
create function pg_temp.ago(p int) returns text language sql as $$
  select current_setting('t.d' || p)
$$;

select pg_temp.as_user('a0');
select set_config('t.b', (create_business('{"business_name":"Control Summary Salon","owner_name":"Owner","mode":"gents",
  "opening_cash_minor":50000}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_admin();
select set_config('t.d' || n, (public.branch_today(current_setting('t.br')::uuid) - n)::text, false) from generate_series(1, 3) n;
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-0000000082b1', 'username', 'ctrlmanager', 'display_name', 'Manager', 'role', 'manager'));
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-0000000082c1', 'username', 'ctrldesk', 'display_name', 'Desk', 'role', 'cashier'));

select pg_temp.as_user('a0');
select is(pg_temp.unclosed(), '[]'::jsonb, 'nothing before today: no day waits for a close');

-- Cash moved three days ago, two days ago and yesterday (and today, which is not counted yet).
select set_config('t.s3', pg_temp.sale()::text, false);
select set_config('t.s2', pg_temp.sale()::text, false);
select set_config('t.s1', pg_temp.sale()::text, false);
select pg_temp.sale();
select pg_temp.as_admin();
select pg_temp.on_day(current_setting('t.s3')::uuid, 3);
select pg_temp.on_day(current_setting('t.s2')::uuid, 2);
select pg_temp.on_day(current_setting('t.s1')::uuid, 1);
-- Three days ago was approved; two days ago was counted and sent back (a draft again).
insert into cash_closings (business_id, branch_id, business_date, status, counted_cash_minor)
values (current_setting('t.b')::uuid, current_setting('t.br')::uuid, pg_temp.ago(3)::date, 'approved', 4000),
       (current_setting('t.b')::uuid, current_setting('t.br')::uuid, pg_temp.ago(2)::date, 'draft', 4000);

select pg_temp.as_user('a0');
select is(pg_temp.unclosed(), jsonb_build_array(pg_temp.ago(1), pg_temp.ago(2)),
  'yesterday and the day sent back still need a close, newest first');
select is(owner_control(current_setting('t.br')::uuid) ->> 'last_close_date', pg_temp.ago(3), 'the last close is still named');

-- Counted and waiting for approval counts as closed here.
select pg_temp.as_admin();
insert into cash_closings (business_id, branch_id, business_date, status, counted_cash_minor)
values (current_setting('t.b')::uuid, current_setting('t.br')::uuid, pg_temp.ago(1)::date, 'pending_approval', 4000);
select pg_temp.as_user('a0');
select is(pg_temp.unclosed(), jsonb_build_array(pg_temp.ago(2)), 'a count waiting for approval is not "not closed"');

select pg_temp.as_user('b1');
select is(pg_temp.unclosed(), jsonb_build_array(pg_temp.ago(2)), 'the manager reads the control summary for their branch');
select ok((owner_control(current_setting('t.br')::uuid) ->> 'compliance_issues') is not null,
  'with the compliance count (managers look after compliance records)');

select pg_temp.as_user('c1');
select throws_ok($$ select owner_control(current_setting('t.br')::uuid) $$, '42501', null, 'the front desk still cannot');

select * from finish();
rollback;
